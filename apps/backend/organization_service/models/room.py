from django.db import models

from auth_service.models import User

from .department import Department


class Room(models.Model):
    room_number = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, default="")
    doctor = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        related_name="assigned_room",
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="rooms",
        null=True,
        blank=True,
    )

    @property
    def has_appointments(self):
        return self.doctor_slots.filter(appointments__isnull=False).exists()

    def __str__(self):
        return self.room_number
