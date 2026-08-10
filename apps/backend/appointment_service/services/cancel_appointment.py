from ..models import Appointment
from . import AppointmentServiceError


def cancel_appointment(appointment, *, actor, cancellation_reason='', cancellation_note=''):
    role = getattr(getattr(actor, 'role', None), 'code', None)
    if appointment.status == 'COMPLETED':
        raise AppointmentServiceError('ALREADY_COMPLETED', 'Không thể huỷ lịch hẹn đã hoàn thành')

    cancellation_reason = cancellation_reason.strip()
    cancellation_note = cancellation_note.strip()
    if role == 'DOCTOR':
        if appointment.doctor_id != actor.id or appointment.status != 'IN_PROGRESS':
            raise AppointmentServiceError(
                'INVALID_STATUS_TRANSITION',
                'Bác sĩ chỉ có thể hủy lượt khám đang thực hiện',
            )
        if not cancellation_reason:
            raise AppointmentServiceError(
                'VALIDATION_ERROR',
                'Dữ liệu không hợp lệ',
                details={'cancellationReason': 'Bắt buộc khi bác sĩ hủy lượt khám'},
            )
        cancellation_note = ''
    else:
        if appointment.status not in ('PENDING', 'CONFIRMED', 'WAITING'):
            raise AppointmentServiceError(
                'INVALID_STATUS_TRANSITION',
                'Lễ tân chỉ có thể hủy lịch đã đặt hoặc đang chờ',
            )
        if cancellation_reason not in Appointment.CANCELLATION_REASON_CODES:
            raise AppointmentServiceError(
                'VALIDATION_ERROR',
                'Vui lòng chọn lý do hủy hợp lệ',
                details={'cancellationReason': 'Lý do hủy không hợp lệ'},
            )
        if cancellation_reason == 'OTHER' and not cancellation_note:
            raise AppointmentServiceError(
                'VALIDATION_ERROR',
                'Vui lòng nhập chi tiết lý do hủy',
                details={'cancellationNote': 'Bắt buộc khi chọn lý do khác'},
            )

    appointment.status = 'CANCELLED'
    appointment.cancellation_reason = cancellation_reason
    appointment.cancellation_note = cancellation_note
    appointment.save(update_fields=['status', 'cancellation_reason', 'cancellation_note', 'updated_at'])
    return appointment
