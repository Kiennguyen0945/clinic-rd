from django.db import migrations, models


def prepare_check_in_timestamps(apps, schema_editor):
    Appointment = apps.get_model('appointment_service', 'Appointment')
    for appointment in Appointment.objects.only('id', 'check_in_at', 'updated_at').iterator():
        value = appointment.updated_at.isoformat() if appointment.check_in_at == 'NOW' else None
        Appointment.objects.filter(pk=appointment.pk).update(check_in_at=value)


class Migration(migrations.Migration):
    dependencies = [
        ('appointment_service', '0006_appointment_check_in_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='appointment',
            name='check_in_at',
            field=models.CharField(blank=True, max_length=40, null=True),
        ),
        migrations.RunPython(prepare_check_in_timestamps, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='appointment',
            name='check_in_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
