# ruff: noqa: RUF012

from django.db import migrations


def prefix_doctor_names(apps, schema_editor):
    user_model = apps.get_model("auth_service", "User")
    doctors = user_model.objects.filter(role__code="DOCTOR")
    for doctor in doctors.iterator():
        name = doctor.full_name.strip()
        if not name.casefold().startswith("bs."):
            doctor.full_name = f"BS. {name}"
            doctor.save(update_fields=["full_name"])


class Migration(migrations.Migration):
    dependencies = [("auth_service", "0004_user_email")]
    operations = [migrations.RunPython(prefix_doctor_names, migrations.RunPython.noop)]
