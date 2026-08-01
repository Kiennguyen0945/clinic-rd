import secrets
import string
from datetime import date, datetime, time, timedelta

from django.db import transaction
from django.db.models import Case, Count, IntegerField, Max, Q, Value, When
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.views import APIView

from auth_service.models import User
from backend.permissions import IsManager
from backend.response_utils import error_response, success_response
from organization_service.models import Department, DoctorDepartment, Room
from patient_service.models import Patient

from .models import (
    DEFAULT_SLOT_CAPACITY,
    DEFAULT_SLOT_DURATION_MINUTES,
    DEFAULT_SLOT_HOURS,
    ONLINE_BOOKING_LEAD_TIME_MINUTES,
    Appointment,
    DoctorSlot,
)
from medical_records.models import MedicalRecord
from .serializers import (
    AppointmentCreateSerializer,
    AppointmentListSerializer,
    AppointmentUpdateSerializer,
    MedicalRecordCreateSerializer,
    MedicalRecordSerializer,
)


def _require_auth(request):
    if not getattr(request.user, 'is_authenticated', False):
        return error_response("UNAUTHORIZED", "Vui lòng đăng nhập", status=401)
    return None


def _check_role(request, *roles):
    return getattr(getattr(request.user, 'role', None), 'code', None) in roles


def _parse_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_date(value):
    if not value:
        return timezone.localdate()
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()  # noqa: DTZ007
    except ValueError:
        return None


def generate_patient_code():
    """Generate the next global patient code: BN-########."""
    numeric_codes = Patient.objects.filter(patient_code__startswith='BN-').values_list('patient_code', flat=True)
    last_sequence = 0
    for code in numeric_codes:
        suffix = code[3:]
        if len(suffix) == 8 and suffix.isdigit():
            last_sequence = max(last_sequence, int(suffix))
    return f'BN-{last_sequence + 1:08d}'


def generate_appointment_code(appointment_date=None):
    """Generate a unique appointment code: LHK-YYMMDD + six random characters."""
    appointment_date = appointment_date or timezone.localdate()
    alphabet = string.ascii_uppercase + string.digits
    while True:
        random_part = ''.join(secrets.choice(alphabet) for _ in range(6))
        code = f'LHK-{appointment_date:%y%m%d}{random_part}'
        if not Appointment.objects.filter(appointment_code=code).exists():
            return code


def _slot_datetimes(slot):
    timezone_info = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(slot.slot_date, slot.start_time), timezone_info)
    end = timezone.make_aware(datetime.combine(slot.slot_date, slot.end_time), timezone_info)
    return start, end


def _slot_key(slot):
    """Stable key for a persisted or lazy (not yet persisted) doctor slot."""
    if slot.pk:
        return str(slot.pk)
    return f"virtual:{slot.doctor_id}:{slot.slot_date.isoformat()}:{slot.start_time.strftime('%H%M')}:{slot.room_id}"


def _slot_capacity(slot):
    if not slot.pk:
        return 0, slot.capacity
    booked_count = slot.appointments.exclude(status='CANCELLED').count()
    remaining_capacity = max(slot.capacity - booked_count, 0)
    return booked_count, remaining_capacity


def _virtual_slots_for_date(doctor, target_date, persisted_slots):
    """Build display-only slots for times that have not needed a DB row yet."""
    template = (
        DoctorSlot.objects.filter(doctor=doctor)
        .select_related('room')
        .order_by('-slot_date', 'start_time')
        .first()
    )
    rooms = list(Room.objects.order_by('id'))
    room = template.room if template else (rooms[(doctor.id - 1) % len(rooms)] if rooms else None)
    if not room:
        return list(persisted_slots)

    existing_hours = {slot.start_time.hour for slot in persisted_slots}
    capacity = template.capacity if template else DEFAULT_SLOT_CAPACITY
    virtual_slots = [
        DoctorSlot(
            doctor=doctor,
            room=room,
            slot_date=target_date,
            start_time=time(hour),
            end_time=(datetime.combine(target_date, time(hour)) + timedelta(minutes=DEFAULT_SLOT_DURATION_MINUTES)).time(),
            capacity=capacity,
            status='OPEN',
        )
        for hour in DEFAULT_SLOT_HOURS
        if hour not in existing_hours
    ]
    return sorted([*persisted_slots, *virtual_slots], key=lambda slot: slot.start_time)


def _materialize_slot(slot_key, doctor, target_date=None, persist=True):
    """Resolve a slot key and create the row only when an appointment needs it."""
    if not slot_key:
        return None
    parts = slot_key.split(':')
    if len(parts) != 5 or parts[0] != 'virtual':
        return None
    try:
        key_doctor_id = int(parts[1])
        key_date = date.fromisoformat(parts[2])
        start_hour = int(parts[3][:2])
        room_id = int(parts[4])
    except (TypeError, ValueError):
        return None
    if key_doctor_id != doctor.id or (target_date and key_date != target_date) or not 0 <= start_hour <= 23:
        return None
    room = Room.objects.filter(pk=room_id).first()
    if not room:
        return None
    template = (
        DoctorSlot.objects.filter(doctor=doctor)
        .order_by('-slot_date', 'start_time')
        .first()
    )
    defaults = {
        'room': room,
        'end_time': (datetime.combine(key_date, time(start_hour)) + timedelta(minutes=DEFAULT_SLOT_DURATION_MINUTES)).time(),
        'capacity': template.capacity if template else DEFAULT_SLOT_CAPACITY,
        'status': 'OPEN',
    }
    if not persist:
        return DoctorSlot(
            doctor=doctor,
            room=room,
            slot_date=key_date,
            start_time=time(start_hour),
            **{key: value for key, value in defaults.items() if key != 'room'},
        )
    slot, _ = DoctorSlot.objects.select_for_update().get_or_create(
        doctor=doctor,
        slot_date=key_date,
        start_time=time(start_hour),
        end_time=defaults['end_time'],
        defaults=defaults,
    )
    return slot


