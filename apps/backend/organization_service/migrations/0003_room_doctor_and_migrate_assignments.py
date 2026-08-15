# ruff: noqa: RUF012

import django.db.models.deletion
from django.db import migrations, models


def migrate_existing_assignments(apps, schema_editor):
    Room = apps.get_model("organization_service", "Room")
    DoctorDepartment = apps.get_model("organization_service", "DoctorDepartment")
    DoctorSlot = apps.get_model("appointment_service", "DoctorSlot")

    room_by_doctor = {}
    ambiguous_doctors = set()
    doctor_by_room = {}
    ambiguous_rooms = set()

    for doctor_id, room_id in DoctorSlot.objects.values_list(
        "doctor_id", "room_id"
    ).distinct():
        previous_room = room_by_doctor.setdefault(doctor_id, room_id)
        if previous_room != room_id:
            ambiguous_doctors.add(doctor_id)
        previous_doctor = doctor_by_room.setdefault(room_id, doctor_id)
        if previous_doctor != doctor_id:
            ambiguous_rooms.add(room_id)

    for doctor_id, room_id in room_by_doctor.items():
        if doctor_id in ambiguous_doctors or room_id in ambiguous_rooms:
            continue
        room = Room.objects.get(pk=room_id)
        room.doctor_id = doctor_id
        if room.department_id is None:
            department_ids = list(
                DoctorDepartment.objects.filter(doctor_id=doctor_id)
                .values_list("department_id", flat=True)[:2]
            )
            if len(department_ids) == 1:
                room.department_id = department_ids[0]
        room.save(update_fields=["doctor", "department"])


def clear_assignments(apps, schema_editor):
    Room = apps.get_model("organization_service", "Room")
    Room.objects.update(doctor=None)


class Migration(migrations.Migration):
    dependencies = [
        ("appointment_service", "0008_remove_medical_record"),
        ("auth_service", "0006_user_profile_fields"),
        ("organization_service", "0002_room_department_description_and_protect"),
    ]

    operations = [
        migrations.AddField(
            model_name="room",
            name="doctor",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_room",
                to="auth_service.user",
            ),
        ),
        migrations.RunPython(migrate_existing_assignments, clear_assignments),
    ]
