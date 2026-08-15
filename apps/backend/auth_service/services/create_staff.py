import secrets
import string
from datetime import time, timedelta

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone

from appointment_service.models import DEFAULT_SLOT_HOURS
from organization_service.models import Department, DoctorDepartment

from ..models import User
from ..selectors.role_queries import get_role_by_code
from . import AuthServiceError
from .allocate_doctor_room import allocate_doctor_room

STAFF_ROLE_CODES = {"RECEPTIONIST", "DOCTOR"}


@transaction.atomic
def create_staff(
    *,
    username,
    full_name,
    email,
    phone,
    role_code,
    password=None,
    department_id=None,
    room_id=None,
):
    if not username or not full_name or not email or role_code not in STAFF_ROLE_CODES:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Invalid employee data",
            details={
                "username": "This field is required",
                "fullName": "This field is required",
                "email": "This field is required",
                "roleCode": "Must be RECEPTIONIST or DOCTOR",
            },
        )
    if User.objects.filter(username=username).exists():
        raise AuthServiceError(
            "DUPLICATE_USERNAME",
            "Username already exists",
        )
    if User.objects.filter(email__iexact=email).exists():
        raise AuthServiceError("DUPLICATE_EMAIL", "Email already exists")

    role = get_role_by_code(role_code)
    if role is None:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Invalid role",
            details={"roleCode": "Role does not exist"},
        )

    department = None
    if role_code == "DOCTOR":
        if not department_id:
            raise AuthServiceError(
                "VALIDATION_ERROR",
                "Invalid employee data",
                details={"departmentId": "This field is required for doctors"},
            )
        try:
            department = Department.objects.get(pk=department_id)
        except (Department.DoesNotExist, ValueError, TypeError) as exc:
            raise AuthServiceError(
                "VALIDATION_ERROR",
                "Invalid employee data",
                details={"departmentId": "Department does not exist"},
            ) from exc

    generated_password = password or "".join(
        secrets.choice(string.ascii_letters + string.digits) for _ in range(8)
    )
    user = User.objects.create(
        username=username,
        email=email.lower(),
        full_name=full_name,
        phone=phone or "",
        role=role,
        status="ACTIVE",
        password_hash=make_password(generated_password),
    )
    if department is not None:
        DoctorDepartment.objects.create(doctor=user, department=department)
    allocation = None
    if room_id:
        allocation = allocate_doctor_room(
            doctor_id=user.id,
            room_id=room_id,
            slot_date=timezone.localdate() + timedelta(days=1),
            start_time=time(min(DEFAULT_SLOT_HOURS)),
            end_time=time(max(DEFAULT_SLOT_HOURS) + 1),
        )
    return user, generated_password, allocation
