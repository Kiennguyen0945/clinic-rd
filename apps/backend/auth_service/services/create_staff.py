import secrets
import string

from django.contrib.auth.hashers import make_password

from ..models import User
from ..selectors.role_queries import get_role_by_code
from . import AuthServiceError

STAFF_ROLE_CODES = {"RECEPTIONIST", "DOCTOR"}


def create_staff(*, username, full_name, phone, role_code, password=None):
    if not username or not full_name or role_code not in STAFF_ROLE_CODES:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            details={
                "username": "Bắt buộc",
                "fullName": "Bắt buộc",
                "roleCode": "Phải là RECEPTIONIST hoặc DOCTOR",
            },
        )
    if User.objects.filter(username=username).exists():
        raise AuthServiceError(
            "DUPLICATE_USERNAME",
            "Tên đăng nhập đã tồn tại",
        )

    role = get_role_by_code(role_code)
    if role is None:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Vai trò không hợp lệ",
            details={"roleCode": "Không tồn tại"},
        )

    generated_password = password or "".join(
        secrets.choice(string.ascii_letters + string.digits) for _ in range(8)
    )
    user = User.objects.create(
        username=username,
        full_name=full_name,
        phone=phone or "",
        role=role,
        status="ACTIVE",
        password_hash=make_password(generated_password),
    )
    return user, generated_password
