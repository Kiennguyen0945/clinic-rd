from django.db import transaction

from organization_service.models import Department, DoctorDepartment

from ..models import User
from ..selectors.user_queries import get_staff, staff_has_clinical_dependencies
from . import AuthServiceError


@transaction.atomic
def update_staff(
    *, user_id, full_name, email, phone, status, department_id=None
):
    user = get_staff(user_id)
    if user is None:
        raise AuthServiceError("EMPLOYEE_NOT_FOUND", "Employee not found", status=404)
    if staff_has_clinical_dependencies(user):
        raise AuthServiceError(
            "EMPLOYEE_LOCKED",
            "Employee information cannot be changed after clinical activity",
            status=409,
        )
    if not full_name or not email:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Invalid employee data",
            details={
                "fullName": "This field is required",
                "email": "This field is required",
            },
        )
    if status not in dict(User.STATUS_CHOICES):
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Invalid employee data",
            details={"status": "Invalid status"},
        )
    if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
        raise AuthServiceError("DUPLICATE_EMAIL", "Email already exists")

    department = None
    if user.role.code == "DOCTOR":
        try:
            department = Department.objects.get(pk=department_id)
        except (Department.DoesNotExist, ValueError, TypeError) as exc:
            raise AuthServiceError(
                "VALIDATION_ERROR",
                "Invalid employee data",
                details={"departmentId": "A valid department is required for doctors"},
            ) from exc

    user.full_name = full_name
    user.email = email.lower()
    user.phone = phone or ""
    user.status = status
    user.save(update_fields=["full_name", "email", "phone", "status", "updated_at"])

    if department is not None:
        DoctorDepartment.objects.filter(doctor=user).delete()
        DoctorDepartment.objects.create(doctor=user, department=department)
    return get_staff(user.pk)
