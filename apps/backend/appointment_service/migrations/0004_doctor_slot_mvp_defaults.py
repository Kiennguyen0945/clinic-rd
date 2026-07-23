from django.db import migrations, models


def migrate_slot_statuses(apps, schema_editor):
    DoctorSlot = apps.get_model('appointment_service', 'DoctorSlot')
    DoctorSlot.objects.filter(status__in=('AVAILABLE', 'FULL')).update(status='OPEN')
    DoctorSlot.objects.filter(status='CANCELLED').update(status='CLOSED')


def reverse_slot_statuses(apps, schema_editor):
    DoctorSlot = apps.get_model('appointment_service', 'DoctorSlot')
    DoctorSlot.objects.filter(status='OPEN').update(status='AVAILABLE')
    DoctorSlot.objects.filter(status='CLOSED').update(status='CANCELLED')


class Migration(migrations.Migration):
    dependencies = [
        ('appointment_service', '0003_appointment_status_and_cancellation_reason'),
    ]

    operations = [
        migrations.RunPython(migrate_slot_statuses, reverse_slot_statuses),
        migrations.AlterField(
            model_name='doctorslot',
            name='capacity',
            field=models.PositiveIntegerField(default=4),
        ),
        migrations.AlterField(
            model_name='doctorslot',
            name='status',
            field=models.CharField(
                choices=[('OPEN', 'Open'), ('CLOSED', 'Closed')],
                default='OPEN',
                max_length=20,
            ),
        ),
        migrations.AddConstraint(
            model_name='doctorslot',
            constraint=models.CheckConstraint(
                condition=models.Q(('capacity__gt', 0)),
                name='doctor_slot_positive_capacity',
            ),
        ),
    ]
