# ruff: noqa: RUF012

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('appointment_service', '0007_appointment_check_in_at_datetime'),
        ('medical_records', '0001_initial'),
    ]

    operations = [
        migrations.DeleteModel(
            name='MedicalRecord',
        ),
    ]
