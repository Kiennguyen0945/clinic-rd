from datetime import datetime

from django.db import transaction
from django.db.models import Count, Max
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.views import APIView

from auth_service.models import User
from backend.permissions import IsManager
from backend.response_utils import error_response, success_response
from patient_service.models import Patient
from organization_service.models import Department

from .models import Appointment, DoctorSlot, MedicalRecord
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
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        return None


def _set_slot_status(slot):
    if not slot:
        return
    active_count = slot.appointments.exclude(status='CANCELLED').count()
    next_status = 'FULL' if active_count >= slot.capacity else 'AVAILABLE'
    if slot.status != next_status and slot.status != 'CANCELLED':
        slot.status = next_status
        slot.save(update_fields=['status'])


def _next_sequence(target_date, slot=None, doctor=None):
    queryset = Appointment.objects.filter(
        appointment_time__date=target_date,
        status__in=('CONFIRMED', 'WAITING', 'IN_PROGRESS', 'COMPLETED'),
    )
    if slot:
        queryset = queryset.filter(slot=slot)
    elif doctor:
        queryset = queryset.filter(doctor=doctor)
    return (queryset.aggregate(max_sequence=Max('sequence_number'))['max_sequence'] or 0) + 1


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
        appointment_time = data.get('appointment_time')
        if appointment_time is None:
            if booking_type == 'SCHEDULE':
                return error_response(
                    "VALIDATION_ERROR",
                    "Dữ liệu không hợp lệ",
                    status=400,
                    details={"appointmentTime": "Bắt buộc với lịch đặt trước"},
                )
            appointment_time = timezone.now()
        if timezone.is_naive(appointment_time):
            appointment_time = timezone.make_aware(appointment_time, timezone.get_current_timezone())
        appointment_local = timezone.localtime(appointment_time)
        if booking_type == 'SCHEDULE' and appointment_time <= timezone.now():
            return error_response("PAST_TIME", "Thời gian hẹn phải trong tương lai", status=400)

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

        slot = None
        slot_id = data.get('slotId')
        if slot_id is not None:
            try:
                slot = DoctorSlot.objects.select_related('doctor', 'room').get(pk=slot_id)
            except DoctorSlot.DoesNotExist:
                return error_response("SLOT_NOT_FOUND", "Không tìm thấy ca khám", status=404)

            if slot.status == 'CANCELLED':
                return error_response("SLOT_CANCELLED", "Ca khám đã bị hủy", status=400)
            if slot.doctor_id != doctor.id:
                return error_response("SLOT_DOCTOR_MISMATCH", "Ca khám không thuộc bác sĩ đã chọn", status=400)
            if appointment_local.date() != slot.slot_date:
                return error_response("SLOT_TIME_MISMATCH", "Thời gian không thuộc ngày của ca khám", status=400)
            local_time = appointment_local.time()
            if not (slot.start_time <= local_time < slot.end_time):
                return error_response("SLOT_TIME_MISMATCH", "Thời gian không nằm trong ca khám", status=400)
            if slot.appointments.exclude(status='CANCELLED').count() >= slot.capacity:
                return error_response("SLOT_FULL", "Ca khám đã đủ số lượng", status=409)

        department = None
        department_id = data.get('departmentId')
        if department_id is not None:
            try:
                department = Department.objects.get(pk=department_id)
            except Department.DoesNotExist:
                return error_response("DEPARTMENT_NOT_FOUND", "Không tìm thấy khoa", status=404)

        with transaction.atomic():
            if slot:
                slot = DoctorSlot.objects.select_for_update().get(pk=slot.pk)
                if slot.appointments.exclude(status='CANCELLED').count() >= slot.capacity:
                    return error_response("SLOT_FULL", "Ca khám đã đủ số lượng", status=409)
            sequence_number = _next_sequence(appointment_local.date())
            appointment = Appointment.objects.create(
                slot=slot,
                patient=patient,
                doctor=doctor,
                creator=request.user,
                appointment_code=f"LH{appointment_local:%Y%m%d}{sequence_number:03d}",
                department=department,
                sequence_number=sequence_number,
                booking_type=booking_type,
                patient_type=patient_type,
                bhyt_number=(data.get('bhytNumber') or '').strip() or None,
                appointment_time=appointment_time,
                reason=data.get('reason', ''),
                status='CONFIRMED' if booking_type == 'SCHEDULE' else 'WAITING',
            )
            _set_slot_status(slot)

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
                "Không thể sửa lịch hẹn đã hoàn thành",
                status=400,
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

        if 'appointment_time' in validated_data:
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

        if 'doctorId' in validated_data:
            doctor_id = validated_data['doctorId']
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
            appointment.doctor = doctor

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
        elif appointment.status not in ('PENDING', 'CONFIRMED', 'WAITING'):
            return error_response(
                "INVALID_STATUS_TRANSITION",
                "Lễ tân chỉ có thể hủy lịch đã đặt hoặc đang chờ",
                status=400,
            )

        appointment.status = 'CANCELLED'
        appointment.save(update_fields=['status', 'cancellation_reason', 'updated_at'])
        _set_slot_status(appointment.slot)

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
        appointment.save(update_fields=['status', 'updated_at'])
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
                symptoms=serializer.validated_data['symptoms'],
                diagnosis=serializer.validated_data['diagnosis'],
                notes=serializer.validated_data.get('notes', ''),
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
    permission_classes = [IsManager]

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
