from django.db import transaction

from ..models import Patient


def generate_patient_code() -> str:
    """Return the next global patient code in the BN-######## sequence."""
    codes = Patient.objects.filter(patient_code__startswith="BN-").values_list(
        "patient_code",
        flat=True,
    )
    last_sequence = max(
        (
            int(code[3:])
            for code in codes
            if len(code[3:]) == 8 and code[3:].isdigit()
        ),
        default=0,
    )
    return f"BN-{last_sequence + 1:08d}"


@transaction.atomic
def create_patient(*, validated_data: dict) -> Patient:
    return Patient.objects.create(
        patient_code=generate_patient_code(),
        **validated_data,
    )
