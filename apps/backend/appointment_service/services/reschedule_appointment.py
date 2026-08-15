from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from auth_service.models import User
from organization_service.models import Department, DoctorDepartment

from ..models import ONLINE_BOOKING_LEAD_TIME_MINUTES, Appointment, DoctorSlot
from ..selectors.appointment_queries import next_sequence
from ..selectors.slot_queries import (
    materialize_slot,
    reschedule_suggestions,
    slot_capacity,
    slot_datetimes,
)
from . import AppointmentServiceError


def reschedule_appointment(*, appointment, old_slot, new_slot, doctor, department):
    """Apply a validated reschedule while preserving room/day queue semantics."""
    if new_slot.pk != old_slot.pk:
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
                list(DoctorSlot.objects.select_for_update().filter(room_id=room_id, slot_date=slot_date))
            appointment.sequence_number = next_sequence(new_slot)

        appointment.slot = new_slot
        appointment.appointment_time = slot_datetimes(new_slot)[0]
        if appointment.status == 'WAITING' and old_slot.slot_date != new_slot.slot_date:
            appointment.status = 'CONFIRMED'
            appointment.check_in_at = None

    appointment.doctor = doctor
    appointment.department = department
    return appointment


def update_appointment(*, appointment_id, data, now):
    """Validate, lock, and apply every supported appointment update."""
    with transaction.atomic():
        try:
            appointment = Appointment.objects.select_for_update(of=('self',)).select_related(
                'patient', 'doctor', 'slot').get(pk=appointment_id)
        except Appointment.DoesNotExist as exc:
            raise AppointmentServiceError('APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn', status=404) from exc
        if appointment.status not in ('CONFIRMED', 'WAITING'):
            raise AppointmentServiceError('INVALID_STATUS_FOR_UPDATE', 'Không thể đổi lịch ở trạng thái hiện tại', status=409)

        doctor = _resolve_doctor(appointment, data)
        department = _resolve_department(appointment, doctor, data)
        requested_slot = 'slotId' in data or 'slotKey' in data
        if requested_slot:
            if not appointment.slot_id:
                raise AppointmentServiceError('SLOT_APPOINTMENT_REQUIRED', 'Lịch hẹn hiện chưa gắn ca khám')
            old_slot, new_slot = _lock_reschedule_slots(appointment, doctor, data, now)
            if new_slot.pk != old_slot.pk:
                remaining = slot_capacity(new_slot)[1]
                lead = ONLINE_BOOKING_LEAD_TIME_MINUTES if appointment.status == 'CONFIRMED' else 0
                if new_slot.status != 'OPEN' or remaining <= 0 or now + timedelta(minutes=lead) >= slot_datetimes(new_slot)[1]:
                    raise _slot_conflict(appointment, now, doctor.id)
            reschedule_appointment(appointment=appointment, old_slot=old_slot, new_slot=new_slot,
                                   doctor=doctor, department=department)
        elif appointment.slot_id and ({'appointment_time', 'doctorId'} & data.keys()):
            raise AppointmentServiceError('SLOT_APPOINTMENT_IMMUTABLE',
                                          'Lịch đã gắn ca khám không được đổi giờ hoặc đổi bác sĩ')

        if 'appointment_time' in data and not requested_slot:
            appointment_time = data['appointment_time']
            if timezone.is_naive(appointment_time):
                appointment_time = timezone.make_aware(appointment_time, timezone.get_current_timezone())
            if appointment_time <= now:
                raise AppointmentServiceError('PAST_TIME', 'Thời gian hẹn phải trong tương lai')
            appointment.appointment_time = appointment_time
        if 'doctorId' in data and not requested_slot:
            appointment.doctor, appointment.department = doctor, department
        if 'reason' in data:
            appointment.reason = data['reason']
        appointment.save()
        return appointment


def _resolve_doctor(appointment, data):
    if 'doctorId' not in data:
        return appointment.doctor
    try:
        doctor = User.objects.select_related('role').get(pk=data['doctorId'])
    except User.DoesNotExist as exc:
        raise AppointmentServiceError('DOCTOR_NOT_FOUND', 'Không tìm thấy bác sĩ', status=404) from exc
    if getattr(getattr(doctor, 'role', None), 'code', None) != 'DOCTOR':
        raise AppointmentServiceError('DOCTOR_NOT_FOUND', 'Không tìm thấy bác sĩ', status=404)
    if doctor.status != 'ACTIVE':
        raise AppointmentServiceError(
            'DOCTOR_ACCOUNT_LOCKED', 'Tài khoản bác sĩ đã bị khóa', status=409
        )
    return doctor


def _resolve_department(appointment, doctor, data):
    if 'departmentId' not in data:
        return appointment.department
    if data['departmentId'] is None:
        return None
    try:
        department = Department.objects.get(pk=data['departmentId'])
    except Department.DoesNotExist as exc:
        raise AppointmentServiceError('DEPARTMENT_NOT_FOUND', 'Không tìm thấy khoa', status=404) from exc
    if not DoctorDepartment.objects.filter(doctor=doctor, department=department).exists():
        raise AppointmentServiceError('DOCTOR_DEPARTMENT_MISMATCH', 'Bác sĩ không thuộc khoa đã chọn')
    return department


def _lock_reschedule_slots(appointment, doctor, data, now):
    slot_key = (data.get('slotKey') or '').strip()
    new_slot = DoctorSlot.objects.filter(pk=data.get('slotId')).first() if data.get('slotId') is not None else None
    if new_slot is None and slot_key:
        new_slot = materialize_slot(slot_key, doctor, persist=False)
    if new_slot is None:
        raise _slot_conflict(appointment, now, doctor.id)
    if new_slot.doctor_id != doctor.id:
        raise AppointmentServiceError('SLOT_DOCTOR_MISMATCH', 'Ca khám không thuộc bác sĩ đã chọn')
    ids = sorted({appointment.slot_id, new_slot.pk} - {None})
    locked = {slot.id: slot for slot in DoctorSlot.objects.select_for_update().select_related(
        'doctor', 'room').filter(pk__in=ids)}
    old_slot = locked.get(appointment.slot_id)
    if old_slot is None:
        raise AppointmentServiceError('SLOT_NOT_FOUND', 'Không tìm thấy ca khám cũ', status=404)
    if new_slot.pk:
        new_slot = locked.get(new_slot.pk)
    else:
        new_slot = materialize_slot(slot_key, doctor, persist=True)
        if new_slot:
            new_slot = DoctorSlot.objects.select_for_update().select_related('doctor', 'room').get(pk=new_slot.pk)
    if new_slot is None:
        raise _slot_conflict(appointment, now, doctor.id)
    return old_slot, new_slot


def _slot_conflict(appointment, now, doctor_id):
    suggestions = reschedule_suggestions(doctor_id, now, appointment.status)
    return AppointmentServiceError('SLOT_NOT_AVAILABLE', 'Khung giờ mới không còn hợp lệ', status=409,
                                   details={'suggestedSlots': suggestions,
                                            'suggestedSlot': suggestions[0] if suggestions else None})
