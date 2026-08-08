"""Appointment rescheduling use case."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from appointments.models import ONLINE_BOOKING_LEAD_TIME_MINUTES, DoctorSlot
from appointments.selectors.appointment_queries import next_sequence
from appointments.selectors.slot_queries import (
    reschedule_suggestions,
    slot_capacity,
    slot_datetimes,
)

from . import AppointmentServiceError
from .create_appointment import materialize_slot


def _slot_conflict(appointment, *, doctor_id, now=None):
    now = now or timezone.now()
    suggestions = reschedule_suggestions(
        doctor_id,
        now,
        appointment.status,
    )
    raise AppointmentServiceError(
        "SLOT_NOT_AVAILABLE",
        "Khung giờ mới không còn hợp lệ",
        status=409,
        details={
            "suggestedSlots": suggestions,
            "suggestedSlot": suggestions[0] if suggestions else None,
        },
    )


@transaction.atomic
def reschedule_appointment(
    *,
    appointment,
    target_doctor,
    department,
    requested_slot_id=None,
    requested_slot_key="",
):
    """Move a locked appointment to another slot and allocation scope."""
    if not appointment.slot_id:
        raise AppointmentServiceError(
            "SLOT_APPOINTMENT_REQUIRED",
            "Lịch hẹn hiện chưa gắn ca khám",
        )

    requested_slot_key = requested_slot_key.strip()
    new_slot = None
    if requested_slot_id is not None:
        new_slot = DoctorSlot.objects.filter(pk=requested_slot_id).first()
    elif requested_slot_key:
        new_slot = materialize_slot(
            requested_slot_key,
            target_doctor,
            persist=False,
        )
    if new_slot is None:
        _slot_conflict(appointment, doctor_id=target_doctor.id)
    if new_slot.doctor_id != target_doctor.id:
        raise AppointmentServiceError(
            "SLOT_DOCTOR_MISMATCH",
            "Ca khám không thuộc bác sĩ đã chọn",
        )

    old_slot_id = appointment.slot_id
    slot_ids = sorted({old_slot_id, new_slot.pk} - {None})
    locked_slots = {
        slot.id: slot
        for slot in (
            DoctorSlot.objects.select_for_update()
            .select_related("doctor", "room")
            .filter(pk__in=slot_ids)
        )
    }
    old_slot = locked_slots.get(old_slot_id)
    if old_slot is None:
        raise AppointmentServiceError(
            "SLOT_NOT_FOUND",
            "Không tìm thấy ca khám cũ",
            status=404,
        )

    if new_slot.pk:
        new_slot = locked_slots.get(new_slot.pk)
    else:
        new_slot = materialize_slot(
            requested_slot_key,
            target_doctor,
            persist=True,
        )
        if new_slot is not None:
            new_slot = (
                DoctorSlot.objects.select_for_update()
                .select_related("doctor", "room")
                .get(pk=new_slot.pk)
            )
    if new_slot is None:
        _slot_conflict(appointment, doctor_id=target_doctor.id)

    if new_slot.pk != old_slot.pk:
        remaining_capacity = slot_capacity(new_slot)[1]
        now = timezone.now()
        _, new_end = slot_datetimes(new_slot)
        lead_time = (
            ONLINE_BOOKING_LEAD_TIME_MINUTES
            if appointment.status == "CONFIRMED"
            else 0
        )
        if (
            new_slot.status != "OPEN"
            or remaining_capacity <= 0
            or now + timedelta(minutes=lead_time) >= new_end
        ):
            _slot_conflict(appointment, doctor_id=target_doctor.id, now=now)

        sequence_changed = (
            old_slot.room_id != new_slot.room_id
            or old_slot.slot_date != new_slot.slot_date
        )
        if sequence_changed:
            scopes = {
                (old_slot.room_id, old_slot.slot_date),
                (new_slot.room_id, new_slot.slot_date),
            }
            for room_id, slot_date in scopes:
                list(DoctorSlot.objects.select_for_update().filter(
                    room_id=room_id,
                    slot_date=slot_date,
                ))
            appointment.sequence_number = next_sequence(new_slot)

        appointment.slot = new_slot
        appointment.appointment_time = slot_datetimes(new_slot)[0]
        if (
            appointment.status == "WAITING"
            and old_slot.slot_date != new_slot.slot_date
        ):
            appointment.status = "CONFIRMED"
            appointment.check_in_at = None

    appointment.doctor = target_doctor
    appointment.department = department
    appointment.save()
    return appointment
