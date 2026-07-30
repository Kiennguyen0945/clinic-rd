from django.contrib import admin

from .models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('patient_code', 'full_name', 'dob', 'gender', 'phone', 'created_at')
    search_fields = ('patient_code', 'full_name', 'phone')
    list_filter = ('gender',)
