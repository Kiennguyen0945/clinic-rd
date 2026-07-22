from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [("auth_service", "0003_alter_user_phone_alter_user_role_alter_user_status_and_more")]
    operations = [
        migrations.CreateModel(
            name="Department",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=50, unique=True)),
                ("name", models.CharField(max_length=150)),
                ("description", models.TextField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name="Room",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("room_number", models.CharField(max_length=50, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name="DoctorDepartment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("doctor", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="department_assignments", to="auth_service.user")),
                ("department", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="doctor_assignments", to="organization_service.department")),
            ],
            options={
                "constraints": [models.UniqueConstraint(fields=("doctor", "department"), name="unique_doctor_department")],
            },
        ),
    ]
