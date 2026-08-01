from django.contrib import admin

from .models import MedicalRecord, Prescription, PrescriptionItem


@admin.register(MedicalRecord)
class MedicalRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'appointment', 'status', 'signed_by', 'created_at')
    search_fields = ('illness_history', 'diagnosis', 'examination_note')


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'medical_record', 'prescribed_by', 'created_at')


@admin.register(PrescriptionItem)
class PrescriptionItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'prescription', 'medication_name', 'quantity', 'duration_days')
    search_fields = ('medication_name',)
