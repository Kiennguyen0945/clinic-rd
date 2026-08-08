from datetime import datetime

from django.db import transaction
from django.db.models import Case, Count, IntegerField, Q, Value, When
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.views import APIView

from appointments.models import Appointment, DoctorSlot
from appointments.selectors.slot_queries import slot_capacity as _slot_capacity
from appointments.selectors.slot_queries import slot_datetimes as _slot_datetimes
from appointments.selectors.slot_queries import slot_payload as _slot_payload
from appointments.selectors.slot_queries import (
    virtual_slots_for_date as _virtual_slots_for_date,
)
from appointments.services import AppointmentServiceError
from appointments.services.cancel_appointment import cancel_appointment
from appointments.services.check_in_appointment import (
    check_in_appointment,
    start_appointment,
)
from appointments.services.create_appointment import create_appointment
from appointments.services.reschedule_appointment import reschedule_appointment
from auth_service.models import User
from core.api.permissions import IsManager
from core.api.responses import error_response, success_response
from medical_records.models import MedicalRecord
from medical_records.serializers import (
    MedicalRecordCreateSerializer,
    MedicalRecordSerializer,
)
from organization_service.models import Department, DoctorDepartment, Room
from patient_service.models import Patient

from .serializers import (
    AppointmentCreateSerializer,
    AppointmentListSerializer,
    AppointmentUpdateSerializer,
)


def _require_auth(request):
    if not getattr(request.user, 'is_authenticated', False):
        return error_response("UNAUTHORIZED", "Vui lòng đăng nhập", status=401)
    return None


def _check_role(request, *roles):
    return getattr(getattr(request.user, 'role', None), 'code', None) in roles


def _service_error_response(exc):
    return error_response(
        exc.code,
        exc.message,
        status=exc.status,
        details=exc.details,
    )


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
        return AppointmentCreateView().post(request)

class AppointmentCreateView(APIView):
    def post(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err
        if not _check_role(request, 'RECEPTIONIST'):
            return error_response(
                "FORBIDDEN",
                "Bạn không có quyền thực hiện hành động này",
                status=403,
            )

        serializer = AppointmentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "VALIDATION_ERROR",
                "Dữ liệu không hợp lệ",
                status=400,
                details=serializer.errors,
            )
        try:
            appointment = create_appointment(
                data=serializer.validated_data,
                creator=request.user,
            )
        except AppointmentServiceError as exc:
            return _service_error_response(exc)

        return success_response(
            {"appointment": AppointmentListSerializer(appointment).data},
            message="Tạo lịch hẹn thành công",
            status=201,
        )


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

            requested_slot = (
                'slotId' in validated_data or 'slotKey' in validated_data
            )
            if requested_slot:
                try:
                    appointment = reschedule_appointment(
                        appointment=appointment,
                        target_doctor=target_doctor,
                        department=department,
                        requested_slot_id=validated_data.get('slotId'),
                        requested_slot_key=(
                            validated_data.get('slotKey') or ''
                        ),
                    )
                except AppointmentServiceError as exc:
                    return _service_error_response(exc)
                if 'reason' in validated_data:
                    appointment.reason = validated_data['reason']
                    appointment.save(update_fields=['reason', 'updated_at'])
                return success_response(
                    {
                        "appointment": AppointmentListSerializer(
                            appointment,
                        ).data,
                    },
                    message="Cập nhật lịch hẹn thành công",
                )

            if appointment.slot_id and (
                {'appointment_time', 'doctorId'} & validated_data.keys()
            ):
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
            appointment = cancel_appointment(
                appointment_id=pk,
                actor_id=request.user.id,
                actor_role=role,
                cancellation_reason=request.data.get('cancellationReason') or '',
                cancellation_note=request.data.get('cancellationNote') or '',
            )
        except AppointmentServiceError as exc:
            return _service_error_response(exc)

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
            appointment = check_in_appointment(appointment_id=pk)
        except AppointmentServiceError as exc:
            return _service_error_response(exc)
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
            appointment = start_appointment(
                appointment_id=pk,
                doctor_id=request.user.id,
            )
        except AppointmentServiceError as exc:
            return _service_error_response(exc)
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

