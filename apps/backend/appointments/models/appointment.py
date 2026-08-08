# ruff: noqa: RUF012

from django.db import models

from auth_service.models import User
from organization_service.models import Department
from patient_service.models import Patient

from .doctor_slot import DoctorSlot


class Appointment(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("CONFIRMED", "Confirmed"),
        ("WAITING", "Waiting"),
        ("IN_PROGRESS", "In progress"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
    ]
    BOOKING_TYPE_CHOICES = [("SCHEDULE", "Schedule"), ("WALK_IN", "Walk in")]
    PATIENT_TYPE_CHOICES = [("BHYT", "BHYT"), ("SERVICE", "Service")]
    CANCELLATION_REASON_CODES = (
        "PATIENT_REQUEST",
        "PATIENT_WRONG_INFO",
        "NO_SHOW",
        "DOCTOR_UNAVAILABLE",
        "ROOM_ISSUE",
        "OTHER",
    )

    slot = models.ForeignKey(
        DoctorSlot,
        on_delete=models.PROTECT,
        related_name="appointments",
        null=True,
        blank=True,
    )
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="appointments",
    )
    doctor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="doctor_appointments",
    )
    creator = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="created_appointments",
    )
    appointment_code = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="appointments",
        null=True,
        blank=True,
    )
    sequence_number = models.PositiveIntegerField(null=True, blank=True)
    booking_type = models.CharField(
        max_length=20,
        choices=BOOKING_TYPE_CHOICES,
        default="SCHEDULE",
    )
    patient_type = models.CharField(
        max_length=20,
        choices=PATIENT_TYPE_CHOICES,
        default="SERVICE",
    )
    bhyt_number = models.CharField(max_length=50, blank=True, null=True)
    cancellation_reason = models.TextField(blank=True, default="")
    appointment_time = models.DateTimeField()
    check_in_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    cancellation_note = models.TextField(null=True, blank=True, default="")

    def __str__(self):
        return f"Appointment #{self.id}"
