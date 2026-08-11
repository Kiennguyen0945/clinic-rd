from django.db import transaction

from auth_service.models import User

from ..models import Department, DoctorDepartment


@transaction.atomic
def assign_doctor_to_department(
    *, doctor: User, department: Department
) -> tuple[DoctorDepartment, bool]:
    return DoctorDepartment.objects.get_or_create(
        doctor=doctor,
        department=department,
    )
