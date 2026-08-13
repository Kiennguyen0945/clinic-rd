from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import User
from ..selectors.user_queries import get_user_by_username
from . import AuthServiceError


def _tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    access["role"] = user.role.code
    return str(access), str(refresh)


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

    access_token, refresh_token = _tokens_for_user(user)
    return {
        "token": access_token,
        "refreshToken": refresh_token,
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

    access_token, new_refresh_token = _tokens_for_user(user)
    return {
        "token": access_token,
        "refreshToken": new_refresh_token,
    }
