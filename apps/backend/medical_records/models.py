from django.db import models

from appointments.models import Appointment
from auth_service.models import User


class MedicalRecord(models.Model):
    STATUS_CHOICES = (('DRAFT', 'Draft'), ('SIGNED', 'Signed'))

    appointment = models.OneToOneField(
        Appointment,
        on_delete=models.CASCADE,
        related_name='medical_record',
    )
    illness_history = models.TextField(blank=True, default='')
    vital_signs = models.TextField(blank=True, default='')
    examination_note = models.TextField(blank=True, default='')
    diagnosis = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT')
    signed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='signed_medical_records',
        null=True,
        blank=True,
    )
    signed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Medical Record #{self.id}'


class Prescription(models.Model):
    medical_record = models.OneToOneField(
        MedicalRecord,
        on_delete=models.CASCADE,
        related_name='prescription',
    )
    prescribed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='prescriptions',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Prescription #{self.id}'


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(
        Prescription,
        on_delete=models.CASCADE,
        related_name='items',
    )
    medication_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=255)
    duration_days = models.PositiveIntegerField()
    quantity = models.PositiveIntegerField()
    instructions = models.TextField(blank=True, default='')

    def __str__(self):
        return f'{self.medication_name} ({self.quantity})'
