from django.urls import path

from .views import (
    AppointmentMedicalRecordView,
    MedicalRecordPrescriptionView,
    MedicalRecordSignView,
    MedicalRecordUpdateView,
)

urlpatterns = [
    path(
        'appointments/<int:appointment_id>/medical-record/',
        AppointmentMedicalRecordView.as_view(),
        name='appointment-medical-record',
    ),
    path('medical-records/<int:pk>/', MedicalRecordUpdateView.as_view(), name='medical-record-update'),
    path(
        'medical-records/<int:pk>/prescription/',
        MedicalRecordPrescriptionView.as_view(),
        name='medical-record-prescription',
    ),
    path('medical-records/<int:pk>/sign/', MedicalRecordSignView.as_view(), name='medical-record-sign'),
]
