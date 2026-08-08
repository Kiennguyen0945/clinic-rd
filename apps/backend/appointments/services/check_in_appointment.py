"""Check-in and consultation-start use cases."""

from django.utils import timezone

from appointments.models import Appointment

from . import AppointmentServiceError


def check_in_appointment(*, appointment_id, checked_in_at=None):
    appointment = Appointment.objects.select_related(
        "patient",
        "doctor",
        "slot",
    ).filter(pk=appointment_id).first()
    if appointment is None:
        raise AppointmentServiceError(
            "APPOINTMENT_NOT_FOUND",
            "Không tìm thấy lịch hẹn",
            status=404,
        )
    if appointment.status != "CONFIRMED":
        raise AppointmentServiceError(
            "INVALID_STATUS_TRANSITION",
            "Chỉ lịch đã xác nhận mới được chuyển sang đang chờ",
        )

    appointment.status = "WAITING"
    appointment.check_in_at = checked_in_at or timezone.now()
    appointment.save(update_fields=["status", "check_in_at", "updated_at"])
    return appointment


def start_appointment(*, appointment_id, doctor_id):
    appointment = Appointment.objects.select_related(
        "patient",
        "doctor",
        "slot",
    ).filter(pk=appointment_id).first()
    if appointment is None:
        raise AppointmentServiceError(
            "APPOINTMENT_NOT_FOUND",
            "Không tìm thấy lịch hẹn",
            status=404,
        )
    if appointment.doctor_id != doctor_id:
        raise AppointmentServiceError(
            "FORBIDDEN",
            "Bạn không được xử lý lịch khám của bác sĩ khác",
            status=403,
        )
    if appointment.status != "WAITING":
        raise AppointmentServiceError(
            "INVALID_STATUS_TRANSITION",
            "Chỉ bệnh nhân đang chờ mới được bắt đầu khám",
        )

    appointment.status = "IN_PROGRESS"
    appointment.save(update_fields=["status", "updated_at"])
    return appointment
