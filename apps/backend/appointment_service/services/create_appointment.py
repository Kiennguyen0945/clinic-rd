import secrets
import string
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from auth_service.models import User
from organization_service.models import Department, DoctorDepartment
from patient_service.models import Patient

from ..models import ONLINE_BOOKING_LEAD_TIME_MINUTES, Appointment, DoctorSlot
from ..selectors.appointment_queries import next_sequence
from ..selectors.slot_queries import (
    materialize_slot,
    next_available_slot,
    slot_capacity,
    slot_datetimes,
    slot_payload,
)
from . import AppointmentServiceError


def create_appointment(*, slot, patient, doctor, creator, department, data, now, appointment_code):
    """Persist an appointment after the API layer has resolved and locked its slot."""
    booking_type = data.get('bookingType', 'SCHEDULE')
    patient_type = data.get('patientType', 'SERVICE')
    bhyt_number = (data.get('bhytNumber') or '').strip() or None
    appointment = Appointment.objects.create(
        slot=slot,
        patient=patient,
        doctor=doctor,
        creator=creator,
        appointment_code=appointment_code,
        department=department,
        sequence_number=next_sequence(slot),
        booking_type=booking_type,
        patient_type=patient_type,
        bhyt_number=bhyt_number,
        appointment_time=slot_datetimes(slot)[0],
        check_in_at=now if booking_type == 'WALK_IN' else None,
        reason=data.get('reason', ''),
        status='CONFIRMED' if booking_type == 'SCHEDULE' else 'WAITING',
    )
    if patient_type == 'BHYT':
        patient.insurance_number = bhyt_number
        patient.save(update_fields=['insurance_number', 'updated_at'])
    return appointment


def book_appointment(*, patient, doctor, creator, department, data, now, appointment_code_factory):
    """Resolve capacity and timing rules, then create an appointment atomically."""
    booking_type = data.get('bookingType', 'SCHEDULE')
    requested_slot_id = data.get('slotId')
    requested_slot_key = (data.get('slotKey') or '').strip()
    slot = None
    if requested_slot_id is not None:
        try:
            slot = DoctorSlot.objects.select_related('room').select_for_update().get(pk=requested_slot_id)
        except DoctorSlot.DoesNotExist as exc:
            raise AppointmentServiceError('SLOT_NOT_FOUND', 'Không tìm thấy ca khám', status=404) from exc
    elif requested_slot_key:
        slot = materialize_slot(requested_slot_key, doctor, persist=False)
        if slot is None:
            raise AppointmentServiceError('SLOT_NOT_FOUND', 'Không tìm thấy ca khám', status=404)

    if slot is None:
        ongoing_slot = None
        if booking_type == 'WALK_IN':
            candidates = DoctorSlot.objects.select_related('room').select_for_update().filter(
                doctor_id=doctor.id,
                slot_date=timezone.localdate(now),
                status='OPEN',
            ).order_by('start_time')
            for candidate in candidates:
                start, end = slot_datetimes(candidate)
                if start <= now < end and slot_capacity(candidate)[1] > 0:
                    ongoing_slot = candidate
                    break
        if ongoing_slot is not None:
            slot = ongoing_slot
        else:
            suggested_slot = next_available_slot(doctor.id, now, booking_type)
            if suggested_slot is None:
                raise AppointmentServiceError('NO_AVAILABLE_SLOT', 'Không còn ca khám phù hợp', status=409)
            raise _confirmation_required(
                suggested_slot,
                booking_type,
                'Vui lòng xác nhận ca khám phù hợp gần nhất',
                now,
            )

    if slot.doctor_id != doctor.id:
        raise AppointmentServiceError('SLOT_DOCTOR_MISMATCH', 'Ca khám không thuộc bác sĩ đã chọn')

    list(DoctorSlot.objects.select_for_update().filter(room_id=slot.room_id, slot_date=slot.slot_date))
    remaining_capacity = slot_capacity(slot)[1]
    if slot.status == 'CLOSED':
        raise AppointmentServiceError('SLOT_CLOSED', 'Ca khám đã bị khóa')
    if remaining_capacity == 0:
        suggested_slot = next_available_slot(doctor.id, now, booking_type, slot.id)
        if suggested_slot is not None:
            raise _confirmation_required(
                suggested_slot,
                booking_type,
                'Ca khám đã đủ chỗ. Vui lòng xác nhận ca gần nhất còn chỗ',
                now,
            )
        raise AppointmentServiceError(
            'SLOT_FULL',
            'Ca khám đã đủ số lượng và không còn ca phù hợp',
            status=409,
        )

    slot_start, slot_end = slot_datetimes(slot)
    schedule_bookable = (
        booking_type == 'SCHEDULE'
        and now + timedelta(minutes=ONLINE_BOOKING_LEAD_TIME_MINUTES) < slot_end
    )
    walk_in_bookable = booking_type == 'WALK_IN' and now < slot_end
    if slot.status != 'OPEN' or not (schedule_bookable or walk_in_bookable):
        raise AppointmentServiceError(
            'SLOT_NOT_BOOKABLE',
            'Ca khám không còn đủ thời gian tiếp nhận cho loại lịch này',
        )

    if not slot.pk:
        slot = materialize_slot(requested_slot_key, doctor, slot.slot_date)
        if slot is None:
            raise AppointmentServiceError('SLOT_NOT_FOUND', 'Không tìm thấy ca khám', status=404)
        slot = DoctorSlot.objects.select_for_update().select_related('room').get(pk=slot.pk)

    requested_time = data.get('appointment_time')
    if requested_time and timezone.localtime(requested_time) != slot_start:
        raise AppointmentServiceError(
            'SLOT_TIME_MISMATCH',
            'Thời gian hẹn phải trùng với thời điểm bắt đầu của ca khám',
        )

    return create_appointment(
        slot=slot,
        patient=patient,
        doctor=doctor,
        creator=creator,
        department=department,
        data=data,
        now=now,
        appointment_code=appointment_code_factory(slot.slot_date),
    )


