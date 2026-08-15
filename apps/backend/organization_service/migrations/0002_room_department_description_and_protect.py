# ruff: noqa: RUF012

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("organization_service", "0001_initial")]
    operations = [
        migrations.AddField(
            model_name="room",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="room",
            name="department",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="rooms",
                to="organization_service.department",
            ),
        ),
        migrations.AlterField(
            model_name="doctordepartment",
            name="department",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="doctor_assignments",
                to="organization_service.department",
            ),
        ),
    ]
