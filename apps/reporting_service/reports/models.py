"""Reporting-owned persistence and read models."""

from django.db import models
from django.db.models import Q
from django.utils import timezone


class SynchronizationRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "RUNNING", "Running"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.RUNNING,
    )
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    date_from = models.DateField()
    date_to = models.DateField()
    error_message = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("-started_at",)
        constraints = [
            models.CheckConstraint(
                condition=Q(date_from__lte=models.F("date_to")),
                name="sync_run_valid_date_range",
            ),
        ]


class DailyAppointmentStatistic(models.Model):
    date = models.DateField(unique=True)
    total = models.PositiveIntegerField(default=0)
    pending = models.PositiveIntegerField(default=0)
    confirmed = models.PositiveIntegerField(default=0)
    waiting = models.PositiveIntegerField(default=0)
    in_progress = models.PositiveIntegerField(default=0)
    completed = models.PositiveIntegerField(default=0)
    cancelled = models.PositiveIntegerField(default=0)
    synchronized_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("date",)
        constraints = [
            models.CheckConstraint(
                condition=Q(
                    total=models.F("pending")
                    + models.F("confirmed")
                    + models.F("waiting")
                    + models.F("in_progress")
                    + models.F("completed")
                    + models.F("cancelled")
                ),
                name="daily_appointment_statuses_equal_total",
            ),
        ]


class DailyDoctorStatistic(models.Model):
    date = models.DateField()
    doctor_id = models.PositiveBigIntegerField()
    total = models.PositiveIntegerField(default=0)
    completed = models.PositiveIntegerField(default=0)
    cancelled = models.PositiveIntegerField(default=0)
    synchronized_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("date", "doctor_id")
        constraints = [
            models.UniqueConstraint(
                fields=("date", "doctor_id"),
                name="unique_daily_doctor_statistic",
            ),
            models.CheckConstraint(
                condition=Q(
                    total__gte=models.F("completed") + models.F("cancelled")
                ),
                name="doctor_outcomes_do_not_exceed_total",
            ),
        ]


class SystemSummary(models.Model):
    snapshot_date = models.DateField(unique=True)
    employee_total = models.PositiveIntegerField(default=0)
    active_employees = models.PositiveIntegerField(default=0)
    locked_employees = models.PositiveIntegerField(default=0)
    doctor_total = models.PositiveIntegerField(default=0)
    receptionist_total = models.PositiveIntegerField(default=0)
    manager_total = models.PositiveIntegerField(default=0)
    department_total = models.PositiveIntegerField(default=0)
    room_total = models.PositiveIntegerField(default=0)
    synchronized_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("snapshot_date",)
        verbose_name_plural = "system summaries"
