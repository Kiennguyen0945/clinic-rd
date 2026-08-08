"""Write use cases and domain utilities for patients."""

from .models import Patient


def generate_patient_code():
    """Generate the next patient code in the BN-######## format."""
    numeric_codes = Patient.objects.filter(
        patient_code__startswith="BN-",
    ).values_list("patient_code", flat=True)
    last_sequence = 0
    for code in numeric_codes:
        suffix = code[3:]
        if len(suffix) == 8 and suffix.isdigit():
            last_sequence = max(last_sequence, int(suffix))
    return f"BN-{last_sequence + 1:08d}"
