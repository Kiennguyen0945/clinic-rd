from django.db import transaction

from appointment_service.models import Appointment

from ..models import MedicalRecord
from . import MedicalRecordServiceError


def get_or_create_draft(*, appointment_id):
    try:
        appointment = Appointment.objects.get(pk=appointment_id)
    except Appointment.DoesNotExist as exc:
        raise MedicalRecordServiceError(
            "APPOINTMENT_NOT_FOUND",
            "Không tìm thấy lịch hẹn",
            status=404,
        ) from exc

    if appointment.status != "IN_PROGRESS":
        raise MedicalRecordServiceError(
            "INVALID_APPOINTMENT_STATUS",
            "Chỉ có thể lập hồ sơ khi lượt khám đang ở trạng thái Đang khám",
        )

    with transaction.atomic():
        return MedicalRecord.objects.get_or_create(
            appointment=appointment,
            defaults={
                "illness_history": "",
                "vital_signs": "",
                "examination_note": "",
                "diagnosis": "",
                "status": "DRAFT",
            },
        )
