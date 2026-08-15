from django.contrib.auth.hashers import make_password

from ..models import Role, User


def create_user(
    *,
    role_code="DOCTOR",
    username="user",
    password="secret123",
    status="ACTIVE",
    email=None,
):
    role, _ = Role.objects.get_or_create(
        code=role_code,
        defaults={"name": role_code.title()},
    )
    return User.objects.create(
        role=role,
        username=username,
        email=email or f"{username}@example.com",
        password_hash=make_password(password),
        full_name=username.title(),
        phone="0900000000",
        status=status,
    )
