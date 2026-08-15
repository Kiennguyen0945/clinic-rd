from auth_service.models import Role, User


def create_doctor(*, username: str = "doctor") -> User:
    role, _ = Role.objects.get_or_create(code="DOCTOR", defaults={"name": "Doctor"})
    return User.objects.create(
        role=role,
        username=username,
        password_hash="test",
        full_name="Test Doctor",
        phone="0000000000",
    )


def create_staff(*, role_code: str, username: str) -> User:
    role, _ = Role.objects.get_or_create(
        code=role_code,
        defaults={"name": role_code.title()},
    )
    return User.objects.create(
        role=role,
        username=username,
        password_hash="test",
        full_name=username.title(),
        phone="0000000000",
    )
