"""Read-side appointment queries."""

from django.db.models import Max

from appointments.models import Appointment


def appointment_detail(appointment_id):
    return (
        Appointment.objects.select_related(
            "patient",
            "doctor",
            "slot",
            "slot__room",
            "department",
        )
        .filter(pk=appointment_id)
        .first()
    )


def next_sequence(slot):
    current_max = Appointment.objects.filter(
        slot__room_id=slot.room_id,
        slot__slot_date=slot.slot_date,
    ).aggregate(max_sequence=Max("sequence_number"))["max_sequence"] or 0
    return current_max + 1
