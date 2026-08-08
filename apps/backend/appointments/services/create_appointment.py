"""Appointment creation use case."""

import secrets
import string
from datetime import date, datetime, time, timedelta

from django.db import transaction
from django.utils import timezone

from appointments.models import (
    DEFAULT_SLOT_CAPACITY,
    DEFAULT_SLOT_DURATION_MINUTES,
    ONLINE_BOOKING_LEAD_TIME_MINUTES,
    Appointment,
    DoctorSlot,
)
from appointments.selectors.appointment_queries import next_sequence
from appointments.selectors.slot_queries import (
    next_available_slot,
    slot_capacity,
    slot_datetimes,
    slot_payload,
)
from auth_service.models import User
from organization_service.models import Department, DoctorDepartment, Room
from patient_service.models import Patient

from . import AppointmentServiceError


def generate_appointment_code(appointment_date=None):
    appointment_date = appointment_date or timezone.localdate()
    alphabet = string.ascii_uppercase + string.digits
    while True:
        random_part = "".join(secrets.choice(alphabet) for _ in range(6))
        code = f"LHK-{appointment_date:%y%m%d}{random_part}"
        if not Appointment.objects.filter(appointment_code=code).exists():
            return code


def materialize_slot(slot_key, doctor, target_date=None, *, persist=True):
    """Resolve a virtual slot key, optionally creating its database row."""
    if not slot_key:
        return None
    parts = slot_key.split(":")
    if len(parts) != 5 or parts[0] != "virtual":
        return None
    try:
        key_doctor_id = int(parts[1])
        key_date = date.fromisoformat(parts[2])
        start_hour = int(parts[3][:2])
        room_id = int(parts[4])
    except (TypeError, ValueError):
        return None
    if (
        key_doctor_id != doctor.id
        or (target_date and key_date != target_date)
        or not 0 <= start_hour <= 23
    ):
        return None

    room = Room.objects.filter(pk=room_id).first()
    if not room:
        return None
    template = (
        DoctorSlot.objects.filter(doctor=doctor)
        .order_by("-slot_date", "start_time")
        .first()
    )
    defaults = {
        "room": room,
        "end_time": (
            datetime.combine(key_date, time(start_hour))
            + timedelta(minutes=DEFAULT_SLOT_DURATION_MINUTES)
        ).time(),
        "capacity": template.capacity if template else DEFAULT_SLOT_CAPACITY,
        "status": "OPEN",
    }
    if not persist:
        return DoctorSlot(
            doctor=doctor,
            room=room,
            slot_date=key_date,
            start_time=time(start_hour),
            **{key: value for key, value in defaults.items() if key != "room"},
        )
    slot, _ = DoctorSlot.objects.select_for_update().get_or_create(
        doctor=doctor,
        slot_date=key_date,
        start_time=time(start_hour),
        end_time=defaults["end_time"],
        defaults=defaults,
    )
    return slot


def _confirmation_required(slot, booking_type, message):
    raise AppointmentServiceError(
        "SLOT_CONFIRMATION_REQUIRED",
        message,
        status=409,
        details={
            "bookingType": booking_type,
            "suggestedSlot": slot_payload(slot, booking_type),
        },
    )


