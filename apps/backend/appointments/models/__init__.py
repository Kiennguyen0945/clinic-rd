"""Public model API for the appointments domain."""

from .appointment import Appointment
from .doctor_slot import (
    DEFAULT_SLOT_CAPACITY,
    DEFAULT_SLOT_DURATION_MINUTES,
    DEFAULT_SLOT_HOURS,
    ONLINE_BOOKING_LEAD_TIME_MINUTES,
    DoctorSlot,
)

__all__ = [
    "DEFAULT_SLOT_CAPACITY",
    "DEFAULT_SLOT_DURATION_MINUTES",
    "DEFAULT_SLOT_HOURS",
    "ONLINE_BOOKING_LEAD_TIME_MINUTES",
    "Appointment",
    "DoctorSlot",
]
