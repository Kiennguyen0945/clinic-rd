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
from .staff_names import format_staff_name

STAFF_ROLE_CODES = {"RECEPTIONIST", "DOCTOR"}


@transaction.atomic
def create_staff(
    *,
    username,
    full_name,
    email,
    phone,
    gender="",
    date_of_birth=None,
    address="",
    role_code,
    password=None,
    department_id=None,
    room_id=None,
):
    if not username or not full_name or not email or role_code not in STAFF_ROLE_CODES:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Thông tin nhân viên không hợp lệ",
            details={
                "username": "Trường này là bắt buộc",
                "fullName": "Trường này là bắt buộc",
                "email": "Trường này là bắt buộc",
                "roleCode": "Vai trò phải là lễ tân hoặc bác sĩ",
            },
        )
    if User.objects.filter(username=username).exists():
        raise AuthServiceError(
            "DUPLICATE_USERNAME",
            "Tên đăng nhập đã tồn tại",
        )
    if User.objects.filter(email__iexact=email).exists():
        raise AuthServiceError("DUPLICATE_EMAIL", "Email đã tồn tại")

    role = get_role_by_code(role_code)
    if role is None:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Vai trò không hợp lệ",
            details={"roleCode": "Vai trò không tồn tại"},
        )

    department = None
    if role_code == "DOCTOR":
        if not department_id:
            raise AuthServiceError(
                "VALIDATION_ERROR",
                "Thông tin nhân viên không hợp lệ",
                details={"departmentId": "Bác sĩ phải được phân khoa"},
            )
        try:
            department = Department.objects.get(pk=department_id)
        except (Department.DoesNotExist, ValueError, TypeError) as exc:
            raise AuthServiceError(
                "VALIDATION_ERROR",
                "Thông tin nhân viên không hợp lệ",
                details={"departmentId": "Khoa không tồn tại"},
            ) from exc

    generated_password = password or "".join(
        secrets.choice(string.ascii_letters + string.digits) for _ in range(8)
    )
    user = User.objects.create(
        username=username,
        email=email.lower(),
        full_name=format_staff_name(full_name, role_code),
        phone=phone or "",
        gender=gender or "",
        date_of_birth=date_of_birth,
        address=address or "",
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
