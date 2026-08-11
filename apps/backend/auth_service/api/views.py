from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.api.permissions import IsManager
from core.api.responses import error_response, success_response

from ..selectors.role_queries import list_roles
from ..selectors.user_queries import list_users
from ..services import AuthServiceError
from ..services.authenticate_user import authenticate_user, refresh_session
from ..services.change_password import change_password
from ..services.create_staff import create_staff
from ..services.toggle_staff_lock import toggle_staff_lock
from .serializers import RoleSerializer, UserSerializer


def _service_error_response(exc):
    return error_response(
        exc.code,
        exc.message,
        status=exc.status,
        details=exc.details,
    )


def _require_auth(request):
    if not getattr(request.user, "is_authenticated", False):
        return error_response("UNAUTHORIZED", "Vui lòng đăng nhập", status=401)
    return None


def _require_manager(request):
    auth_error = _require_auth(request)
    if auth_error:
        return auth_error
    if getattr(getattr(request.user, "role", None), "code", None) != "MANAGER":
        return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)
    return None


def _staff_payload(user):
    return {
        "id": str(user.id),
        "username": user.username,
        "fullName": user.full_name,
        "phone": user.phone,
        "status": user.status,
        "role": user.role.code,
    }


@api_view(["GET", "POST"])
def role_api(request):
    if request.method == "GET":
        serializer = RoleSerializer(list_roles(), many=True)
        return success_response(
            serializer.data,
            message="Lấy danh sách vai trò thành công",
        )

    serializer = RoleSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return success_response(
            serializer.data,
            message="Tạo vai trò mới thành công",
            status=201,
        )
    return error_response(
        "VALIDATION_ERROR",
        "Dữ liệu không hợp lệ",
        details=serializer.errors,
    )


@api_view(["GET", "POST"])
def user_api(request):
    if request.method == "GET":
        serializer = UserSerializer(list_users(), many=True)
        return success_response(
            serializer.data,
            message="Lấy danh sách người dùng thành công",
        )

    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return success_response(
            serializer.data,
            message="Tạo người dùng mới thành công",
            status=201,
        )
    return error_response(
        "VALIDATION_ERROR",
        "Dữ liệu không hợp lệ",
        details=serializer.errors,
    )


@api_view(["POST"])
def login_api(request):
    try:
        data = authenticate_user(
            username=request.data.get("username"),
            password=request.data.get("password"),
        )
    except AuthServiceError as exc:
        return _service_error_response(exc)
    return success_response(data, message="Đăng nhập thành công")


@api_view(["POST"])
def refresh_api(request):
    token = request.data.get("refreshToken") or request.data.get("refresh_token")
    try:
        data = refresh_session(refresh_token=token)
    except AuthServiceError as exc:
        return _service_error_response(exc)
    return success_response(data, message="Làm mới phiên đăng nhập thành công")


class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        auth_error = _require_auth(request)
        if auth_error:
            return auth_error
        try:
            change_password(
                user=request.user,
                current_password=request.data.get("currentPassword"),
                new_password=request.data.get("newPassword"),
                confirmation=request.data.get("confirmNewPassword"),
            )
        except AuthServiceError as exc:
            return _service_error_response(exc)
        return success_response({}, message="Đổi mật khẩu thành công")


class StaffCreateView(APIView):
    permission_classes = (IsManager,)

    def post(self, request):
        permission_error = _require_manager(request)
        if permission_error:
            return permission_error
        try:
            user, generated_password = create_staff(
                username=request.data.get("username"),
                full_name=request.data.get("fullName"),
                phone=request.data.get("phone", ""),
                role_code=request.data.get("roleCode"),
                password=request.data.get("password"),
            )
        except AuthServiceError as exc:
            return _service_error_response(exc)
        return success_response(
            {
                "user": _staff_payload(user),
                "generatedPassword": generated_password,
            },
            message="Tạo tài khoản nhân viên thành công",
            status=201,
        )


class StaffToggleLockView(APIView):
    permission_classes = (IsManager,)

    def patch(self, request, pk):
        permission_error = _require_manager(request)
        if permission_error:
            return permission_error
        try:
            user = toggle_staff_lock(
                actor=request.user,
                user_id=pk,
                action=request.data.get("action"),
            )
        except AuthServiceError as exc:
            return _service_error_response(exc)
        return success_response(
            {"user": _staff_payload(user)},
            message="Cập nhật trạng thái tài khoản thành công",
        )


def homePageView(request):
    return HttpResponse("Hello, World")
