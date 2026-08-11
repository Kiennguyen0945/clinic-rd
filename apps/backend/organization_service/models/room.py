from django.db import models


class Room(models.Model):
    room_number = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.room_number
