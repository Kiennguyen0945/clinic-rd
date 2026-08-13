"""Verify manager access tokens issued by Clinic Core."""

from dataclasses import dataclass

import jwt
from django.conf import settings


class ManagerAuthenticationError(ValueError):
    status_code = 401


class ManagerPermissionError(ManagerAuthenticationError):
    status_code = 403


@dataclass(frozen=True)
class ManagerIdentity:
    user_id: str
    role: str


def authenticate_manager(request):
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token or not settings.CORE_JWT_SIGNING_KEY:
        raise ManagerAuthenticationError("Thiếu hoặc sai access token")

    try:
        payload = jwt.decode(
            token,
            settings.CORE_JWT_SIGNING_KEY,
            algorithms=[settings.CORE_JWT_ALGORITHM],
            options={"require": ["exp", "user_id", "token_type"]},
        )
    except jwt.PyJWTError as exc:
        raise ManagerAuthenticationError("Access token không hợp lệ hoặc đã hết hạn") from exc

    if payload.get("token_type") != "access":
        raise ManagerAuthenticationError("Chỉ chấp nhận access token")
    if payload.get("role") != "MANAGER":
        raise ManagerPermissionError("Chỉ quản lý được đồng bộ báo cáo")

    return ManagerIdentity(user_id=str(payload["user_id"]), role=payload["role"])
