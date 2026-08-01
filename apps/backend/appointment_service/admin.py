from django.contrib import admin

from .models import Appointment
from medical_records.models import MedicalRecord


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'doctor', 'appointment_time', 'status', 'created_at')
    list_filter = ('status', 'appointment_time')
    search_fields = ('patient__full_name', 'doctor__full_name', 'reason')


@admin.register(MedicalRecord)
class MedicalRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'appointment', 'illness_history', 'diagnosis', 'status', 'created_at')
    search_fields = ('illness_history', 'diagnosis', 'examination_note')
