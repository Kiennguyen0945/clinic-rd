from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.api.permissions import IsManager
from core.api.responses import error_response, success_response

from ..selectors.role_queries import list_roles
from ..selectors.user_queries import (
    get_staff,
    list_staff,
    list_users,
    staff_has_clinical_dependencies,
)
from ..services import AuthServiceError
from ..services.allocate_doctor_room import allocate_doctor_room
from ..services.authenticate_user import authenticate_user, refresh_session
from ..services.change_password import change_password
from ..services.create_staff import create_staff
from ..services.delete_staff import delete_staff
from ..services.toggle_staff_lock import toggle_staff_lock
from ..services.update_staff import update_staff
from .serializers import (
    RoleSerializer,
    RoomAllocationSerializer,
    StaffCreateSerializer,
    StaffUpdateSerializer,
    UserSerializer,
)


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


def _staff_payload(user, *, locked=None):
    if locked is None:
        locked = staff_has_clinical_dependencies(user)
    departments = [
        {
            "id": assignment.department_id,
            "code": assignment.department.code,
            "name": assignment.department.name,
        }
        for assignment in user.department_assignments.all()
    ]
    is_doctor = user.role.code == "DOCTOR"
    can_receive_appointments = is_doctor and user.doctor_slots.filter(
        slot_date__gte=timezone.localdate(), status="OPEN"
    ).exists()
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "fullName": user.full_name,
        "phone": user.phone,
        "status": user.status,
        "role": user.role.code,
        "departments": departments,
        "canEdit": not locked,
        "canDelete": not locked,
        "scheduleStatus": (
            "ASSIGNED" if can_receive_appointments else "UNASSIGNED"
        )
        if is_doctor
        else "NOT_APPLICABLE",
        "canReceiveAppointments": can_receive_appointments,
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

    def get(self, request):
        permission_error = _require_manager(request)
        if permission_error:
            return permission_error
        employees = list_staff()
        return success_response(
            [_staff_payload(employee) for employee in employees],
            message="Employees retrieved successfully",
        )

    def post(self, request):
        permission_error = _require_manager(request)
        if permission_error:
            return permission_error
        serializer = StaffCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                "Invalid employee data",
                details=serializer.errors,
            )
        data = serializer.validated_data
        try:
            user, generated_password, allocation = create_staff(
                username=data["username"],
                full_name=data["fullName"],
                email=data["email"],
                phone=data.get("phone", ""),
                role_code=data["roleCode"],
                password=data.get("password"),
                department_id=data.get("departmentId"),
                room_id=data.get("roomId"),
            )
        except AuthServiceError as exc:
            return _service_error_response(exc)
        return success_response(
            {
                "user": _staff_payload(user),
                "generatedPassword": generated_password,
                "allocation": allocation,
            },
            message="Employee created successfully",
            status=201,
        )


class StaffDetailView(APIView):
    permission_classes = (IsManager,)

    def get(self, request, pk):
        permission_error = _require_manager(request)
        if permission_error:
            return permission_error
        user = get_staff(pk)
        if user is None:
            return error_response("EMPLOYEE_NOT_FOUND", "Employee not found", status=404)
        return success_response(
            {"user": _staff_payload(user)},
            message="Employee retrieved successfully",
        )

    def patch(self, request, pk):
        permission_error = _require_manager(request)
        if permission_error:
            return permission_error
        serializer = StaffUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                "Invalid employee data",
                details=serializer.errors,
            )
        data = serializer.validated_data
        try:
            user = update_staff(
                user_id=pk,
                full_name=data["fullName"],
                email=data["email"],
                phone=data.get("phone", ""),
                status=data["status"],
                department_id=data.get("departmentId"),
            )
        except AuthServiceError as exc:
            return _service_error_response(exc)
        return success_response(
            {"user": _staff_payload(user, locked=False)},
            message="Employee updated successfully",
        )

    def delete(self, request, pk):
        permission_error = _require_manager(request)
        if permission_error:
            return permission_error
        try:
            delete_staff(user_id=pk)
        except AuthServiceError as exc:
            return _service_error_response(exc)
        return success_response({}, message="Employee deleted successfully")


class StaffRoomAllocationView(APIView):
    permission_classes = (IsManager,)

    def post(self, request, pk):
        permission_error = _require_manager(request)
        if permission_error:
            return permission_error
        serializer = RoomAllocationSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                "Invalid room allocation",
                details=serializer.errors,
            )
        data = serializer.validated_data
        try:
            allocation = allocate_doctor_room(
                doctor_id=pk,
                room_id=data["roomId"],
                slot_date=data["date"],
                start_time=data["startTime"],
                end_time=data["endTime"],
            )
        except AuthServiceError as exc:
            return _service_error_response(exc)
        return success_response(
            {"allocation": allocation},
            message="Room allocated successfully",
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
