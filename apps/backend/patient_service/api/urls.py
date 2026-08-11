from django.urls import path

from .views import PatientMedicalHistoryView, patient_detail, patient_list

urlpatterns = [
    path("patients/", patient_list, name="patient-list"),
    path("patients/<int:pk>/", patient_detail, name="patient-detail"),
    path(
        "patients/<int:patientId>/medical-records/",
        PatientMedicalHistoryView.as_view(),
        name="patient-medical-history",
    ),
]
