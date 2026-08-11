from django.contrib.auth.hashers import make_password

from auth_service.models import Role, User
from patient_service.models import Patient


def create_user(*, role_code: str, username: str) -> User:
    role, _ = Role.objects.get_or_create(
        code=role_code,
        defaults={"name": role_code.title()},
    )
    return User.objects.create(
        username=username,
        password_hash=make_password("Test@123"),
        full_name=f"{role_code.title()} Test",
        phone="0900000000",
        role=role,
        status="ACTIVE",
    )


def create_patient(**overrides) -> Patient:
    data = {
        "patient_code": "BN-00000001",
        "full_name": "Test Patient",
        "dob": "1990-01-01",
        "gender": "M",
        "phone": "0900000001",
        "address": "Test address",
    }
    data.update(overrides)
    return Patient.objects.create(**data)
