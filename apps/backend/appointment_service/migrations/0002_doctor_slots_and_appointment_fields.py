# ruff: noqa: RUF012

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("appointment_service", "0001_initial"),
        ("auth_service", "0003_alter_user_phone_alter_user_role_alter_user_status_and_more"),
        ("patient_service", "0001_initial"),
        ("organization_service", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="DoctorSlot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slot_date", models.DateField()),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                ("capacity", models.PositiveIntegerField(default=5)),
                ("status", models.CharField(choices=[("AVAILABLE", "Available"), ("FULL", "Full"), ("CANCELLED", "Cancelled")], default="AVAILABLE", max_length=20)),
                ("doctor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="doctor_slots", to="auth_service.user")),
                ("room", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="doctor_slots", to="organization_service.room")),
            ],
            options={"constraints": [
                models.UniqueConstraint(fields=("doctor", "slot_date", "start_time", "end_time"), name="unique_doctor_slot_time"),
                models.CheckConstraint(condition=models.Q(end_time__gt=models.F("start_time")), name="doctor_slot_end_after_start"),
            ]},
        ),
        migrations.AddField(model_name="appointment", name="slot", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="appointments", to="appointment_service.doctorslot")),
        migrations.AddField(model_name="appointment", name="appointment_code", field=models.CharField(blank=True, max_length=50, null=True, unique=True)),
        migrations.AddField(model_name="appointment", name="department", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="appointments", to="organization_service.department")),
        migrations.AddField(model_name="appointment", name="sequence_number", field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="appointment", name="booking_type", field=models.CharField(choices=[("SCHEDULE", "Schedule"), ("WALK_IN", "Walk in")], default="SCHEDULE", max_length=20)),
        migrations.AddField(model_name="appointment", name="patient_type", field=models.CharField(choices=[("BHYT", "BHYT"), ("SERVICE", "Service")], default="SERVICE", max_length=20)),
        migrations.AddField(model_name="appointment", name="bhyt_number", field=models.CharField(blank=True, max_length=50, null=True)),
        migrations.AlterField(model_name="appointment", name="reason", field=models.TextField(blank=True, default="")),
    ]
