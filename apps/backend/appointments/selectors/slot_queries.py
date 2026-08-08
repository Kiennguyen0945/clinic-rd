"""Read-side slot queries and slot presentation helpers."""

from datetime import datetime, time, timedelta

from django.utils import timezone

from appointments.models import (
    DEFAULT_SLOT_CAPACITY,
    DEFAULT_SLOT_DURATION_MINUTES,
    DEFAULT_SLOT_HOURS,
    ONLINE_BOOKING_LEAD_TIME_MINUTES,
    DoctorSlot,
)
from organization_service.models import Room


def slot_datetimes(slot):
    timezone_info = timezone.get_current_timezone()
    start = timezone.make_aware(
        datetime.combine(slot.slot_date, slot.start_time),
        timezone_info,
    )
    end = timezone.make_aware(
        datetime.combine(slot.slot_date, slot.end_time),
        timezone_info,
    )
    return start, end


def slot_key(slot):
    """Return a stable key for a persisted or display-only slot."""
    if slot.pk:
        return str(slot.pk)
    return (
        f"virtual:{slot.doctor_id}:{slot.slot_date.isoformat()}:"
        f"{slot.start_time.strftime('%H%M')}:{slot.room_id}"
    )


def slot_capacity(slot):
    if not slot.pk:
        return 0, slot.capacity
    booked_count = slot.appointments.exclude(status="CANCELLED").count()
    return booked_count, max(slot.capacity - booked_count, 0)


def virtual_slots_for_date(doctor, target_date, persisted_slots):
    """Build display-only slots for times without a database row."""
    template = (
        DoctorSlot.objects.filter(doctor=doctor)
        .select_related("room")
        .order_by("-slot_date", "start_time")
        .first()
    )
    rooms = list(Room.objects.order_by("id"))
    room = template.room if template else (
        rooms[(doctor.id - 1) % len(rooms)] if rooms else None
    )
    if not room:
        return list(persisted_slots)

    existing_hours = {slot.start_time.hour for slot in persisted_slots}
    capacity = template.capacity if template else DEFAULT_SLOT_CAPACITY
    virtual_slots = [
        DoctorSlot(
            doctor=doctor,
            room=room,
            slot_date=target_date,
            start_time=time(hour),
            end_time=(
                datetime.combine(target_date, time(hour))
                + timedelta(minutes=DEFAULT_SLOT_DURATION_MINUTES)
            ).time(),
            capacity=capacity,
            status="OPEN",
        )
        for hour in DEFAULT_SLOT_HOURS
        if hour not in existing_hours
    ]
    return sorted(
        [*persisted_slots, *virtual_slots],
        key=lambda slot: slot.start_time,
    )


def slot_is_bookable(now, slot, booking_type, remaining_capacity):
    start, end = slot_datetimes(slot)
    lead_time = 0 if booking_type == "WALK_IN" else ONLINE_BOOKING_LEAD_TIME_MINUTES
    target_time = now + timedelta(minutes=lead_time)
    if booking_type == "WALK_IN":
        time_window_available = start <= now < end
    else:
        time_window_available = target_time < end
    return (
        slot.status == "OPEN"
        and remaining_capacity > 0
        and time_window_available
    )


def slot_payload(slot, booking_type="SCHEDULE"):
    now = timezone.now()
    start, end = slot_datetimes(slot)
    booked_count, remaining_capacity = slot_capacity(slot)
    return {
        "id": slot.id,
        "slotKey": slot_key(slot),
        "doctorId": str(slot.doctor_id),
        "roomId": str(slot.room_id),
        "doctor": {"id": str(slot.doctor_id), "fullName": slot.doctor.full_name},
        "room": {"id": str(slot.room_id), "roomNumber": slot.room.room_number},
        "slotDate": slot.slot_date.isoformat(),
        "startTime": start.isoformat(),
        "endTime": end.isoformat(),
        "capacity": slot.capacity,
        "bookedCount": booked_count,
        "remainingCapacity": remaining_capacity,
        "isFull": remaining_capacity == 0,
        "isBookable": slot_is_bookable(
            now,
            slot,
            booking_type,
            remaining_capacity,
        ),
        "isOngoing": start <= now < end,
        "isEnded": now >= end,
        "status": slot.status,
    }


def next_available_slot(doctor_id, now, booking_type, exclude_slot_id=None):
    candidates = DoctorSlot.objects.select_related("doctor", "room").filter(
        doctor_id=doctor_id,
        status="OPEN",
        slot_date__gte=timezone.localdate(now),
    ).order_by("slot_date", "start_time")
    if booking_type == "WALK_IN":
        candidates = candidates.filter(slot_date=timezone.localdate(now))
    if exclude_slot_id:
        candidates = candidates.exclude(pk=exclude_slot_id)

    for candidate in candidates:
        _, remaining = slot_capacity(candidate)
        if remaining <= 0:
            continue
        _, end = slot_datetimes(candidate)
        if booking_type == "SCHEDULE":
            if now + timedelta(minutes=ONLINE_BOOKING_LEAD_TIME_MINUTES) < end:
                return candidate
        elif end > now:
            return candidate
    return None


def reschedule_suggestions(
    doctor_id,
    now,
    appointment_status,
    exclude_slot_id=None,
):
    candidates = DoctorSlot.objects.select_related("doctor", "room").filter(
        doctor_id=doctor_id,
        status="OPEN",
        slot_date__gte=timezone.localdate(now),
    ).order_by("slot_date", "start_time")
    if exclude_slot_id:
        candidates = candidates.exclude(pk=exclude_slot_id)

    suggestions = []
    lead_time = (
        ONLINE_BOOKING_LEAD_TIME_MINUTES
        if appointment_status == "CONFIRMED"
        else 0
    )
    target_time = now + timedelta(minutes=lead_time)
    for candidate in candidates:
        if slot_capacity(candidate)[1] <= 0:
            continue
        _, end = slot_datetimes(candidate)
        if end <= target_time:
            continue
        suggestions.append(slot_payload(
            candidate,
            "SCHEDULE" if appointment_status == "CONFIRMED" else "WALK_IN",
        ))
        if len(suggestions) == 5:
            break
    return suggestions
