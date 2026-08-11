from django.db.models import QuerySet

from medical_records.models import MedicalRecord


def medical_history(*, patient_id: int) -> QuerySet[MedicalRecord]:
    return (
        MedicalRecord.objects.select_related(
            "appointment",
            "appointment__doctor",
            "appointment__department",
            "appointment__slot",
            "prescription",
        )
        .prefetch_related("prescription__items")
        .filter(
            appointment__patient_id=patient_id,
            status="SIGNED",
            appointment__status="COMPLETED",
        )
        .order_by("-appointment__appointment_time")
    )
