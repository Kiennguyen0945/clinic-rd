from . import AppointmentServiceError


def check_in_appointment(appointment, *, checked_in_at):
    if appointment.status != 'CONFIRMED':
        raise AppointmentServiceError(
            'INVALID_STATUS_TRANSITION',
            'Chỉ lịch đã xác nhận mới được chuyển sang đang chờ',
        )
    appointment.status = 'WAITING'
    appointment.check_in_at = checked_in_at
    appointment.save(update_fields=['status', 'check_in_at', 'updated_at'])
    return appointment
