from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('patient_service', '0003_patient_cccd'),
    ]

    operations = [
        migrations.AddField(
            model_name='patient',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
    ]
