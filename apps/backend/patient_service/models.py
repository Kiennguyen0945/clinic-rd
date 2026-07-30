# ruff: noqa: RUF012

from django.db import models


class Patient(models.Model):
    GENDER_CHOICES = [
        ("M", "Male"),
        ("F", "Female"),
        ("O", "Other"),
    ]

    patient_code = models.CharField(max_length=50, unique=True)
    full_name = models.CharField(max_length=150)
    dob = models.DateField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    phone = models.CharField(max_length=20)
    email = models.EmailField(max_length=254, blank=True, null=True)
    address = models.TextField()
    insurance_number = models.CharField(max_length=50, blank=True, null=True)
    cccd = models.CharField(max_length=12, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.patient_code} - {self.full_name}"

# Create your models here.
