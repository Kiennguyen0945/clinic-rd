from django.db import models

from .department import Department


class Room(models.Model):
    room_number = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, default="")
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="rooms",
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.room_number
