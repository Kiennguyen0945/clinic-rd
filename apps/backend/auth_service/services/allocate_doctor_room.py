from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone

from appointment_service.models import (
    DEFAULT_SLOT_CAPACITY,
    DEFAULT_SLOT_DURATION_MINUTES,
    DoctorSlot,
)
from organization_service.models import Room

from ..selectors.user_queries import get_staff
from . import AuthServiceError


@transaction.atomic
def allocate_doctor_room(
    *, doctor_id, room_id, slot_date, start_time, end_time
):
    doctor = get_staff(doctor_id)
    if doctor is None or doctor.role.code != "DOCTOR":
        raise AuthServiceError("DOCTOR_NOT_FOUND", "Không tìm thấy bác sĩ", status=404)
    try:
        room = Room.objects.get(pk=room_id)
    except (Room.DoesNotExist, ValueError, TypeError) as exc:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Thông tin phân phòng không hợp lệ",
            details={"roomId": "Phòng không tồn tại"},
        ) from exc
    if room.department_id and not doctor.department_assignments.filter(
        department_id=room.department_id
    ).exists():
        raise AuthServiceError(
            "ROOM_DEPARTMENT_MISMATCH",
            "Phòng không thuộc khoa của bác sĩ",
            status=409,
            details={
                "roomId": str(room.id),
                "departmentId": str(room.department_id),
            },
        )

    if room.doctor_id and room.doctor_id != doctor.id:
        raise AuthServiceError(
            "ROOM_ASSIGNED_TO_ANOTHER_DOCTOR",
            "Phòng đã được phân cho bác sĩ khác",
            status=409,
            details={"roomId": str(room.id), "doctorId": str(room.doctor_id)},
        )
    existing_room = Room.objects.filter(doctor=doctor).exclude(pk=room.pk).first()
    if existing_room:
        raise AuthServiceError(
            "DOCTOR_ASSIGNED_TO_ANOTHER_ROOM",
            "Bác sĩ đã được phân sang phòng khác",
            status=409,
            details={"roomId": str(existing_room.id), "doctorId": str(doctor.id)},
        )

    if slot_date < timezone.localdate():
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Thông tin phân phòng không hợp lệ",
            details={"date": "Không thể chọn ngày trong quá khứ"},
        )
    if (
        start_time >= end_time
        or start_time.minute != 0
        or start_time.second != 0
        or end_time.minute != 0
        or end_time.second != 0
    ):
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Thông tin phân phòng không hợp lệ",
            details={"timeRange": "Khoảng thời gian phải theo giờ tròn và giờ kết thúc phải sau giờ bắt đầu"},
        )
    start_at = timezone.make_aware(
        datetime.combine(slot_date, start_time), timezone.get_current_timezone()
    )
    if start_at <= timezone.now():
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Thông tin phân phòng không hợp lệ",
            details={"startTime": "Thời gian phân phòng phải ở tương lai"},
        )

    conflicts = DoctorSlot.objects.select_for_update().filter(
        slot_date=slot_date,
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    if conflicts.filter(room=room).exists():
        raise AuthServiceError(
            "ROOM_UNAVAILABLE",
            "Phòng đã được phân công trong khoảng thời gian đã chọn",
            status=409,
            details={"roomId": str(room.id), "slotDate": slot_date.isoformat()},
        )
    if conflicts.filter(doctor=doctor).exists():
        raise AuthServiceError(
            "DOCTOR_UNAVAILABLE",
            "Bác sĩ đã có lịch làm việc trong khoảng thời gian đã chọn",
            status=409,
            details={"doctorId": str(doctor.id), "slotDate": slot_date.isoformat()},
        )

    slots = []
    cursor = datetime.combine(slot_date, start_time)
    allocation_end = datetime.combine(slot_date, end_time)
    while cursor < allocation_end:
        slot_end = cursor + timedelta(minutes=DEFAULT_SLOT_DURATION_MINUTES)
        slots.append(
            DoctorSlot(
                doctor=doctor,
                room=room,
                slot_date=slot_date,
                start_time=cursor.time(),
                end_time=slot_end.time(),
                capacity=DEFAULT_SLOT_CAPACITY,
                status="OPEN",
            )
        )
        cursor = slot_end
    DoctorSlot.objects.bulk_create(slots)
    room.doctor = doctor
    room.save(update_fields=["doctor"])
    return {
        "doctorId": str(doctor.id),
        "room": {"id": room.id, "roomNumber": room.room_number},
        "slotDate": slot_date.isoformat(),
        "startTime": start_time.strftime("%H:%M"),
        "endTime": end_time.strftime("%H:%M"),
        "slotCount": len(slots),
    }
