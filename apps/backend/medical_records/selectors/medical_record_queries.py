from ..models import MedicalRecord


def get_medical_record(record_id, *, for_update=False):
    queryset = MedicalRecord.objects.select_related("appointment")
    if for_update:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=record_id)
    except MedicalRecord.DoesNotExist:
        return None