def _slot_bookability(now, slot, booking_type, remaining_capacity):
    start, end = _slot_datetimes(slot)
    lead_time = 0 if booking_type == 'WALK_IN' else ONLINE_BOOKING_LEAD_TIME_MINUTES
    target_time = now + timedelta(minutes=lead_time)
    if booking_type == 'WALK_IN':
        time_window_available = start <= now < end
    else:
        time_window_available = target_time < end
    return (
        slot.status == 'OPEN'
        and remaining_capacity > 0
        and time_window_available
    )


def _slot_payload(slot, booking_type='SCHEDULE'):
    now = timezone.now()
    start, end = _slot_datetimes(slot)
    booked_count, remaining_capacity = _slot_capacity(slot)
    return {
        'id': slot.id,
        'slotKey': _slot_key(slot),
        'doctorId': str(slot.doctor_id),
        'roomId': str(slot.room_id),
        'doctor': {'id': str(slot.doctor_id), 'fullName': slot.doctor.full_name},
        'room': {'id': str(slot.room_id), 'roomNumber': slot.room.room_number},
        'slotDate': slot.slot_date.isoformat(),
        'startTime': start.isoformat(),
        'endTime': end.isoformat(),
        'capacity': slot.capacity,
        'bookedCount': booked_count,
        'remainingCapacity': remaining_capacity,
        'isFull': remaining_capacity == 0,
        'isBookable': _slot_bookability(now, slot, booking_type, remaining_capacity),
        'isOngoing': start <= now < end,
        'isEnded': now >= end,
        'status': slot.status,
    }


