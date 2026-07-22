from django.db import models
from patient_service.models import Patient
from auth_service.models import User
from organization_service.models import Department, Room


class DoctorSlot(models.Model):
    STATUS_CHOICES = [("AVAILABLE", "Available"), ("FULL", "Full"), ("CANCELLED", "Cancelled")]

    doctor = models.ForeignKey(User, on_delete=models.PROTECT, related_name="doctor_slots")
    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="doctor_slots")
    slot_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    capacity = models.PositiveIntegerField(default=5)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="AVAILABLE")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["doctor", "slot_date", "start_time", "end_time"], name="unique_doctor_slot_time"),
            models.CheckConstraint(condition=models.Q(end_time__gt=models.F("start_time")), name="doctor_slot_end_after_start"),
        ]


class Appointment(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"), ("CONFIRMED", "Confirmed"),
        ("COMPLETED", "Completed"), ("CANCELLED", "Cancelled"),
    ]
    BOOKING_TYPE_CHOICES = [("SCHEDULE", "Schedule"), ("WALK_IN", "Walk in")]
    PATIENT_TYPE_CHOICES = [("BHYT", "BHYT"), ("SERVICE", "Service")]

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
    appointment_time = models.DateTimeField()
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
