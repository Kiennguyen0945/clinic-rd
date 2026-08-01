from django.contrib import admin

from .models import Appointment


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'doctor', 'appointment_time', 'status', 'created_at')
    list_filter = ('status', 'appointment_time')
    search_fields = ('patient__full_name', 'doctor__full_name', 'reason')
