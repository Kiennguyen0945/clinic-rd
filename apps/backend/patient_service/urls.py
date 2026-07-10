from django.urls import path
from .views import patient_list, patient_detail

urlpatterns = [
    path('patients/', patient_list, name='patient-list'),
    path('patients/<int:pk>/', patient_detail, name='patient-detail'),
]