@transaction.atomic
def create_appointment(*, data, creator):
    booking_type = data.get("bookingType", "SCHEDULE")
    patient_type = data.get("patientType", "SERVICE")
    bhyt_number = (data.get("bhytNumber") or "").strip()
    if patient_type == "BHYT" and not bhyt_number:
        raise AppointmentServiceError(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            details={"bhytNumber": "Bắt buộc với bệnh nhân BHYT"},
        )

    patient = Patient.objects.filter(pk=data["patientId"]).first()
    if patient is None:
        raise AppointmentServiceError(
            "PATIENT_NOT_FOUND",
            "Không tìm thấy bệnh nhân",
            status=404,
        )

    doctor = User.objects.select_related("role").filter(
        pk=data["doctorId"],
    ).first()
    if doctor is None or getattr(doctor.role, "code", None) != "DOCTOR":
        raise AppointmentServiceError(
            "DOCTOR_NOT_FOUND",
            "Không tìm thấy bác sĩ",
            status=404,
        )

    department = None
    department_id = data.get("departmentId")
    if department_id is not None:
        department = Department.objects.filter(pk=department_id).first()
        if department is None:
            raise AppointmentServiceError(
                "DEPARTMENT_NOT_FOUND",
                "Không tìm thấy khoa",
                status=404,
            )
        if not DoctorDepartment.objects.filter(
            doctor=doctor,
            department=department,
        ).exists():
            raise AppointmentServiceError(
                "DOCTOR_DEPARTMENT_MISMATCH",
                "Bác sĩ không thuộc khoa đã chọn",
            )

    now = timezone.now()
    requested_slot_id = data.get("slotId")
    requested_slot_key = (data.get("slotKey") or "").strip()
    slot = None
    if requested_slot_id is not None:
        slot = DoctorSlot.objects.select_related("room").select_for_update().filter(
            pk=requested_slot_id,
        ).first()
        if slot is None:
            raise AppointmentServiceError(
                "SLOT_NOT_FOUND",
                "Không tìm thấy ca khám",
                status=404,
            )
    elif requested_slot_key:
        slot = materialize_slot(requested_slot_key, doctor, persist=False)
        if slot is None:
            raise AppointmentServiceError(
                "SLOT_NOT_FOUND",
                "Không tìm thấy ca khám",
                status=404,
            )

    if slot is None:
        ongoing_slot = None
        if booking_type == "WALK_IN":
            candidates = (
                DoctorSlot.objects.select_related("room")
                .select_for_update()
                .filter(
                    doctor_id=doctor.id,
                    slot_date=timezone.localdate(now),
                    status="OPEN",
                )
                .order_by("start_time")
            )
            for candidate in candidates:
                start, end = slot_datetimes(candidate)
                if start <= now < end and slot_capacity(candidate)[1] > 0:
                    ongoing_slot = candidate
                    break
        if ongoing_slot is not None:
            slot = ongoing_slot
        else:
            suggested_slot = next_available_slot(doctor.id, now, booking_type)
            if suggested_slot is None:
                raise AppointmentServiceError(
                    "NO_AVAILABLE_SLOT",
                    "Không còn ca khám phù hợp",
                    status=409,
                )
            _confirmation_required(
                suggested_slot,
                booking_type,
                "Vui lòng xác nhận ca khám phù hợp gần nhất",
            )

    if slot.doctor_id != doctor.id:
        raise AppointmentServiceError(
            "SLOT_DOCTOR_MISMATCH",
            "Ca khám không thuộc bác sĩ đã chọn",
        )

    list(DoctorSlot.objects.select_for_update().filter(
        room_id=slot.room_id,
        slot_date=slot.slot_date,
    ))
    _, remaining_capacity = slot_capacity(slot)
    if slot.status == "CLOSED":
        raise AppointmentServiceError("SLOT_CLOSED", "Ca khám đã bị khóa")
    if remaining_capacity == 0:
        suggested_slot = next_available_slot(
            doctor.id,
            now,
            booking_type,
            slot.id,
        )
        if suggested_slot is not None:
            _confirmation_required(
                suggested_slot,
                booking_type,
                "Ca khám đã đủ chỗ. Vui lòng xác nhận ca gần nhất còn chỗ",
            )
        raise AppointmentServiceError(
            "SLOT_FULL",
            "Ca khám đã đủ số lượng và không còn ca phù hợp",
            status=409,
        )

    slot_start, slot_end = slot_datetimes(slot)
    schedule_bookable = (
        booking_type == "SCHEDULE"
        and now + timedelta(minutes=ONLINE_BOOKING_LEAD_TIME_MINUTES) < slot_end
    )
    walk_in_bookable = booking_type == "WALK_IN" and now < slot_end
    if slot.status != "OPEN" or not (schedule_bookable or walk_in_bookable):
        raise AppointmentServiceError(
            "SLOT_NOT_BOOKABLE",
            "Ca khám không còn đủ thời gian tiếp nhận cho loại lịch này",
        )

    if not slot.pk:
        slot = materialize_slot(
            requested_slot_key,
            doctor,
            slot.slot_date,
        )
        if slot is None:
            raise AppointmentServiceError(
                "SLOT_NOT_FOUND",
                "Không tìm thấy ca khám",
                status=404,
            )
        slot = DoctorSlot.objects.select_for_update().select_related("room").get(
            pk=slot.pk,
        )

    requested_time = data.get("appointment_time")
    if requested_time and timezone.localtime(requested_time) != slot_start:
        raise AppointmentServiceError(
            "SLOT_TIME_MISMATCH",
            "Thời gian hẹn phải trùng với thời điểm bắt đầu của ca khám",
        )

    appointment = Appointment.objects.create(
        slot=slot,
        patient=patient,
        doctor=doctor,
        creator=creator,
        appointment_code=generate_appointment_code(slot.slot_date),
        department=department,
        sequence_number=next_sequence(slot),
        booking_type=booking_type,
        patient_type=patient_type,
        bhyt_number=bhyt_number or None,
        appointment_time=slot_start,
        check_in_at=now if booking_type == "WALK_IN" else None,
        reason=data.get("reason", ""),
        status="CONFIRMED" if booking_type == "SCHEDULE" else "WAITING",
    )
    if patient_type == "BHYT":
        patient.insurance_number = bhyt_number or None
        patient.save(update_fields=["insurance_number", "updated_at"])
    return appointment
