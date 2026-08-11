from django.db import transaction

from ..models import MedicalRecord, Prescription, PrescriptionItem
from ..selectors.medical_record_queries import get_medical_record
from . import MedicalRecordServiceError


def _validated_items(items):
    if not isinstance(items, list):
        raise MedicalRecordServiceError(
            "VALIDATION_ERROR",
            "Dữ liệu đơn thuốc không hợp lệ",
            details={"items": "Phải là một mảng"},
        )

    errors = {}
    validated_items = []
    for index, item in enumerate(items):
        item_errors = {}
        if not isinstance(item, dict):
            errors[f"items[{index}]"] = "Phải là một object"
            continue

        medication_name = item.get("medicationName")
        if not isinstance(medication_name, str) or not medication_name.strip():
            item_errors["medicationName"] = "Không được để trống"

        dosage = item.get("dosage", "")
        instructions = item.get("instructions", "")
        if dosage is None:
            dosage = ""
        if instructions is None:
            instructions = ""
        if not isinstance(dosage, str):
            item_errors["dosage"] = "Phải là chuỗi"
        if not isinstance(instructions, str):
            item_errors["instructions"] = "Phải là chuỗi"

        values = {}
        for field in ("quantity", "durationDays"):
            value = item.get(field)
            if isinstance(value, bool) or not isinstance(value, int):
                item_errors[field] = "Phải là số nguyên không âm"
            elif value < 0:
                item_errors[field] = "Không được là số âm"
            else:
                values[field] = value

        if item_errors:
            errors[f"items[{index}]"] = item_errors
        else:
            validated_items.append(
                {
                    "medication_name": medication_name.strip(),
                    "dosage": dosage,
                    "duration_days": values["durationDays"],
                    "quantity": values["quantity"],
                    "instructions": instructions,
                }
            )

    if errors:
        raise MedicalRecordServiceError(
            "VALIDATION_ERROR",
            "Dữ liệu đơn thuốc không hợp lệ",
            details=errors,
        )
    return validated_items


def replace_prescription(*, record_id, prescribed_by, items):
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
            "Hồ sơ đã ký, không thể chỉnh sửa đơn thuốc",
            status=403,
        )
    validated_items = _validated_items(items)

    with transaction.atomic():
        prescription, _ = Prescription.objects.get_or_create(
            medical_record=record,
            defaults={"prescribed_by": prescribed_by},
        )
        prescription.prescribed_by = prescribed_by
        prescription.save(update_fields=["prescribed_by"])
        prescription.items.all().delete()
        PrescriptionItem.objects.bulk_create(
            [
                PrescriptionItem(prescription=prescription, **item)
                for item in validated_items
            ]
        )
        return MedicalRecord.objects.select_related("appointment").get(pk=record.pk)
