# ruff: noqa: RUF012

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patient_service', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='patient',
            name='insurance_number',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
    ]
