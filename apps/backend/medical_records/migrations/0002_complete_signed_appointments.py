# ruff: noqa: RUF012

from django.db import migrations


def complete_signed_appointments(apps, schema_editor):
    Appointment = apps.get_model('appointment_service', 'Appointment')
    MedicalRecord = apps.get_model('medical_records', 'MedicalRecord')

    signed_appointment_ids = MedicalRecord.objects.filter(
        status='SIGNED',
    ).values_list('appointment_id', flat=True)
    Appointment.objects.filter(
        id__in=signed_appointment_ids,
    ).exclude(status='COMPLETED').update(status='COMPLETED')


class Migration(migrations.Migration):
    dependencies = [
        ('medical_records', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(complete_signed_appointments, migrations.RunPython.noop),
    ]
