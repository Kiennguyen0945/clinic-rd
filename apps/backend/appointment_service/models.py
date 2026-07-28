from datetime import datetime, timedelta

from django.core.exceptions import ValidationError
from django.db import models
from patient_service.models import Patient
from auth_service.models import User
from organization_service.models import Department, Room


DEFAULT_SLOT_DURATION_MINUTES = 60
DEFAULT_SLOT_CAPACITY = 4
ONLINE_BOOKING_LEAD_TIME_MINUTES = 30


class DoctorSlot(models.Model):
    STATUS_CHOICES = [("OPEN", "Open"), ("CLOSED", "Closed")]

    doctor = models.ForeignKey(User, on_delete=models.PROTECT, related_name="doctor_slots")
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="doctor_slots")
    slot_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    capacity = models.PositiveIntegerField(default=DEFAULT_SLOT_CAPACITY)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="OPEN")

    def clean(self):
        super().clean()
        start = datetime.combine(self.slot_date, self.start_time)
        end = datetime.combine(self.slot_date, self.end_time)

        if end <= start:
            raise ValidationError({'end_time': 'Giờ kết thúc phải sau giờ bắt đầu.'})
        if end - start != timedelta(minutes=DEFAULT_SLOT_DURATION_MINUTES):
            raise ValidationError({'end_time': 'Mỗi ca khám phải kéo dài đúng 60 phút.'})
        if self.start_time.minute != 0 or self.end_time.minute != 0:
            raise ValidationError({'start_time': 'Ca khám phải bắt đầu theo mốc tròn giờ.'})

        overlaps = DoctorSlot.objects.filter(
            doctor_id=self.doctor_id,
            slot_date=self.slot_date,
            start_time__lt=self.end_time,
            end_time__gt=self.start_time,
        )
        if self.pk:
            overlaps = overlaps.exclude(pk=self.pk)
        if overlaps.exists():
            raise ValidationError('Ca khám của bác sĩ bị trùng với một ca đã tồn tại.')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["doctor", "slot_date", "start_time", "end_time"], name="unique_doctor_slot_time"),
            models.CheckConstraint(condition=models.Q(end_time__gt=models.F("start_time")), name="doctor_slot_end_after_start"),
            models.CheckConstraint(condition=models.Q(capacity__gt=0), name="doctor_slot_positive_capacity"),
        ]


class Appointment(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"), ("CONFIRMED", "Confirmed"),
        ("WAITING", "Waiting"), ("IN_PROGRESS", "In progress"),
        ("COMPLETED", "Completed"), ("CANCELLED", "Cancelled"),
    ]
    BOOKING_TYPE_CHOICES = [("SCHEDULE", "Schedule"), ("WALK_IN", "Walk in")]
    PATIENT_TYPE_CHOICES = [("BHYT", "BHYT"), ("SERVICE", "Service")]
    CANCELLATION_REASON_CODES = (
        'PATIENT_REQUEST', 'PATIENT_WRONG_INFO', 'NO_SHOW',
        'DOCTOR_UNAVAILABLE', 'ROOM_ISSUE', 'OTHER',
    )
    CHECK_IN_AT_CHOICES = [
        ("NULL", "Null"), ("NOW", "Now"),
    ]

    slot = models.ForeignKey(DoctorSlot, on_delete=models.PROTECT, related_name="appointments", null=True, blank=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    doctor = models.ForeignKey(User, on_delete=models.PROTECT, related_name="doctor_appointments")
    creator = models.ForeignKey(User, on_delete=models.PROTECT, related_name="created_appointments")
    appointment_code = models.CharField(max_length=50, unique=True, null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="appointments", null=True, blank=True)
    sequence_number = models.PositiveIntegerField(null=True, blank=True)
    booking_type = models.CharField(max_length=20, choices=BOOKING_TYPE_CHOICES, default="SCHEDULE")
    patient_type = models.CharField(max_length=20, choices=PATIENT_TYPE_CHOICES, default="SERVICE")
    bhyt_number = models.CharField(max_length=50, blank=True, null=True)
    cancellation_reason = models.TextField(blank=True, default="")
    appointment_time = models.DateTimeField()
    check_in_at = models.CharField(max_length=20, choices=CHECK_IN_AT_CHOICES, default="NULL")
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    cancellation_note = models.TextField(null=True, blank=True, default="")

    def __str__(self):
        return f"Appointment #{self.id}"


class MedicalRecord(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="medical_record")
    symptoms = models.TextField()
    diagnosis = models.TextField()
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Medical Record #{self.id}"
