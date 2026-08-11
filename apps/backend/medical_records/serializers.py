"""Backward-compatible exports for medical-record API serializers."""

from .api.serializers import (
    MedicalRecordCreateSerializer,
    MedicalRecordDetailSerializer,
    MedicalRecordListSerializer,
    MedicalRecordSerializer,
    PrescriptionItemSerializer,
)

__all__ = [
    "MedicalRecordCreateSerializer",
    "MedicalRecordDetailSerializer",
    "MedicalRecordListSerializer",
    "MedicalRecordSerializer",
    "PrescriptionItemSerializer",
]
