from django.db import transaction

from ..models import Appointment, MedicalRecord
from . import AppointmentServiceError


def complete_appointment(*, appointment_id, doctor, data):
    try:
        appointment = Appointment.objects.select_related('doctor', 'patient').get(pk=appointment_id)
    except Appointment.DoesNotExist as exc:
        raise AppointmentServiceError('APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn', status=404) from exc
    if appointment.doctor_id != doctor.id:
        raise AppointmentServiceError('FORBIDDEN', 'Bạn không được ghi bệnh án cho bác sĩ khác', status=403)
    if appointment.status != 'IN_PROGRESS':
        raise AppointmentServiceError('INVALID_STATUS_TRANSITION', 'Chỉ lượt khám đang thực hiện mới được hoàn thành')
    with transaction.atomic():
        if MedicalRecord.objects.filter(appointment_id=appointment_id).exists():
            raise AppointmentServiceError('RECORD_EXISTS', 'Bệnh án cho lịch hẹn này đã tồn tại', status=409)
        record = MedicalRecord.objects.create(
            appointment=appointment, symptoms=data['symptoms'], diagnosis=data['diagnosis'], notes=data.get('notes', ''))
        appointment.status = 'COMPLETED'
        appointment.save(update_fields=['status', 'updated_at'])
    return record
