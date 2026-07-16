from datetime import datetime

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.views import APIView

from auth_service.models import User
from backend.permissions import IsManager
from backend.response_utils import error_response, success_response
from patient_service.models import Patient

from .models import Appointment, MedicalRecord
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

        queryset = Appointment.objects.select_related('patient', 'doctor').filter(
            appointment_time__date=target_date
        )

        status_filter = request.query_params.get('status')
        if status_filter:
            allowed_statuses = {choice[0] for choice in Appointment.STATUS_CHOICES}
            if status_filter not in allowed_statuses:
                return error_response(
                    "VALIDATION_ERROR",
                    "Trạng thái không hợp lệ",
                    status=400,
                    details={"status": "Phải là PENDING, CONFIRMED, COMPLETED hoặc CANCELLED"},
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

        appointment_time = serializer.validated_data['appointment_time']
        if timezone.is_naive(appointment_time):
            appointment_time = timezone.make_aware(appointment_time, timezone.get_current_timezone())
        if appointment_time <= timezone.now():
            return error_response(
                "PAST_TIME",
                "Thời gian hẹn phải trong tương lai",
                status=400,
            )

        patient_id = serializer.validated_data['patientId']
        doctor_id = serializer.validated_data['doctorId']

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

        appointment = Appointment.objects.create(
            patient=patient,
            doctor=doctor,
            creator=request.user,
            appointment_time=appointment_time,
            reason=serializer.validated_data.get('reason', ''),
            status='PENDING',
        )

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
                "Không thể huỷ lịch hẹn đã hoàn thành",
                status=400,
            )

        appointment.status = 'CANCELLED'
        appointment.save(update_fields=['status', 'updated_at'])

        return success_response(
            {"appointment": AppointmentListSerializer(appointment).data},
            message="Huỷ lịch hẹn thành công",
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
        confirmed_count = queryset.filter(status='CONFIRMED', appointment_time__gt=now).count()
        in_progress_count = queryset.filter(status='CONFIRMED', appointment_time__lte=now).count()
        completed_count = queryset.filter(status='COMPLETED').count()
        cancelled_count = queryset.filter(status='CANCELLED').count()

        upcoming_queryset = queryset.filter(appointment_time__gte=now).order_by('appointment_time')[:5]
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
                {
                    'doctorId': str(row['doctor_id']),
                    'doctorName': row['doctor__full_name'],
                    'count': row['count'],
                }
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
