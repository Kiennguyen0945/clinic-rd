from datetime import time

from django.db import migrations


def unlock_seeded_1500_slot(apps, schema_editor):
    DoctorSlot = apps.get_model('appointment_service', 'DoctorSlot')
    DoctorSlot.objects.filter(
        doctor__username='doctor1',
        start_time=time(15, 0),
        status='CLOSED',
    ).update(status='OPEN')


class Migration(migrations.Migration):
    dependencies = [('appointment_service', '0008_remove_medical_record')]  # noqa: RUF012

    operations = [migrations.RunPython(unlock_seeded_1500_slot, migrations.RunPython.noop)]  # noqa: RUF012
