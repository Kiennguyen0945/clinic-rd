"""Backward-compatible exports for the appointment background tasks."""

from .tasks import (
    cancel_confirmed_no_shows,
    cancel_expired_waiting,
    generate_doctor_slots,
)

__all__ = [
    'cancel_confirmed_no_shows',
    'cancel_expired_waiting',
    'generate_doctor_slots',
]
