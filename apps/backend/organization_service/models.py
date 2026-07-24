from django.db import models
from auth_service.models import User


class Department(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class Room(models.Model):
    room_number = models.CharField(max_length=50, unique=True)
    room_name = models.CharField(max_length=150, unique=True)

    def __str__(self):
        return self.room_number


class DoctorDepartment(models.Model):
    doctor = models.ForeignKey(User, on_delete=models.PROTECT, related_name="department_assignments")
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="doctor_assignments")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["doctor", "department"], name="unique_doctor_department"),
        ]
