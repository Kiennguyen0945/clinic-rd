from datetime import datetime, time, timedelta

from django.db import transaction
from django.utils import timezone

from appointment_service.models import Appointment, DoctorSlot
from auth_service.models import User
from organization_service.models import Room


DEFAULT_SLOT_HOURS = tuple(range(6, 17))
SLOT_HORIZON_DAYS = 60


def generate_doctor_slots(today=None, horizon_days=SLOT_HORIZON_DAYS):
    """Ensure every active doctor has hourly slots for the booking horizon."""
    today = today or timezone.localdate()
    end_date = today + timedelta(days=horizon_days - 1)
    doctors = list(User.objects.filter(status='ACTIVE', role__code='DOCTOR').order_by('id'))
    rooms = list(Room.objects.order_by('id'))
    if not doctors or not rooms:
        return 0

    created = 0
    with transaction.atomic():
        for doctor_index, doctor in enumerate(doctors):
            template = (
                DoctorSlot.objects.filter(doctor=doctor)
                .select_related('room')
                .order_by('-slot_date', 'start_time')
                .first()
            )
            room = template.room if template else rooms[doctor_index % len(rooms)]
            slot_hours = tuple(
                row['start_time'].hour
                for row in DoctorSlot.objects.filter(doctor=doctor)
                .values('start_time').distinct().order_by('start_time')
            ) or DEFAULT_SLOT_HOURS
            existing = set(DoctorSlot.objects.filter(
                doctor=doctor, slot_date__range=(today, end_date)
            ).values_list('slot_date', 'start_time'))
            slots = [
                DoctorSlot(
                    doctor=doctor,
                    room=room,
                    slot_date=slot_date,
                    start_time=time(hour),
                    end_time=time(hour + 1),
                    capacity=template.capacity if template else 4,
                    status='OPEN',
                )
                for day_offset in range(horizon_days)
                for slot_date in [today + timedelta(days=day_offset)]
                for hour in slot_hours
                if (slot_date, time(hour)) not in existing
            ]
            DoctorSlot.objects.bulk_create(slots, ignore_conflicts=True)
            created += len(slots)
    return created


def _appointments_until_tomorrow(today, status):
    tomorrow_start = timezone.make_aware(
        datetime.combine(today + timedelta(days=1), time.min),
        timezone.get_current_timezone(),
    )
    return Appointment.objects.filter(status=status, appointment_time__lt=tomorrow_start)


def cancel_confirmed_no_shows(today=None):
    today = today or timezone.localdate()
    return _appointments_until_tomorrow(today, 'CONFIRMED').update(
        status='CANCELLED', cancellation_reason='NO_SHOW', updated_at=timezone.now()
    )


def cancel_expired_waiting(today=None):
    today = today or timezone.localdate()
    return _appointments_until_tomorrow(today, 'WAITING').update(
        status='CANCELLED', cancellation_reason='EXPIRED', updated_at=timezone.now()
    )
