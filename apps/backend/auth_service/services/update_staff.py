from django.db import transaction

from organization_service.models import Department, DoctorDepartment

from ..models import User
from ..selectors.user_queries import get_staff, staff_has_clinical_dependencies
from . import AuthServiceError
from .staff_names import format_staff_name


@transaction.atomic
def update_staff(
    *, user_id, full_name, email, phone, status, gender="", date_of_birth=None,
    address="", department_id=None
):
    user = get_staff(user_id)
    if user is None:
        raise AuthServiceError("EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên", status=404)
    if staff_has_clinical_dependencies(user):
        raise AuthServiceError(
            "EMPLOYEE_LOCKED",
            "Không thể sửa nhân viên đã có dữ liệu khám bệnh hoặc lịch hẹn",
            status=409,
        )
    if not full_name or not email:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Thông tin nhân viên không hợp lệ",
            details={
                "fullName": "Trường này là bắt buộc",
                "email": "Trường này là bắt buộc",
            },
        )
    if status not in dict(User.STATUS_CHOICES):
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Thông tin nhân viên không hợp lệ",
            details={"status": "Trạng thái không hợp lệ"},
        )
    if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
        raise AuthServiceError("DUPLICATE_EMAIL", "Email đã tồn tại")

    department = None
    if user.role.code == "DOCTOR":
        try:
            department = Department.objects.get(pk=department_id)
        except (Department.DoesNotExist, ValueError, TypeError) as exc:
            raise AuthServiceError(
                "VALIDATION_ERROR",
                "Thông tin nhân viên không hợp lệ",
                details={"departmentId": "Bác sĩ phải được phân vào một khoa hợp lệ"},
            ) from exc

    user.full_name = format_staff_name(full_name, user.role.code)
    user.email = email.lower()
    user.phone = phone or ""
    user.gender = gender or ""
    user.date_of_birth = date_of_birth
    user.address = address or ""
    user.status = status
    user.save(update_fields=[
        "full_name", "email", "phone", "gender", "date_of_birth", "address",
        "status", "updated_at",
    ])

    if department is not None:
        DoctorDepartment.objects.filter(doctor=user).delete()
        DoctorDepartment.objects.create(doctor=user, department=department)
    return get_staff(user.pk)
