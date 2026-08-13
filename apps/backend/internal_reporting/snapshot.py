"""Snapshot composition for Reporting Service synchronization."""

from django.utils import timezone

from .selectors import (
    appointment_statistics,
    employee_summary,
    organization_summary,
)


def build_reporting_snapshot(*, date_from, date_to, generated_at=None):
    appointments_by_date, appointments_by_doctor = appointment_statistics(
        date_from,
        date_to,
    )
    generated_at = generated_at or timezone.now()
    return {
        "generatedAt": generated_at.isoformat().replace("+00:00", "Z"),
        "period": {
            "dateFrom": date_from.isoformat(),
            "dateTo": date_to.isoformat(),
        },
        "appointmentsByDate": appointments_by_date,
        "appointmentsByDoctor": appointments_by_doctor,
        "employees": employee_summary(),
        "organization": organization_summary(),
    }
