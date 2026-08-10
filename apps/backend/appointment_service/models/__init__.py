"""Appointment domain models and stable public exports."""

from .appointment import Appointment, MedicalRecord
from .doctor_slot import (
    DEFAULT_SLOT_CAPACITY,
    DEFAULT_SLOT_DURATION_MINUTES,
    DEFAULT_SLOT_HOURS,
    ONLINE_BOOKING_LEAD_TIME_MINUTES,
    DoctorSlot,
)

__all__ = [
    'Appointment',
    'DEFAULT_SLOT_CAPACITY',
    'DEFAULT_SLOT_DURATION_MINUTES',
    'DEFAULT_SLOT_HOURS',
    'DoctorSlot',
    'MedicalRecord',
    'ONLINE_BOOKING_LEAD_TIME_MINUTES',
]