class AppointmentReceptionContextView(APIView):
    """Data needed by the receptionist appointment board in one request."""

    def get(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err
        if not _check_role(request, 'RECEPTIONIST', 'MANAGER'):
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        target_date = _parse_date(request.query_params.get('date'))
        if target_date is None:
            return error_response("VALIDATION_ERROR", "Ngày không hợp lệ", status=400)

        doctors = list(
            User.objects.filter(role__code='DOCTOR', status='ACTIVE')
            .prefetch_related('department_assignments__department')
            .order_by('full_name')
        )
        persisted_slots = list(
            DoctorSlot.objects.select_related('doctor', 'room')
            .prefetch_related('appointments')
            .filter(slot_date=target_date, doctor__in=doctors)
            .order_by('doctor__full_name', 'start_time')
        )
        slots = []
        for doctor in doctors:
            doctor_slots = [slot for slot in persisted_slots if slot.doctor_id == doctor.id]
            slots.extend(_virtual_slots_for_date(doctor, target_date, doctor_slots))
        slots_by_doctor = {}
        for slot in slots:
            slots_by_doctor.setdefault(slot.doctor_id, []).append(slot)

        appointment_queryset = Appointment.objects.filter(
            slot__slot_date=target_date,
        ).select_related('doctor')
        reception_summary = {
            'waiting': appointment_queryset.filter(status='WAITING').count(),
            'confirmed': appointment_queryset.filter(status='CONFIRMED').count(),
            'inProgress': appointment_queryset.filter(status='IN_PROGRESS').count(),
            'completed': appointment_queryset.filter(status='COMPLETED').count(),
            'cancelled': appointment_queryset.filter(status='CANCELLED').count(),
        }

        now = timezone.now()
        overview = []
        waiting_doctors = []
        for doctor in doctors:
            doctor_slots = slots_by_doctor.get(doctor.id, [])
            total_capacity = sum(slot.capacity for slot in doctor_slots)
            booked = sum(_slot_capacity(slot)[0] for slot in doctor_slots)
            remaining = max(total_capacity - booked, 0)
            ongoing_slot = next(
                (slot for slot in doctor_slots if _slot_datetimes(slot)[0] <= now < _slot_datetimes(slot)[1]),
                next((slot for slot in doctor_slots if _slot_capacity(slot)[1] > 0 and slot.status == 'OPEN'), None),
            )
            waiting_count = appointment_queryset.filter(doctor=doctor, status='WAITING').count()
            if waiting_count:
                waiting_doctors.append({'doctorId': str(doctor.id), 'doctorName': doctor.full_name, 'waitingCount': waiting_count})
            departments = [
                {'id': assignment.department_id, 'name': assignment.department.name}
                for assignment in doctor.department_assignments.all()
            ]
            status = 'FULL' if remaining == 0 and total_capacity else 'NEAR_FULL' if total_capacity and remaining / total_capacity <= .2 else 'OPEN'
            overview.append({
                'doctor': {'id': str(doctor.id), 'fullName': doctor.full_name},
                'departments': departments,
                'totalSlots': len(doctor_slots),
                'capacity': total_capacity,
                'bookedCount': booked,
                'remainingCapacity': remaining,
                'ongoingSlot': _slot_payload(ongoing_slot) if ongoing_slot else None,
                'status': status,
            })

        return success_response(
            {
                'doctors': [
                    {
                        'id': str(doctor.id),
                        'fullName': doctor.full_name,
                        'departments': [
                            {'id': assignment.department_id, 'name': assignment.department.name}
                            for assignment in doctor.department_assignments.all()
                        ],
                    }
                    for doctor in doctors
                ],
                'departments': [{'id': department.id, 'name': department.name} for department in Department.objects.order_by('name')],
                'rooms': [{'id': str(room.id), 'roomNumber': room.room_number} for room in Room.objects.order_by('room_number')],
                'openSlotAssignments': [
                    {
                        'doctorId': str(doctor_id),
                        'roomId': str(room_id),
                        'roomNumber': room_number,
                    }
                    for doctor_id, room_id, room_number in sorted({
                        (slot.doctor_id, slot.room_id, slot.room.room_number)
                        for slot in slots
                        if slot.status == 'OPEN'
                    }, key=lambda item: (item[2], item[0]))
                ],
                'overview': overview,
                'receptionSummary': reception_summary,
                'waitingDoctors': sorted(waiting_doctors, key=lambda item: item['waitingCount'], reverse=True),
            },
            message='Lấy dữ liệu tiếp nhận thành công',
        )


def _next_sequence(slot):
    max_sequence = Appointment.objects.filter(
        slot__room_id=slot.room_id,
        slot__slot_date=slot.slot_date,
    ).aggregate(max_sequence=Max('sequence_number'))['max_sequence'] or 0
    return max_sequence + 1


def _next_available_slot(doctor_id, now, booking_type, exclude_slot_id=None):
    """Return the nearest open future/current slot with capacity for confirmation."""
    candidates = DoctorSlot.objects.select_related('doctor', 'room').filter(
        doctor_id=doctor_id,
        status='OPEN',
        slot_date__gte=timezone.localdate(now),
    ).order_by('slot_date', 'start_time')
    if booking_type == 'WALK_IN':
        candidates = candidates.filter(slot_date=timezone.localdate(now))
    if exclude_slot_id:
        candidates = candidates.exclude(pk=exclude_slot_id)
    for candidate in candidates:
        _, remaining = _slot_capacity(candidate)
        if remaining <= 0:
            continue
        _, end = _slot_datetimes(candidate)
        if booking_type == 'SCHEDULE':
            if now + timedelta(minutes=ONLINE_BOOKING_LEAD_TIME_MINUTES) < end:
                return candidate
        elif end > now:
            return candidate
    return None


def _reschedule_suggestions(doctor_id, now, appointment_status, exclude_slot_id=None):
    """Return nearby valid slots for a failed reschedule attempt."""
    candidates = DoctorSlot.objects.select_related('doctor', 'room').filter(
        doctor_id=doctor_id,
        status='OPEN',
        slot_date__gte=timezone.localdate(now),
    ).order_by('slot_date', 'start_time')
    if exclude_slot_id:
        candidates = candidates.exclude(pk=exclude_slot_id)

    suggestions = []
    lead_time = ONLINE_BOOKING_LEAD_TIME_MINUTES if appointment_status == 'CONFIRMED' else 0
    target_time = now + timedelta(minutes=lead_time)
    for candidate in candidates:
        if _slot_capacity(candidate)[1] <= 0:
            continue
        _, end = _slot_datetimes(candidate)
        if end <= target_time:
            continue
        suggestions.append(
            _slot_payload(
                candidate,
                'SCHEDULE' if appointment_status == 'CONFIRMED' else 'WALK_IN',
            )
        )
        if len(suggestions) == 5:
            break
    return suggestions


def _reschedule_conflict_response(appointment, now, exclude_slot_id=None, doctor_id=None):
    suggestions = _reschedule_suggestions(
        doctor_id or appointment.doctor_id,
        now,
        appointment.status,
        exclude_slot_id=exclude_slot_id,
    )
    return error_response(
        'SLOT_NOT_AVAILABLE',
        'Khung giờ mới không còn hợp lệ',
        status=409,
        details={
            'suggestedSlots': suggestions,
            'suggestedSlot': suggestions[0] if suggestions else None,
        },
    )


def _slot_confirmation_required(slot, booking_type, message):
    return error_response(
        "SLOT_CONFIRMATION_REQUIRED",
        message,
        status=409,
        details={
            "bookingType": booking_type,
            "suggestedSlot": _slot_payload(slot, booking_type),
        },
    )


class DoctorSlotListView(APIView):
    def get(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err
        if not _check_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        target_date = _parse_date(request.query_params.get('date'))
        if target_date is None:
            return error_response("VALIDATION_ERROR", "Ngày không hợp lệ", status=400)

        queryset = DoctorSlot.objects.select_related('doctor', 'room').filter(slot_date=target_date)
        doctor_id = request.query_params.get('doctorId')
        if _check_role(request, 'DOCTOR'):
            queryset = queryset.filter(doctor_id=request.user.id)
        elif doctor_id:
            parsed_doctor_id = _parse_int(doctor_id)
            if parsed_doctor_id is None:
                return error_response("VALIDATION_ERROR", "doctorId không hợp lệ", status=400)
            queryset = queryset.filter(doctor_id=parsed_doctor_id)

        booking_type = request.query_params.get('bookingType', 'SCHEDULE').upper()
        if booking_type not in dict(Appointment.BOOKING_TYPE_CHOICES):
            return error_response("VALIDATION_ERROR", "bookingType không hợp lệ", status=400)
        persisted_slots = list(queryset.order_by('start_time'))
        if doctor_id or _check_role(request, 'DOCTOR'):
            doctor = User.objects.select_related('role').get(pk=request.user.id if _check_role(request, 'DOCTOR') else doctor_id)
            slots = _virtual_slots_for_date(doctor, target_date, persisted_slots)
        else:
            slots = persisted_slots
        return success_response(
            {'slots': [_slot_payload(slot, booking_type) for slot in slots]},
            message="Lấy danh sách ca khám thành công",
        )


class DoctorSlotDetailView(APIView):
    def get(self, request, pk):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err
        if not _check_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)
        try:
            slot = DoctorSlot.objects.select_related('doctor', 'room').get(pk=pk)
        except DoctorSlot.DoesNotExist:
            return error_response("SLOT_NOT_FOUND", "Không tìm thấy ca khám", status=404)
        if _check_role(request, 'DOCTOR') and slot.doctor_id != request.user.id:
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        appointments = slot.appointments.select_related('patient', 'doctor', 'department').order_by('sequence_number')
        return success_response(
            {
                'slot': _slot_payload(slot, request.query_params.get('bookingType', 'SCHEDULE').upper()),
                'appointments': AppointmentListSerializer(appointments, many=True).data,
            },
            message="Lấy chi tiết ca khám thành công",
        )


class AppointmentQueueView(APIView):
    def get(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err
        if not _check_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        target_date = _parse_date(request.query_params.get('date'))
        if target_date is None:
            return error_response("VALIDATION_ERROR", "Ngày không hợp lệ", status=400)
        queryset = Appointment.objects.select_related('patient', 'doctor', 'slot', 'department').filter(
            slot__slot_date=target_date,
            status__in=('WAITING', 'CONFIRMED'),
        )
        if _check_role(request, 'DOCTOR'):
            queryset = queryset.filter(doctor_id=request.user.id)

        keyword = (request.query_params.get('keyword') or '').strip()
        if keyword:
            query = (
                Q(patient__full_name__icontains=keyword)
                | Q(patient__patient_code__icontains=keyword)
                | Q(patient__phone__icontains=keyword)
                | Q(appointment_code__icontains=keyword)
            )
            parsed_sequence = _parse_int(keyword)
            if parsed_sequence is not None:
                query |= Q(sequence_number=parsed_sequence)
            queryset = queryset.filter(query)

        queryset = queryset.annotate(
            status_priority=Case(
                When(status='WAITING', then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        ).order_by('status_priority', 'sequence_number')
        return success_response(
            {'appointments': AppointmentListSerializer(queryset, many=True).data},
            message="Lấy danh sách chờ thành công",
        )


class AppointmentListView(APIView):
    def get(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        if not _check_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        target_date = _parse_date(request.query_params.get('date'))
        if target_date is None:
            return error_response(
                "VALIDATION_ERROR",
                "Ngày không hợp lệ",
                status=400,
                details={"date": "Định dạng phải là YYYY-MM-DD"},
            )

        queryset = Appointment.objects.select_related('patient', 'doctor', 'slot', 'department').filter(
            appointment_time__date=target_date
        )

        status_filter = request.query_params.get('status')
        if status_filter:
            status_filter = status_filter.upper()
            allowed_statuses = {choice[0] for choice in Appointment.STATUS_CHOICES}
            if status_filter not in allowed_statuses:
                return error_response(
                    "VALIDATION_ERROR",
                    "Trạng thái không hợp lệ",
                    status=400,
                    details={"status": "Phải là PENDING, CONFIRMED, WAITING, IN_PROGRESS, COMPLETED hoặc CANCELLED"},
                )
            queryset = queryset.filter(status=status_filter)

        doctor_id_param = request.query_params.get('doctorId')
        if _check_role(request, 'DOCTOR'):
            queryset = queryset.filter(doctor_id=request.user.id)
        elif doctor_id_param:
            doctor_id = _parse_int(doctor_id_param)
            if doctor_id is None:
                return error_response(
                    "VALIDATION_ERROR",
                    "doctorId không hợp lệ",
                    status=400,
                    details={"doctorId": "Phải là số nguyên"},
                )
            queryset = queryset.filter(doctor_id=doctor_id)

        serializer = AppointmentListSerializer(queryset.order_by('appointment_time'), many=True)
        return success_response(
            {"appointments": serializer.data},
            message="Lấy danh sách lịch hẹn thành công",
        )

    def post(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        if not _check_role(request, 'RECEPTIONIST'):
            return error_response("FORBIDDEN", "Bạn không có quyền thực hiện hành động này", status=403)

        serializer = AppointmentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ",
                status=400,
                details=serializer.errors,
            )

        data = serializer.validated_data
        booking_type = data.get('bookingType', 'SCHEDULE')
        patient_type = data.get('patientType', 'SERVICE')
        if patient_type == 'BHYT' and not (data.get('bhytNumber') or '').strip():
            return error_response(
                "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ",
                status=400,
                details={"bhytNumber": "Bắt buộc với bệnh nhân BHYT"},
            )

        patient_id = data['patientId']
        doctor_id = data['doctorId']

        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            return error_response(
                "PATIENT_NOT_FOUND",
                "Không tìm thấy bệnh nhân",
                status=404,
            )

        try:
            doctor = User.objects.select_related('role').get(pk=doctor_id)
        except User.DoesNotExist:
            return error_response(
                "DOCTOR_NOT_FOUND",
                "Không tìm thấy bác sĩ",
                status=404,
            )

        if getattr(getattr(doctor, 'role', None), 'code', None) != 'DOCTOR':
            return error_response(
                "DOCTOR_NOT_FOUND",
                "Không tìm thấy bác sĩ",
                status=404,
            )

        department = None
        department_id = data.get('departmentId')
        if department_id is not None:
            try:
                department = Department.objects.get(pk=department_id)
            except Department.DoesNotExist:
                return error_response("DEPARTMENT_NOT_FOUND", "Không tìm thấy khoa", status=404)
            if not DoctorDepartment.objects.filter(doctor=doctor, department=department).exists():
                return error_response(
                    "DOCTOR_DEPARTMENT_MISMATCH",
                    "Bác sĩ không thuộc khoa đã chọn",
                    status=400,
                )

        with transaction.atomic():
            now = timezone.now()
            requested_slot_id = data.get('slotId')
            requested_slot_key = (data.get('slotKey') or '').strip()
            slot = None
            if requested_slot_id is not None:
                try:
                    slot = DoctorSlot.objects.select_related('room').select_for_update().get(pk=requested_slot_id)
                except DoctorSlot.DoesNotExist:
                    return error_response("SLOT_NOT_FOUND", "Không tìm thấy ca khám", status=404)
            elif requested_slot_key:
                slot = _materialize_slot(requested_slot_key, doctor, persist=False)
                if slot is None:
                    return error_response("SLOT_NOT_FOUND", "Không tìm thấy ca khám", status=404)

            # No selected slot: walk-in may enter the ongoing slot immediately.
            # Schedule bookings and overflow walk-ins require receptionist confirmation.
            if slot is None:
                ongoing_slot = None
                if booking_type == 'WALK_IN':
                    for candidate in DoctorSlot.objects.select_related('room').select_for_update().filter(
                        doctor_id=doctor.id,
                        slot_date=timezone.localdate(now),
                        status='OPEN',
                    ).order_by('start_time'):
                        start, end = _slot_datetimes(candidate)
                        if start <= now < end and _slot_capacity(candidate)[1] > 0:
                            ongoing_slot = candidate
                            break
                if ongoing_slot is not None:
                    slot = ongoing_slot
                else:
                    suggested_slot = _next_available_slot(doctor.id, now, booking_type)
                    if suggested_slot is None:
                        return error_response("NO_AVAILABLE_SLOT", "Không còn ca khám phù hợp", status=409)
                    return _slot_confirmation_required(
                        suggested_slot,
                        booking_type,
                        "Vui lòng xác nhận ca khám phù hợp gần nhất",
                    )

            if slot.doctor_id != doctor.id:
                return error_response("SLOT_DOCTOR_MISMATCH", "Ca khám không thuộc bác sĩ đã chọn", status=400)

            # Queue numbers are allocated per room/day, so lock that allocation scope.
            list(DoctorSlot.objects.select_for_update().filter(room_id=slot.room_id, slot_date=slot.slot_date))
            _, remaining_capacity = _slot_capacity(slot)
            if slot.status == 'CLOSED':
                return error_response("SLOT_CLOSED", "Ca khám đã bị khóa", status=400)
            if remaining_capacity == 0:
                suggested_slot = _next_available_slot(doctor.id, now, booking_type, slot.id)
                if suggested_slot is not None:
                    return _slot_confirmation_required(
                        suggested_slot,
                        booking_type,
                        "Ca khám đã đủ chỗ. Vui lòng xác nhận ca gần nhất còn chỗ",
                    )
                return error_response("SLOT_FULL", "Ca khám đã đủ số lượng và không còn ca phù hợp", status=409)
            slot_start, slot_end = _slot_datetimes(slot)
            schedule_bookable = (
                booking_type == 'SCHEDULE'
                and now + timedelta(minutes=ONLINE_BOOKING_LEAD_TIME_MINUTES) < slot_end
            )
            walk_in_bookable = booking_type == 'WALK_IN' and now < slot_end
            if slot.status != 'OPEN' or not (schedule_bookable or walk_in_bookable):
                return error_response(
                    "SLOT_NOT_BOOKABLE",
                    "Ca khám không còn đủ thời gian tiếp nhận cho loại lịch này",
                    status=400,
                )

            if not slot.pk:
                slot = _materialize_slot(requested_slot_key, doctor, slot.slot_date)
                if slot is None:
                    return error_response("SLOT_NOT_FOUND", "Không tìm thấy ca khám", status=404)
                slot = DoctorSlot.objects.select_for_update().select_related('room').get(pk=slot.pk)

            requested_time = data.get('appointment_time')
            if requested_time and timezone.localtime(requested_time) != slot_start:
                return error_response(
                    "SLOT_TIME_MISMATCH",
                    "Thời gian hẹn phải trùng với thời điểm bắt đầu của ca khám",
                    status=400,
                )

            sequence_number = _next_sequence(slot)
            appointment = Appointment.objects.create(
                slot=slot,
                patient=patient,
                doctor=doctor,
                creator=request.user,
                appointment_code=generate_appointment_code(slot.slot_date),
                department=department,
                sequence_number=sequence_number,
                booking_type=booking_type,
                patient_type=patient_type,
                bhyt_number=(data.get('bhytNumber') or '').strip() or None,
                appointment_time=slot_start,
                check_in_at=now if booking_type == 'WALK_IN' else None,
                reason=data.get('reason', ''),
                status='CONFIRMED' if booking_type == 'SCHEDULE' else 'WAITING',
            )
            if patient_type == 'BHYT':
                patient.insurance_number = (data.get('bhytNumber') or '').strip() or None
                patient.save(update_fields=['insurance_number', 'updated_at'])

        return success_response(
            {"appointment": AppointmentListSerializer(appointment).data},
            message="Tạo lịch hẹn thành công",
            status=201,
        )


class AppointmentCreateView(APIView):
    def post(self, request):
        return AppointmentListView().post(request)


class AppointmentUpdateView(APIView):
    def put(self, request, pk):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        if not _check_role(request, 'RECEPTIONIST'):
            return error_response("FORBIDDEN", "Bạn không có quyền thực hiện hành động này", status=403)

        with transaction.atomic():
            try:
                appointment = Appointment.objects.select_for_update(of=('self',)).select_related(
                    'patient', 'doctor', 'slot',
                ).get(pk=pk)
            except Appointment.DoesNotExist:
                return error_response(
                    "APPOINTMENT_NOT_FOUND",
                    "Không tìm thấy lịch hẹn",
                    status=404,
                )

            if appointment.status not in ('CONFIRMED', 'WAITING'):
                return error_response(
                    'INVALID_STATUS_FOR_UPDATE',
                    'Không thể đổi lịch ở trạng thái hiện tại',
                    status=409,
                )

            serializer = AppointmentUpdateSerializer(data=request.data)
            if not serializer.is_valid():
                return error_response(
                    "VALIDATION_ERROR",
                    "Dữ liệu không hợp lệ",
                    status=400,
                    details=serializer.errors,
                )

            validated_data = serializer.validated_data

            target_doctor = appointment.doctor
            if 'doctorId' in validated_data:
                try:
                    target_doctor = User.objects.select_related('role').get(
                        pk=validated_data['doctorId'],
                    )
                except User.DoesNotExist:
                    return error_response(
                        'DOCTOR_NOT_FOUND',
                        'Không tìm thấy bác sĩ',
                        status=404,
                    )
                if getattr(getattr(target_doctor, 'role', None), 'code', None) != 'DOCTOR':
                    return error_response(
                        'DOCTOR_NOT_FOUND',
                        'Không tìm thấy bác sĩ',
                        status=404,
                    )

            department = appointment.department
            if 'departmentId' in validated_data:
                department_id = validated_data['departmentId']
                if department_id is None:
                    department = None
                else:
                    try:
                        department = Department.objects.get(pk=department_id)
                    except Department.DoesNotExist:
                        return error_response(
                            'DEPARTMENT_NOT_FOUND',
                            'Không tìm thấy khoa',
                            status=404,
                        )
                    if not DoctorDepartment.objects.filter(
                        doctor=target_doctor,
                        department=department,
                    ).exists():
                        return error_response(
                            'DOCTOR_DEPARTMENT_MISMATCH',
                            'Bác sĩ không thuộc khoa đã chọn',
                            status=400,
                        )

            requested_slot = 'slotId' in validated_data or 'slotKey' in validated_data
            if requested_slot:
                if not appointment.slot_id:
                    return error_response(
                        'SLOT_APPOINTMENT_REQUIRED',
                        'Lịch hẹn hiện chưa gắn ca khám',
                        status=400,
                    )

                requested_slot_id = validated_data.get('slotId')
                requested_slot_key = (validated_data.get('slotKey') or '').strip()
                new_slot = None
                if requested_slot_id is not None:
                    new_slot = DoctorSlot.objects.filter(pk=requested_slot_id).first()
                elif requested_slot_key:
                    new_slot = _materialize_slot(
                        requested_slot_key,
                        target_doctor,
                        persist=False,
                    )
                if new_slot is None:
                    return _reschedule_conflict_response(
                        appointment,
                        timezone.now(),
                        doctor_id=target_doctor.id,
                    )

                if new_slot.doctor_id != target_doctor.id:
                    return error_response(
                        'SLOT_DOCTOR_MISMATCH',
                        'Ca khám không thuộc bác sĩ đã chọn',
                        status=400,
                    )

                old_slot_id = appointment.slot_id
                target_slot_id = new_slot.pk
                slot_ids = sorted({old_slot_id, target_slot_id} - {None})
                locked_slots = {
                    slot.id: slot
                    for slot in DoctorSlot.objects.select_for_update()
                    .select_related('doctor', 'room')
                    .filter(pk__in=slot_ids)
                }
                old_slot = locked_slots.get(old_slot_id)
                if old_slot is None:
                    return error_response('SLOT_NOT_FOUND', 'Không tìm thấy ca khám cũ', status=404)

                if new_slot.pk:
                    new_slot = locked_slots.get(new_slot.pk)
                else:
                    new_slot = _materialize_slot(
                        requested_slot_key,
                        target_doctor,
                        persist=True,
                    )
                    if new_slot is not None:
                        new_slot = DoctorSlot.objects.select_for_update().select_related(
                            'doctor', 'room',
                        ).get(pk=new_slot.pk)
                if new_slot is None:
                    return _reschedule_conflict_response(
                        appointment,
                        timezone.now(),
                        doctor_id=target_doctor.id,
                    )

                if new_slot.pk != old_slot.pk:
                    # Slot rows are the lock used by appointment creation too.
                    # Re-read capacity only after both rows are locked.
                    remaining_capacity = _slot_capacity(new_slot)[1]
                    now = timezone.now()
                    _, new_end = _slot_datetimes(new_slot)
                    lead_time = (
                        ONLINE_BOOKING_LEAD_TIME_MINUTES
                        if appointment.status == 'CONFIRMED' else 0
                    )
                    valid_time = now + timedelta(minutes=lead_time) < new_end
                    if (
                        new_slot.status != 'OPEN'
                        or remaining_capacity <= 0
                        or not valid_time
                    ):
                        response = _reschedule_conflict_response(
                            appointment,
                            now,
                            doctor_id=target_doctor.id,
                        )
                        # A virtual slot may have been materialized while
                        # resolving the request; an invalid request must not
                        # leave that row behind.
                        transaction.set_rollback(True)
                        return response

                    sequence_changed = (
                        old_slot.room_id != new_slot.room_id
                        or old_slot.slot_date != new_slot.slot_date
                    )
                    if sequence_changed:
                        # Lock every slot in each room/day allocation scope
                        # before taking Max(sequence_number), matching create.
                        scopes = {
                            (old_slot.room_id, old_slot.slot_date),
                            (new_slot.room_id, new_slot.slot_date),
                        }
                        for room_id, slot_date in scopes:
                            list(
                                DoctorSlot.objects.select_for_update().filter(
                                    room_id=room_id,
                                    slot_date=slot_date,
                                )
                            )
                        appointment.sequence_number = _next_sequence(new_slot)

                    appointment.slot = new_slot
                    appointment.appointment_time = _slot_datetimes(new_slot)[0]
                    if (
                        appointment.status == 'WAITING'
                        and old_slot.slot_date != new_slot.slot_date
                    ):
                        appointment.status = 'CONFIRMED'
                        appointment.check_in_at = None

                appointment.doctor = target_doctor
                appointment.department = department

            elif appointment.slot_id and ({'appointment_time', 'doctorId'} & validated_data.keys()):
                return error_response(
                    "SLOT_APPOINTMENT_IMMUTABLE",
                    "Lịch đã gắn ca khám không được đổi giờ hoặc đổi bác sĩ",
                    status=400,
                )

            if 'appointment_time' in validated_data and not requested_slot:
                appointment_time = validated_data['appointment_time']
                if timezone.is_naive(appointment_time):
                    appointment_time = timezone.make_aware(appointment_time, timezone.get_current_timezone())
                if appointment_time <= timezone.now():
                    return error_response(
                        "PAST_TIME",
                        "Thời gian hẹn phải trong tương lai",
                        status=400,
                    )
                appointment.appointment_time = appointment_time

            if 'doctorId' in validated_data and not requested_slot:
                appointment.doctor = target_doctor
                appointment.department = department

            if 'reason' in validated_data:
                appointment.reason = validated_data['reason']

            appointment.save()

        return success_response(
            {"appointment": AppointmentListSerializer(appointment).data},
            message="Cập nhật lịch hẹn thành công",
        )


class AppointmentCancelView(APIView):
    def patch(self, request, pk):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        role = getattr(getattr(request.user, 'role', None), 'code', None)
        if role not in ('RECEPTIONIST', 'DOCTOR'):
            return error_response("FORBIDDEN", "Bạn không có quyền thực hiện hành động này", status=403)

        try:
            appointment = Appointment.objects.select_related('patient', 'doctor').get(pk=pk)
        except Appointment.DoesNotExist:
            return error_response(
                "APPOINTMENT_NOT_FOUND",
                "Không tìm thấy lịch hẹn",
                status=404,
            )

        if appointment.status == 'COMPLETED':
            return error_response(
                "ALREADY_COMPLETED",
                "Không thể huỷ lịch hẹn đã hoàn thành",
                status=400,
            )

        if role == 'DOCTOR':
            if appointment.doctor_id != request.user.id or appointment.status != 'IN_PROGRESS':
                return error_response(
                    "INVALID_STATUS_TRANSITION",
                    "Bác sĩ chỉ có thể hủy lượt khám đang thực hiện",
                    status=400,
                )
            cancellation_reason = (request.data.get('cancellationReason') or '').strip()
            if not cancellation_reason:
                return error_response(
                    "VALIDATION_ERROR",
                    "Dữ liệu không hợp lệ",
                    status=400,
                    details={"cancellationReason": "Bắt buộc khi bác sĩ hủy lượt khám"},
                )
            appointment.cancellation_reason = cancellation_reason
            appointment.cancellation_note = ''
        elif appointment.status not in ('PENDING', 'CONFIRMED', 'WAITING'):
            return error_response(
                "INVALID_STATUS_TRANSITION",
                "Lễ tân chỉ có thể hủy lịch đã đặt hoặc đang chờ",
                status=400,
            )
        else:
            cancellation_reason = (request.data.get('cancellationReason') or '').strip()
            cancellation_note = (request.data.get('cancellationNote') or '').strip()
            if cancellation_reason not in Appointment.CANCELLATION_REASON_CODES:
                return error_response(
                    "VALIDATION_ERROR",
                    "Vui lòng chọn lý do hủy hợp lệ",
                    status=400,
                    details={"cancellationReason": "Lý do hủy không hợp lệ"},
                )
            if cancellation_reason == 'OTHER' and not cancellation_note:
                return error_response(
                    "VALIDATION_ERROR",
                    "Vui lòng nhập chi tiết lý do hủy",
                    status=400,
                    details={"cancellationNote": "Bắt buộc khi chọn lý do khác"},
                )
            appointment.cancellation_reason = cancellation_reason
            appointment.cancellation_note = cancellation_note

        appointment.status = 'CANCELLED'
        appointment.save(update_fields=['status', 'cancellation_reason', 'cancellation_note', 'updated_at'])

        return success_response(
            {"appointment": AppointmentListSerializer(appointment).data},
            message="Huỷ lịch hẹn thành công",
        )


class AppointmentCheckInView(APIView):
    def post(self, request, pk):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err
        if not _check_role(request, 'RECEPTIONIST'):
            return error_response("FORBIDDEN", "Chỉ lễ tân được xác nhận bệnh nhân đã đến", status=403)

        try:
            appointment = Appointment.objects.select_related('patient', 'doctor', 'slot').get(pk=pk)
        except Appointment.DoesNotExist:
            return error_response("APPOINTMENT_NOT_FOUND", "Không tìm thấy lịch hẹn", status=404)
        if appointment.status != 'CONFIRMED':
            return error_response(
                "INVALID_STATUS_TRANSITION",
                "Chỉ lịch đã xác nhận mới được chuyển sang đang chờ",
                status=400,
            )

        appointment.status = 'WAITING'
        appointment.check_in_at = timezone.now()
        appointment.save(update_fields=['status', 'check_in_at', 'updated_at'])
        return success_response(
            {"appointment": AppointmentListSerializer(appointment).data},
            message="Bệnh nhân đã được tiếp nhận",
        )


class AppointmentStartView(APIView):
    def post(self, request, pk):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err
        if not _check_role(request, 'DOCTOR'):
            return error_response("FORBIDDEN", "Chỉ bác sĩ được bắt đầu lượt khám", status=403)

        try:
            appointment = Appointment.objects.select_related('patient', 'doctor', 'slot').get(pk=pk)
        except Appointment.DoesNotExist:
            return error_response("APPOINTMENT_NOT_FOUND", "Không tìm thấy lịch hẹn", status=404)
        if appointment.doctor_id != request.user.id:
            return error_response("FORBIDDEN", "Bạn không được xử lý lịch khám của bác sĩ khác", status=403)
        if appointment.status != 'WAITING':
            return error_response(
                "INVALID_STATUS_TRANSITION",
                "Chỉ bệnh nhân đang chờ mới được bắt đầu khám",
                status=400,
            )

        appointment.status = 'IN_PROGRESS'
        appointment.save(update_fields=['status', 'updated_at'])
        return success_response(
            {"appointment": AppointmentListSerializer(appointment).data},
            message="Bắt đầu lượt khám thành công",
        )


class MedicalRecordCreateView(APIView):
    def post(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        if not _check_role(request, 'DOCTOR'):
            return error_response("FORBIDDEN", "Chỉ bác sĩ được ghi bệnh án", status=403)

        serializer = MedicalRecordCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ",
                status=400,
                details=serializer.errors,
            )

        appointment_id = serializer.validated_data['appointmentId']

        try:
            appointment = Appointment.objects.select_related('doctor', 'patient').get(pk=appointment_id)
        except Appointment.DoesNotExist:
            return error_response(
                "APPOINTMENT_NOT_FOUND",
                "Không tìm thấy lịch hẹn",
                status=404,
            )

        if appointment.doctor_id != request.user.id:
            return error_response("FORBIDDEN", "Bạn không được ghi bệnh án cho bác sĩ khác", status=403)
        if appointment.status != 'IN_PROGRESS':
            return error_response(
                "INVALID_STATUS_TRANSITION",
                "Chỉ lượt khám đang thực hiện mới được hoàn thành",
                status=400,
            )

        with transaction.atomic():
            if MedicalRecord.objects.filter(appointment_id=appointment_id).exists():
                return error_response(
                    "RECORD_EXISTS",
                    "Bệnh án cho lịch hẹn này đã tồn tại",
                    status=409,
                )

            medical_record = MedicalRecord.objects.create(
                appointment=appointment,
                illness_history=serializer.validated_data['symptoms'],
                diagnosis=serializer.validated_data['diagnosis'],
                examination_note=serializer.validated_data.get('notes', '') or '',
                status='SIGNED',
                signed_by=request.user,
                signed_at=timezone.now(),
            )
            appointment.status = 'COMPLETED'
            appointment.save(update_fields=['status', 'updated_at'])

        return success_response(
            {"medicalRecord": MedicalRecordSerializer(medical_record).data},
            message="Lưu bệnh án thành công",
            status=201,
        )


class DashboardTodayView(APIView):
    def get(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        today = timezone.localdate()
        now = timezone.now()

        queryset = Appointment.objects.select_related('patient', 'doctor').filter(
            appointment_time__date=today
        )
        if _check_role(request, 'DOCTOR'):
            queryset = queryset.filter(doctor_id=request.user.id)

        pending_count = queryset.filter(status='PENDING').count()
        confirmed_count = queryset.filter(status='CONFIRMED').count()
        in_progress_count = queryset.filter(status='IN_PROGRESS').count()
        completed_count = queryset.filter(status='COMPLETED').count()
        cancelled_count = queryset.filter(status='CANCELLED').count()

        upcoming_queryset = queryset.filter(
            appointment_time__gte=now,
            status__in=('CONFIRMED', 'WAITING', 'IN_PROGRESS'),
        ).order_by('appointment_time')[:5]
        upcoming_appointments = [
            {
                'id': str(appointment.id),
                'patientName': appointment.patient.full_name,
                'patientCode': appointment.patient.patient_code,
                'doctorName': appointment.doctor.full_name,
                'appointmentTime': timezone.localtime(appointment.appointment_time).isoformat(),
                'status': appointment.status,
            }
            for appointment in upcoming_queryset
        ]

        return success_response(
            {
                'todayStats': {
                    'total': queryset.count(),
                    'pending': pending_count,
                    'confirmed': confirmed_count,
                    'inProgress': in_progress_count,
                    'completed': completed_count,
                    'cancelled': cancelled_count,
                },
                'upcomingAppointments': upcoming_appointments,
            },
            message="Lấy dữ liệu dashboard thành công",
        )


class AppointmentStatsView(APIView):
    permission_classes = [IsManager]  # noqa: RUF012

    def get(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        if not _check_role(request, 'MANAGER'):
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        start_date_raw = request.query_params.get('startDate')
        end_date_raw = request.query_params.get('endDate')
        group_by = request.query_params.get('groupBy')

        if not start_date_raw or not end_date_raw or not group_by:
            return error_response(
                "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ",
                status=400,
                details={
                    'startDate': 'Bắt buộc',
                    'endDate': 'Bắt buộc',
                    'groupBy': 'Bắt buộc',
                },
            )

        start_date = _parse_date(start_date_raw)
        end_date = _parse_date(end_date_raw)

        if start_date is None or end_date is None:
            return error_response(
                "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ",
                status=400,
                details={
                    'startDate': 'Định dạng phải là YYYY-MM-DD',
                    'endDate': 'Định dạng phải là YYYY-MM-DD',
                },
            )

        if end_date < start_date:
            return error_response(
                "INVALID_DATE_RANGE",
                "Ngày kết thúc không được trước ngày bắt đầu",
                status=400,
            )

        queryset = Appointment.objects.select_related('doctor').filter(
            appointment_time__date__range=(start_date, end_date)
        )

        if group_by == 'status':
            stats = [
                {'label': row['status'], 'count': row['count']}
                for row in queryset.values('status').annotate(count=Count('id')).order_by('status')
            ]
        elif group_by == 'doctor':
            stats = [
                {'doctorId': str(row['doctor_id']), 'doctorName': row['doctor__full_name'], 'count': row['count']}
                for row in queryset.values('doctor_id', 'doctor__full_name').annotate(count=Count('id')).order_by('doctor__full_name')
            ]
        elif group_by == 'day':
            stats = [
                {'date': row['date'].isoformat(), 'count': row['count']}
                for row in queryset.annotate(date=TruncDate('appointment_time')).values('date').annotate(count=Count('id')).order_by('date')
            ]
        else:
            return error_response(
                "VALIDATION_ERROR",
                "groupBy không hợp lệ",
                status=400,
                details={'groupBy': 'Phải là status, doctor hoặc day'},
            )

        return success_response(
            {'stats': stats},
            message="Lấy thống kê thành công",
        )
