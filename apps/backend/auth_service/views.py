from django.http import HttpResponse
from rest_framework.decorators import api_view
from .models import User, Role
from .serializers import RoleSerializer, UserSerializer
from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.tokens import RefreshToken
from backend.response_utils import success_response, error_response


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
            'user': {
                'id': str(user.id),
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role.code if user.role else 'DOCTOR'
            }
        },
        message="Đăng nhập thành công"
    )


def homePageView(request):
    return HttpResponse('Hello, World')
