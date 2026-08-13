"""Cross-domain, read-only aggregates exposed to Reporting Service."""

from django.db.models import Count, Q
from django.db.models.functions import TruncDate

from appointment_service.models import Appointment
from auth_service.models import User
from organization_service.models import Department, Room


def appointment_statistics(date_from, date_to):
    appointments = Appointment.objects.filter(
        appointment_time__date__range=(date_from, date_to),
    )
    status_counts = {
        "pending": Count("id", filter=Q(status="PENDING")),
        "confirmed": Count("id", filter=Q(status="CONFIRMED")),
        "waiting": Count("id", filter=Q(status="WAITING")),
        "in_progress": Count("id", filter=Q(status="IN_PROGRESS")),
        "completed": Count("id", filter=Q(status="COMPLETED")),
        "cancelled": Count("id", filter=Q(status="CANCELLED")),
    }

    daily_rows = (
        appointments.annotate(date=TruncDate("appointment_time"))
        .values("date")
        .annotate(total=Count("id"), **status_counts)
        .order_by("date")
    )
    doctor_rows = (
        appointments.annotate(date=TruncDate("appointment_time"))
        .values("date", "doctor_id")
        .annotate(
            total=Count("id"),
            completed=Count("id", filter=Q(status="COMPLETED")),
            cancelled=Count("id", filter=Q(status="CANCELLED")),
        )
        .order_by("date", "doctor_id")
    )

    appointments_by_date = [
        {
            "date": row["date"].isoformat(),
            "total": row["total"],
            "pending": row["pending"],
            "confirmed": row["confirmed"],
            "waiting": row["waiting"],
            "inProgress": row["in_progress"],
            "completed": row["completed"],
            "cancelled": row["cancelled"],
        }
        for row in daily_rows
    ]
    appointments_by_doctor = [
        {
            "date": row["date"].isoformat(),
            "doctorId": row["doctor_id"],
            "total": row["total"],
            "completed": row["completed"],
            "cancelled": row["cancelled"],
        }
        for row in doctor_rows
    ]
    return appointments_by_date, appointments_by_doctor


def employee_summary():
    return User.objects.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(status="ACTIVE")),
        locked=Count("id", filter=Q(status="LOCKED")),
        doctors=Count("id", filter=Q(role__code="DOCTOR")),
        receptionists=Count("id", filter=Q(role__code="RECEPTIONIST")),
        managers=Count("id", filter=Q(role__code="MANAGER")),
    )


def organization_summary():
    return {
        "departments": Department.objects.count(),
        "rooms": Room.objects.count(),
    }
