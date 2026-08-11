from datetime import datetime, time

from django.utils import timezone

from appointment_service.models import Appointment, DoctorSlot
from auth_service.models import Role, User
from organization_service.models import Room
from patient_service.models import Patient


def medical_record_context(*, appointment_status="IN_PROGRESS"):
    doctor_role, _ = Role.objects.get_or_create(code="DOCTOR", defaults={"name": "Doctor"})
    doctor = User.objects.create(
        role=doctor_role,
        username=f"doctor-{User.objects.count()}",
        password_hash="x",
        full_name="Doctor",
        phone=f"090000{User.objects.count():04d}",
    )
    patient = Patient.objects.create(
        patient_code=f"BN-{Patient.objects.count()}",
        full_name="Patient",
        dob="1990-01-01",
        gender="M",
        phone=f"091000{Patient.objects.count():04d}",
        address="Address",
    )
    room = Room.objects.create(room_number=f"Room {Room.objects.count()}")
    today = timezone.localdate()
    slot = DoctorSlot.objects.create(
        doctor=doctor,
        room=room,
        slot_date=today,
        start_time=time(8),
        end_time=time(9),
    )
    appointment = Appointment.objects.create(
        slot=slot,
        patient=patient,
        doctor=doctor,
        creator=doctor,
        appointment_time=timezone.make_aware(
            datetime.combine(today, slot.start_time),
            timezone.get_current_timezone(),
        ),
        status=appointment_status,
    )
    return doctor, appointment
