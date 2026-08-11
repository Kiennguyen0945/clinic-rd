from django.db import models

from auth_service.models import User

from .medical_record import MedicalRecord


class Prescription(models.Model):
    medical_record = models.OneToOneField(
        MedicalRecord,
        on_delete=models.CASCADE,
        related_name="prescription",
    )
    prescribed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="prescriptions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Prescription #{self.id}"


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(
        Prescription,
        on_delete=models.CASCADE,
        related_name="items",
    )
    medication_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=255)
    duration_days = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField()
    instructions = models.TextField(blank=True, default="")

    def __str__(self):
        return f"{self.medication_name} ({self.quantity})"
