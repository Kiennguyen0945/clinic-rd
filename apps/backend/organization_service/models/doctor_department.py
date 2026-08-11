# ruff: noqa: RUF012

from django.db import models

from auth_service.models import User

from .department import Department


class DoctorDepartment(models.Model):
    doctor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="department_assignments",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name="doctor_assignments",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "department"],
                name="unique_doctor_department",
            ),
        ]

    def __str__(self):
        return f"{self.doctor} - {self.department}"
