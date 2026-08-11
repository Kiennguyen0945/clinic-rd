from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import User
from ..selectors.user_queries import get_user_by_username
from . import AuthServiceError


def authenticate_user(*, username, password):
    user = get_user_by_username(username)
    if user is None:
        raise AuthServiceError(
            "INVALID_CREDENTIALS",
            "Tên đăng nhập hoặc mật khẩu không đúng.",
            status=401,
        )
    if user.status == "LOCKED":
        raise AuthServiceError(
            "ACCOUNT_LOCKED",
            "Tài khoản đã bị khóa.",
            status=403,
        )
    if not check_password(password, user.password_hash):
        raise AuthServiceError(
            "INVALID_CREDENTIALS",
            "Tên đăng nhập hoặc mật khẩu không đúng.",
            status=401,
        )

    refresh = RefreshToken.for_user(user)
    return {
        "token": str(refresh.access_token),
        "refreshToken": str(refresh),
        "user": {
            "id": str(user.id),
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.code if user.role else "DOCTOR",
        },
    }


def refresh_session(*, refresh_token):
    if not refresh_token:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Thiếu refresh token.",
        )

    try:
        refresh = RefreshToken(refresh_token)
        user = User.objects.get(id=refresh["user_id"])
    except (TokenError, User.DoesNotExist) as exc:
        raise AuthServiceError(
            "UNAUTHORIZED",
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
            status=401,
        ) from exc

    if user.status == "LOCKED":
        raise AuthServiceError(
            "ACCOUNT_LOCKED",
            "Tài khoản đã bị khóa.",
            status=403,
        )

    new_refresh = RefreshToken.for_user(user)
    return {
        "token": str(new_refresh.access_token),
        "refreshToken": str(new_refresh),
    }
