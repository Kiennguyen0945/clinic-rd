from ..selectors.medical_record_queries import get_medical_record
from . import MedicalRecordServiceError

MEDICAL_RECORD_FIELDS = {
    "illnessHistory": "illness_history",
    "vitalSigns": "vital_signs",
    "examinationNote": "examination_note",
    "diagnosis": "diagnosis",
}


def update_medical_record(*, record_id, data):
    record = get_medical_record(record_id)
    if record is None:
        raise MedicalRecordServiceError(
            "MEDICAL_RECORD_NOT_FOUND",
            "Không tìm thấy hồ sơ bệnh án",
            status=404,
        )
    if record.status == "SIGNED":
        raise MedicalRecordServiceError(
            "MEDICAL_RECORD_SIGNED",
            "Hồ sơ đã ký, không thể chỉnh sửa",
            status=403,
        )

    invalid_fields = [
        field for field in data if field not in MEDICAL_RECORD_FIELDS and field != "status"
    ]
    if invalid_fields:
        raise MedicalRecordServiceError(
            "VALIDATION_ERROR",
            "Có trường dữ liệu không hợp lệ",
            details={"fields": invalid_fields},
        )

    update_fields = []
    for request_field, model_field in MEDICAL_RECORD_FIELDS.items():
        if request_field not in data:
            continue
        value = data[request_field]
        if value is None:
            value = ""
        if not isinstance(value, str):
            raise MedicalRecordServiceError(
                "VALIDATION_ERROR",
                f"{request_field} phải là chuỗi",
            )
        setattr(record, model_field, value)
        update_fields.append(model_field)

    if update_fields:
        record.save(update_fields=[*update_fields, "updated_at"])
    return record
