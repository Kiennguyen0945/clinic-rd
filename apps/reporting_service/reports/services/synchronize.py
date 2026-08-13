"""Idempotently synchronize Clinic Core aggregates into Reporting."""

from datetime import date, datetime

from django.db import transaction
from django.utils import timezone

from reports.core_client import fetch_core_snapshot
from reports.models import (
    DailyAppointmentStatistic,
    DailyDoctorStatistic,
    SynchronizationRun,
    SystemSummary,
)


class SynchronizationError(RuntimeError):
    pass


def _parse_snapshot_date(value, field_name):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise SynchronizationError(f"Snapshot field {field_name} is invalid") from exc


def _parse_generated_at(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError) as exc:
        raise SynchronizationError("Snapshot generatedAt is invalid") from exc
    if timezone.is_naive(parsed):
        raise SynchronizationError("Snapshot generatedAt must include a timezone")
    return parsed


def _apply_snapshot(snapshot, *, date_from, date_to):
    try:
        period = snapshot["period"]
        if (
            period["dateFrom"] != date_from.isoformat()
            or period["dateTo"] != date_to.isoformat()
        ):
            raise SynchronizationError("Snapshot period does not match the request")
        synchronized_at = _parse_generated_at(snapshot["generatedAt"])
        appointment_rows = snapshot["appointmentsByDate"]
        doctor_rows = snapshot["appointmentsByDoctor"]
        employees = snapshot["employees"]
        organization = snapshot["organization"]
    except (KeyError, TypeError) as exc:
        raise SynchronizationError("Snapshot payload is incomplete") from exc

    appointment_dates = set()
    for row in appointment_rows:
        row_date = _parse_snapshot_date(row.get("date"), "appointmentsByDate.date")
        if not date_from <= row_date <= date_to:
            raise SynchronizationError("Appointment statistic is outside the requested range")
        appointment_dates.add(row_date)
        DailyAppointmentStatistic.objects.update_or_create(
            date=row_date,
            defaults={
                "total": row["total"],
                "pending": row["pending"],
                "confirmed": row["confirmed"],
                "waiting": row["waiting"],
                "in_progress": row["inProgress"],
                "completed": row["completed"],
                "cancelled": row["cancelled"],
                "synchronized_at": synchronized_at,
            },
        )
    DailyAppointmentStatistic.objects.filter(
        date__range=(date_from, date_to),
    ).exclude(date__in=appointment_dates).delete()

    doctor_keys = set()
    for row in doctor_rows:
        row_date = _parse_snapshot_date(row.get("date"), "appointmentsByDoctor.date")
        doctor_id = int(row["doctorId"])
        if not date_from <= row_date <= date_to:
            raise SynchronizationError("Doctor statistic is outside the requested range")
        doctor_keys.add((row_date, doctor_id))
        DailyDoctorStatistic.objects.update_or_create(
            date=row_date,
            doctor_id=doctor_id,
            defaults={
                "total": row["total"],
                "completed": row["completed"],
                "cancelled": row["cancelled"],
                "synchronized_at": synchronized_at,
            },
        )
    for statistic in DailyDoctorStatistic.objects.filter(
        date__range=(date_from, date_to)
    ):
        if (statistic.date, statistic.doctor_id) not in doctor_keys:
            statistic.delete()

    SystemSummary.objects.update_or_create(
        snapshot_date=date_to,
        defaults={
            "employee_total": employees["total"],
            "active_employees": employees["active"],
            "locked_employees": employees["locked"],
            "doctor_total": employees["doctors"],
            "receptionist_total": employees["receptionists"],
            "manager_total": employees["managers"],
            "department_total": organization["departments"],
            "room_total": organization["rooms"],
            "synchronized_at": synchronized_at,
        },
    )


def synchronize_reports(*, date_from, date_to):
    run = SynchronizationRun.objects.create(date_from=date_from, date_to=date_to)
    try:
        snapshot = fetch_core_snapshot(date_from=date_from, date_to=date_to)
        with transaction.atomic():
            _apply_snapshot(snapshot, date_from=date_from, date_to=date_to)
    except Exception as exc:
        run.status = SynchronizationRun.Status.FAILED
        run.finished_at = timezone.now()
        run.error_message = str(exc)[:2000]
        run.save(update_fields=("status", "finished_at", "error_message"))
        if isinstance(exc, SynchronizationError):
            raise
        raise SynchronizationError("Reporting synchronization failed") from exc

    run.status = SynchronizationRun.Status.SUCCESS
    run.finished_at = timezone.now()
    run.save(update_fields=("status", "finished_at"))
    return run
