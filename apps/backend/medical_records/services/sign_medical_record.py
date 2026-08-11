from django.db import transaction
from django.utils import timezone

from appointment_service.models import Appointment

from ..selectors.medical_record_queries import get_medical_record
from . import MedicalRecordServiceError


def sign_medical_record(*, record_id, signer):
    with transaction.atomic():
        record = get_medical_record(record_id, for_update=True)
        if record is None:
            raise MedicalRecordServiceError(
                "MEDICAL_RECORD_NOT_FOUND",
                "Không tìm thấy hồ sơ bệnh án",
                status=404,
            )
        appointment = Appointment.objects.select_for_update().get(
            pk=record.appointment_id
        )
        if record.status == "SIGNED":
            raise MedicalRecordServiceError(
                "MEDICAL_RECORD_ALREADY_SIGNED",
                "Hồ sơ đã được ký trước đó",
                status=409,
            )
        if appointment.doctor_id != signer.id:
            raise MedicalRecordServiceError(
                "FORBIDDEN",
                "Chỉ bác sĩ được phân công cho lượt khám mới được ký hồ sơ",
                status=403,
            )
        if not (record.diagnosis or "").strip():
            raise MedicalRecordServiceError(
                "DIAGNOSIS_REQUIRED",
                "Không thể ký hồ sơ khi chưa có chẩn đoán",
            )

        record.status = "SIGNED"
        record.signed_by = signer
        record.signed_at = timezone.now()
        record.save(update_fields=["status", "signed_by", "signed_at", "updated_at"])
        appointment.status = "COMPLETED"
        appointment.save(update_fields=["status", "updated_at"])
        return record
