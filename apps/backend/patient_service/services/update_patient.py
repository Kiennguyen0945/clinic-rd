from django.db import transaction

from ..models import Patient

PATIENT_UPDATE_FIELDS = frozenset(
    {"full_name", "phone", "email", "cccd", "address", "insurance_number"}
)


@transaction.atomic
def update_patient(*, patient: Patient, validated_data: dict) -> Patient:
    for field, value in validated_data.items():
        if field in PATIENT_UPDATE_FIELDS:
            setattr(patient, field, value)
    patient.save(update_fields=[*validated_data.keys(), "updated_at"])
    return patient
