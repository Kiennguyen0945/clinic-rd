from django.db.models import QuerySet

from ..models import Department, DoctorDepartment, Room


def departments() -> QuerySet[Department]:
    return Department.objects.order_by("name", "id")


def rooms() -> QuerySet[Room]:
    return Room.objects.order_by("room_number", "id")


def doctor_departments(*, doctor_id: int | None = None) -> QuerySet[DoctorDepartment]:
    queryset = DoctorDepartment.objects.select_related("doctor", "department").order_by(
        "doctor__full_name", "department__name", "id"
    )
    if doctor_id is not None:
        queryset = queryset.filter(doctor_id=doctor_id)
    return queryset