def _confirmation_required(slot, booking_type, message, now):
    return AppointmentServiceError(
        'SLOT_CONFIRMATION_REQUIRED',
        message,
        status=409,
        details={
            'bookingType': booking_type,
            'suggestedSlot': slot_payload(slot, booking_type, now=now),
        },
    )


def generate_appointment_code(appointment_date=None):
    appointment_date = appointment_date or timezone.localdate()
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = f"LHK-{appointment_date:%y%m%d}{''.join(secrets.choice(alphabet) for _ in range(6))}"
        if not Appointment.objects.filter(appointment_code=code).exists():
            return code


def create_from_data(*, data, creator, now):
    patient_type = data.get('patientType', 'SERVICE')
    if patient_type == 'BHYT' and not (data.get('bhytNumber') or '').strip():
        raise AppointmentServiceError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ',
                                      details={'bhytNumber': 'Bắt buộc với bệnh nhân BHYT'})
    try:
        patient = Patient.objects.get(pk=data['patientId'])
    except Patient.DoesNotExist as exc:
        raise AppointmentServiceError('PATIENT_NOT_FOUND', 'Không tìm thấy bệnh nhân', status=404) from exc
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
    department = None
    if data.get('departmentId') is not None:
        try:
            department = Department.objects.get(pk=data['departmentId'])
        except Department.DoesNotExist as exc:
            raise AppointmentServiceError('DEPARTMENT_NOT_FOUND', 'Không tìm thấy khoa', status=404) from exc
        if not DoctorDepartment.objects.filter(doctor=doctor, department=department).exists():
            raise AppointmentServiceError('DOCTOR_DEPARTMENT_MISMATCH', 'Bác sĩ không thuộc khoa đã chọn')
    with transaction.atomic():
        return book_appointment(patient=patient, doctor=doctor, creator=creator, department=department,
                                data=data, now=now, appointment_code_factory=generate_appointment_code)
