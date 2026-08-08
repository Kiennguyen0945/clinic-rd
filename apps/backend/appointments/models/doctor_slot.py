# ruff: noqa: RUF012

from datetime import datetime, timedelta

from django.core.exceptions import ValidationError
from django.db import models

from auth_service.models import User
from organization_service.models import Room

DEFAULT_SLOT_DURATION_MINUTES = 60
DEFAULT_SLOT_CAPACITY = 4
DEFAULT_SLOT_HOURS = tuple(range(6, 17))
ONLINE_BOOKING_LEAD_TIME_MINUTES = 30


class DoctorSlot(models.Model):
    STATUS_CHOICES = [("OPEN", "Open"), ("CLOSED", "Closed")]

    doctor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="doctor_slots",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="doctor_slots",
    )
    slot_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    capacity = models.PositiveIntegerField(default=DEFAULT_SLOT_CAPACITY)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="OPEN",
    )

    def clean(self):
        super().clean()
        start = datetime.combine(self.slot_date, self.start_time)
        end = datetime.combine(self.slot_date, self.end_time)

        if end <= start:
            raise ValidationError({"end_time": "Giờ kết thúc phải sau giờ bắt đầu."})
        if end - start != timedelta(minutes=DEFAULT_SLOT_DURATION_MINUTES):
            raise ValidationError({"end_time": "Mỗi ca khám phải kéo dài đúng 60 phút."})
        if self.start_time.minute != 0 or self.end_time.minute != 0:
            raise ValidationError({"start_time": "Ca khám phải bắt đầu theo mốc tròn giờ."})

        overlaps = DoctorSlot.objects.filter(
            doctor_id=self.doctor_id,
            slot_date=self.slot_date,
            start_time__lt=self.end_time,
            end_time__gt=self.start_time,
        )
        if self.pk:
            overlaps = overlaps.exclude(pk=self.pk)
        if overlaps.exists():
            raise ValidationError("Ca khám của bác sĩ bị trùng với một ca đã tồn tại.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "slot_date", "start_time", "end_time"],
                name="unique_doctor_slot_time",
            ),
            models.CheckConstraint(
                condition=models.Q(end_time__gt=models.F("start_time")),
                name="doctor_slot_end_after_start",
            ),
            models.CheckConstraint(
                condition=models.Q(capacity__gt=0),
                name="doctor_slot_positive_capacity",
            ),
        ]
