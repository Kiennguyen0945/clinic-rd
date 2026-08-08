# ruff: noqa: RUF012

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("appointment_service", "0002_doctor_slots_and_appointment_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="appointment",
            name="cancellation_reason",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="appointment",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING", "Pending"),
                    ("CONFIRMED", "Confirmed"),
                    ("WAITING", "Waiting"),
                    ("IN_PROGRESS", "In progress"),
                    ("COMPLETED", "Completed"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="PENDING",
                max_length=20,
            ),
        ),
    ]
