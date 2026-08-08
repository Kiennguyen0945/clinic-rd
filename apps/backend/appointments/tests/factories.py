"""Small dependency-free test factories for appointment tests."""

from datetime import datetime, time, timedelta

from django.utils import timezone

from appointments.models import Appointment, DoctorSlot
from auth_service.models import Role, User
from organization_service.models import Department, DoctorDepartment, Room
from patient_service.models import Patient


def user_factory(*, role_code, username):
    role, _ = Role.objects.get_or_create(
        code=role_code,
        defaults={"name": role_code.title()},
    )
    return User.objects.create(
        role=role,
        username=username,
        password_hash="test",
        full_name=username.replace("-", " ").title(),
        phone=f"09{User.objects.count():08d}",
    )


def patient_factory(*, code="BN-TEST"):
    return Patient.objects.create(
        patient_code=code,
        full_name="Test Patient",
        dob="1990-01-01",
        gender="M",
        phone="0912345678",
        address="Test address",
    )


def doctor_context_factory(*, suffix="default"):
    doctor = user_factory(role_code="DOCTOR", username=f"doctor-{suffix}")
    room = Room.objects.create(room_number=f"Room {suffix}")
    department = Department.objects.create(
        code=f"DEP-{suffix}",
        name=f"Department {suffix}",
    )
    DoctorDepartment.objects.create(doctor=doctor, department=department)
    return doctor, room, department


def slot_factory(*, doctor, room, hour=10, day_offset=1, capacity=4):
    slot_date = timezone.localdate() + timedelta(days=day_offset)
    return DoctorSlot.objects.create(
        doctor=doctor,
        room=room,
        slot_date=slot_date,
        start_time=time(hour),
        end_time=time(hour + 1),
        capacity=capacity,
    )


def appointment_factory(
    *,
    doctor,
    creator,
    patient,
    slot,
    status="CONFIRMED",
    sequence_number=1,
):
    appointment_time = timezone.make_aware(
        datetime.combine(slot.slot_date, slot.start_time),
        timezone.get_current_timezone(),
    )
    return Appointment.objects.create(
        doctor=doctor,
        creator=creator,
        patient=patient,
        slot=slot,
        appointment_time=appointment_time,
        status=status,
        sequence_number=sequence_number,
    )
