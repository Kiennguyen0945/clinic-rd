"""Backward-compatible exports for appointment API serializers."""

from .api.serializers import (
    AppointmentCreateSerializer,
    AppointmentListSerializer,
    AppointmentUpdateSerializer,
    MedicalRecordCreateSerializer,
    MedicalRecordListSerializer,
    MedicalRecordSerializer,
)

__all__ = [
    'AppointmentCreateSerializer',
    'AppointmentListSerializer',
    'AppointmentUpdateSerializer',
    'MedicalRecordCreateSerializer',
    'MedicalRecordListSerializer',
    'MedicalRecordSerializer',
]
