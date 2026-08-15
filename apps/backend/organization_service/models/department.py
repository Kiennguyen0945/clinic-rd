from django.db import models


class Department(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)

    @property
    def has_appointments(self):
        return self.appointments.exists() or self.rooms.filter(
            doctor_slots__appointments__isnull=False
        ).exists()

    def __str__(self):
        return self.name
