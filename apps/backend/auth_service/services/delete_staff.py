from django.db import transaction
from django.db.models.deletion import ProtectedError

from appointment_service.models import DoctorSlot
from organization_service.models import DoctorDepartment

from ..selectors.user_queries import get_staff, staff_has_clinical_dependencies
from . import AuthServiceError


@transaction.atomic
def delete_staff(*, user_id):
    user = get_staff(user_id)
    if user is None:
        raise AuthServiceError("EMPLOYEE_NOT_FOUND", "Employee not found", status=404)
    if staff_has_clinical_dependencies(user):
        raise AuthServiceError(
            "EMPLOYEE_LOCKED",
            "Employee cannot be deleted after clinical activity",
            status=409,
        )

    DoctorDepartment.objects.filter(doctor=user).delete()
    DoctorSlot.objects.filter(doctor=user).delete()
    try:
        user.delete()
    except ProtectedError as exc:
        raise AuthServiceError(
            "EMPLOYEE_LOCKED",
            "Employee cannot be deleted because related data exists",
            status=409,
        ) from exc
