# ruff: noqa: RUF012

import secrets
import string

from django.contrib.auth.hashers import check_password, make_password
from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from backend.permissions import IsManager
from backend.response_utils import error_response, success_response

from .models import Role, User
from .serializers import RoleSerializer, UserSerializer


@api_view(['GET', 'POST'])
def role_api(request):
    if request.method == 'GET':
        roles = Role.objects.all()
        serializer = RoleSerializer(roles, many=True)
        return success_response(serializer.data, message="Lấy danh sách vai trò thành công")
    if request.method == 'POST':
        serializer = RoleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return success_response(
                serializer.data,
                message="Tạo vai trò mới thành công",
                status=201
            )
        return error_response(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            status=400,
            details=serializer.errors
        )


@api_view(['GET', 'POST'])
def user_api(request):
    if request.method == 'GET':
        users = User.objects.all()
        serializer = UserSerializer(users, many=True)
        return success_response(serializer.data, message="Lấy danh sách người dùng thành công")
    if request.method == 'POST':
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return success_response(
                serializer.data,
                message="Tạo người dùng mới thành công",
                status=201
            )
        return error_response(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            status=400,
            details=serializer.errors
        )


@api_view(['POST'])
def login_api(request):
    username = request.data.get('username')
    password = request.data.get('password')
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return error_response(
            "INVALID_CREDENTIALS",
            "Tên đăng nhập hoặc mật khẩu không đúng.",
            status=401
        )
    if getattr(user, 'status', '') == 'LOCKED':
        return error_response(
            "ACCOUNT_LOCKED",
            "Tài khoản đã bị khóa.",
            status=403
        )
    if not check_password(password, user.password_hash):
        return error_response(
            "INVALID_CREDENTIALS",
            "Tên đăng nhập hoặc mật khẩu không đúng.",
            status=401
        )
    refresh = RefreshToken.for_user(user)
    return success_response(
        {
            'token': str(refresh.access_token),
            'refreshToken': str(refresh),
            'user': {
                'id': str(user.id),
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role.code if user.role else 'DOCTOR'
            }
        },
        message="Đăng nhập thành công"
    )


@api_view(['POST'])
def refresh_api(request):
    refresh_token = request.data.get('refreshToken') or request.data.get('refresh_token')
    if not refresh_token:
        return error_response(
            "VALIDATION_ERROR",
            "Thiếu refresh token.",
            status=400
        )

    try:
        refresh = RefreshToken(refresh_token)
        user = User.objects.get(id=refresh["user_id"])
    except (TokenError, User.DoesNotExist):
        return error_response(
            "UNAUTHORIZED",
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
            status=401
        )

    if getattr(user, 'status', '') == 'LOCKED':
        return error_response(
            "ACCOUNT_LOCKED",
            "Tài khoản đã bị khóa.",
            status=403
        )

    new_refresh = RefreshToken.for_user(user)
    return success_response(
        {
            'token': str(new_refresh.access_token),
            'refreshToken': str(new_refresh),
        },
        message="Làm mới phiên đăng nhập thành công"
    )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(request.user, 'is_authenticated', False):
            return error_response("UNAUTHORIZED", "Vui lòng đăng nhập", status=401)

        current_password = request.data.get('currentPassword')
        new_password = request.data.get('newPassword')
        confirm_new_password = request.data.get('confirmNewPassword')

        if not check_password(current_password or '', request.user.password_hash):
            return error_response(
                "WRONG_PASSWORD",
                "Mật khẩu hiện tại không đúng",
                status=400,
            )

        if new_password != confirm_new_password:
            return error_response(
                "PASSWORD_MISMATCH",
                "Xác nhận mật khẩu mới không khớp",
                status=400,
            )

        if not new_password or len(new_password) < 6:
            return error_response(
                "WEAK_PASSWORD",
                "Mật khẩu mới phải có ít nhất 6 ký tự",
                status=400,
            )

        request.user.password_hash = make_password(new_password)
        request.user.save(update_fields=['password_hash', 'updated_at'])

        return success_response({}, message="Đổi mật khẩu thành công")


class StaffCreateView(APIView):
    permission_classes = [IsManager]

    def post(self, request):
        if not getattr(request.user, 'is_authenticated', False):
            return error_response("UNAUTHORIZED", "Vui lòng đăng nhập", status=401)

        if getattr(getattr(request.user, 'role', None), 'code', None) != 'MANAGER':
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        username = request.data.get('username')
        full_name = request.data.get('fullName')
        phone = request.data.get('phone', '')
        role_code = request.data.get('roleCode')
        password = request.data.get('password')

        if not username or not full_name or role_code not in {'RECEPTIONIST', 'DOCTOR'}:
            return error_response(
                "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ",
                status=400,
                details={
                    'username': 'Bắt buộc',
                    'fullName': 'Bắt buộc',
                    'roleCode': 'Phải là RECEPTIONIST hoặc DOCTOR',
                },
            )

        if User.objects.filter(username=username).exists():
            return error_response(
                "DUPLICATE_USERNAME",
                "Tên đăng nhập đã tồn tại",
                status=400,
            )

        try:
            role = Role.objects.get(code=role_code)
        except Role.DoesNotExist:
            return error_response(
                "VALIDATION_ERROR",
                "Vai trò không hợp lệ",
                status=400,
                details={'roleCode': 'Không tồn tại'},
            )

        generated_password = password or ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))

        user = User.objects.create(
            username=username,
            full_name=full_name,
            phone=phone or '',
            role=role,
            status='ACTIVE',
            password_hash=make_password(generated_password),
        )

        return success_response(
            {
                'user': {
                    'id': str(user.id),
                    'username': user.username,
                    'fullName': user.full_name,
                    'phone': user.phone,
                    'status': user.status,
                    'role': user.role.code,
                },
                'generatedPassword': generated_password,
            },
            message="Tạo tài khoản nhân viên thành công",
            status=201,
        )


class StaffToggleLockView(APIView):
    permission_classes = [IsManager]

    def patch(self, request, pk):
        if not getattr(request.user, 'is_authenticated', False):
            return error_response("UNAUTHORIZED", "Vui lòng đăng nhập", status=401)

        if getattr(getattr(request.user, 'role', None), 'code', None) != 'MANAGER':
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        action = request.data.get('action')
        if action not in {'lock', 'unlock'}:
            return error_response(
                "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ",
                status=400,
                details={'action': 'Phải là lock hoặc unlock'},
            )

        if str(request.user.id) == str(pk):
            return error_response(
                "SELF_LOCK",
                "Không thể tự khóa tài khoản của chính mình",
                status=400,
            )

        try:
            user = User.objects.select_related('role').get(pk=pk)
        except User.DoesNotExist:
            return error_response(
                "USER_NOT_FOUND",
                "Không tìm thấy người dùng",
                status=404,
            )

        user.status = 'LOCKED' if action == 'lock' else 'ACTIVE'
        user.save(update_fields=['status', 'updated_at'])

        return success_response(
            {
                'user': {
                    'id': str(user.id),
                    'username': user.username,
                    'fullName': user.full_name,
                    'phone': user.phone,
                    'status': user.status,
                    'role': user.role.code,
                }
            },
            message="Cập nhật trạng thái tài khoản thành công",
        )


def homePageView(request):
    return HttpResponse('Hello, World')
