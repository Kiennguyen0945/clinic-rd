# Generated manually for the medical records service.
# ruff: noqa: RUF012

from django.db import migrations, models
import django.db.models.deletion


def migrate_existing_medical_records(apps, schema_editor):
    OldMedicalRecord = apps.get_model('appointment_service', 'MedicalRecord')
    MedicalRecord = apps.get_model('medical_records', 'MedicalRecord')

    for old_record in OldMedicalRecord.objects.all().iterator():
        record = MedicalRecord.objects.create(
            appointment_id=old_record.appointment_id,
            illness_history=old_record.symptoms,
            diagnosis=old_record.diagnosis,
            examination_note=old_record.notes or '',
            status='SIGNED',
            signed_by_id=old_record.appointment.doctor_id,
            signed_at=old_record.updated_at,
        )
        MedicalRecord.objects.filter(pk=record.pk).update(
            created_at=old_record.created_at,
            updated_at=old_record.updated_at,
        )


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('appointment_service', '0007_appointment_check_in_at_datetime'),
        ('auth_service', '0003_alter_user_phone_alter_user_role_alter_user_status_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='MedicalRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('illness_history', models.TextField(blank=True, default='')),
                ('vital_signs', models.TextField(blank=True, default='')),
                ('examination_note', models.TextField(blank=True, default='')),
                ('diagnosis', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('DRAFT', 'Draft'), ('SIGNED', 'Signed')], default='DRAFT', max_length=20)),
                ('signed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('appointment', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='medical_record', to='appointment_service.appointment')),
                ('signed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='signed_medical_records', to='auth_service.user')),
            ],
        ),
        migrations.CreateModel(
            name='Prescription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('medical_record', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='prescription', to='medical_records.medicalrecord')),
                ('prescribed_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='prescriptions', to='auth_service.user')),
            ],
        ),
        migrations.CreateModel(
            name='PrescriptionItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('medication_name', models.CharField(max_length=255)),
                ('dosage', models.CharField(max_length=255)),
                ('duration_days', models.PositiveIntegerField()),
                ('quantity', models.PositiveIntegerField()),
                ('instructions', models.TextField(blank=True, default='')),
                ('prescription', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='medical_records.prescription')),
            ],
        ),
        migrations.RunPython(migrate_existing_medical_records, migrations.RunPython.noop),
    ]
