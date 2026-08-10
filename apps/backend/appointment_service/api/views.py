from django.utils import timezone
from rest_framework.views import APIView

from auth_service.models import User
from backend.permissions import IsManager
from backend.response_utils import error_response, success_response
from patient_service.models import Patient

from ..models import Appointment, DoctorSlot
from ..selectors.appointment_queries import (
    appointment_queue,
    appointment_stats,
    appointments_for_date,
    dashboard_today,
    reception_context,
)
from ..selectors.slot_queries import (
    slot_payload,
    slot_with_appointments,
    slots_for_date,
)
from ..services import AppointmentServiceError
from ..services.cancel_appointment import cancel_appointment
from ..services.check_in_appointment import check_in_appointment
from ..services.complete_appointment import complete_appointment
from ..services.create_appointment import create_from_data, generate_appointment_code
from ..services.reschedule_appointment import update_appointment
from .helpers import has_role, parse_date, parse_int, require_auth
from .presenters import (
    appointment_data,
    appointment_list_data,
    medical_record_data,
    service_error_response,
    slot_detail_data,
)
from .serializers import (
    AppointmentCreateSerializer,
    AppointmentUpdateSerializer,
    MedicalRecordCreateSerializer,
)

# Historical private names remain aliases so integrations that patched the old
# module during tests continue to work after the extraction.
_require_auth = require_auth
_check_role = has_role
_parse_date = parse_date
_parse_int = parse_int
_slot_payload = slot_payload


def generate_patient_code():
    """Generate the next global patient code: BN-########."""
    codes = Patient.objects.filter(patient_code__startswith='BN-').values_list('patient_code', flat=True)
    last_sequence = max(
        (int(code[3:]) for code in codes if len(code[3:]) == 8 and code[3:].isdigit()),
        default=0,
    )
    return f'BN-{last_sequence + 1:08d}'


class AppointmentReceptionContextView(APIView):
    def get(self, request):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'RECEPTIONIST', 'MANAGER'):
            return error_response('FORBIDDEN', 'Bạn không có quyền truy cập', status=403)
        target_date = parse_date(request.query_params.get('date'))
        if target_date is None:
            return error_response('VALIDATION_ERROR', 'Ngày không hợp lệ', status=400)
        return success_response(
            reception_context(target_date, now=timezone.now()),
            message='Lấy dữ liệu tiếp nhận thành công',
        )


class DoctorSlotListView(APIView):
    def get(self, request):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response('FORBIDDEN', 'Bạn không có quyền truy cập', status=403)
        target_date = parse_date(request.query_params.get('date'))
        if target_date is None:
            return error_response('VALIDATION_ERROR', 'Ngày không hợp lệ', status=400)
        doctor_id = request.query_params.get('doctorId')
        if doctor_id and not has_role(request, 'DOCTOR') and parse_int(doctor_id) is None:
            return error_response('VALIDATION_ERROR', 'doctorId không hợp lệ', status=400)
        doctor = None
        if has_role(request, 'DOCTOR'):
            doctor = request.user
        elif doctor_id:
            doctor = User.objects.select_related('role').get(pk=doctor_id)
        booking_type = request.query_params.get('bookingType', 'SCHEDULE').upper()
        if booking_type not in dict(Appointment.BOOKING_TYPE_CHOICES):
            return error_response('VALIDATION_ERROR', 'bookingType không hợp lệ', status=400)
        slots = slots_for_date(target_date, doctor=doctor)
        return success_response(
            {'slots': [slot_payload(slot, booking_type) for slot in slots]},
            message='Lấy danh sách ca khám thành công',
        )


class DoctorSlotDetailView(APIView):
    def get(self, request, pk):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response('FORBIDDEN', 'Bạn không có quyền truy cập', status=403)
        try:
            slot, appointments = slot_with_appointments(pk)
        except DoctorSlot.DoesNotExist:
            return error_response('SLOT_NOT_FOUND', 'Không tìm thấy ca khám', status=404)
        if has_role(request, 'DOCTOR') and slot.doctor_id != request.user.id:
            return error_response('FORBIDDEN', 'Bạn không có quyền truy cập', status=403)
        data = slot_detail_data(
            slot,
            appointments,
            booking_type=request.query_params.get('bookingType', 'SCHEDULE').upper(),
            slot_payload=slot_payload,
        )
        return success_response(data, message='Lấy chi tiết ca khám thành công')


class AppointmentQueueView(APIView):
    def get(self, request):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response('FORBIDDEN', 'Bạn không có quyền truy cập', status=403)
        target_date = parse_date(request.query_params.get('date'))
        if target_date is None:
            return error_response('VALIDATION_ERROR', 'Ngày không hợp lệ', status=400)
        queryset = appointment_queue(
            target_date,
            doctor_id=request.user.id if has_role(request, 'DOCTOR') else None,
            keyword=(request.query_params.get('keyword') or '').strip(),
        )
        return success_response(appointment_list_data(queryset), message='Lấy danh sách chờ thành công')


class AppointmentListView(APIView):
    def get(self, request):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response('FORBIDDEN', 'Bạn không có quyền truy cập', status=403)
        target_date = parse_date(request.query_params.get('date'))
        if target_date is None:
            return error_response('VALIDATION_ERROR', 'Ngày không hợp lệ', status=400,
                                  details={'date': 'Định dạng phải là YYYY-MM-DD'})
        status_filter = request.query_params.get('status')
        if status_filter:
            status_filter = status_filter.upper()
            if status_filter not in dict(Appointment.STATUS_CHOICES):
                return error_response('VALIDATION_ERROR', 'Trạng thái không hợp lệ', status=400, details={
                    'status': 'Phải là PENDING, CONFIRMED, WAITING, IN_PROGRESS, COMPLETED hoặc CANCELLED'})
        doctor_id = request.user.id if has_role(request, 'DOCTOR') else None
        if not doctor_id and request.query_params.get('doctorId'):
            doctor_id = parse_int(request.query_params['doctorId'])
            if doctor_id is None:
                return error_response('VALIDATION_ERROR', 'doctorId không hợp lệ', status=400,
                                      details={'doctorId': 'Phải là số nguyên'})
        queryset = appointments_for_date(target_date, status=status_filter, doctor_id=doctor_id)
        return success_response(appointment_list_data(queryset), message='Lấy danh sách lịch hẹn thành công')

    def post(self, request):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'RECEPTIONIST'):
            return error_response('FORBIDDEN', 'Bạn không có quyền thực hiện hành động này', status=403)
        serializer = AppointmentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', status=400, details=serializer.errors)
        try:
            appointment = create_from_data(data=serializer.validated_data, creator=request.user, now=timezone.now())
        except AppointmentServiceError as exc:
            return service_error_response(exc)
        return success_response(appointment_data(appointment), message='Tạo lịch hẹn thành công', status=201)


class AppointmentCreateView(APIView):
    def post(self, request):
        return AppointmentListView().post(request)


class AppointmentUpdateView(APIView):
    def put(self, request, pk):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'RECEPTIONIST'):
            return error_response('FORBIDDEN', 'Bạn không có quyền thực hiện hành động này', status=403)
        try:
            target = Appointment.objects.only('status').get(pk=pk)
        except Appointment.DoesNotExist:
            return error_response('APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn', status=404)
        if target.status not in ('CONFIRMED', 'WAITING'):
            return error_response('INVALID_STATUS_FOR_UPDATE', 'Không thể đổi lịch ở trạng thái hiện tại', status=409)
        serializer = AppointmentUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', status=400, details=serializer.errors)
        try:
            appointment = update_appointment(appointment_id=pk, data=serializer.validated_data, now=timezone.now())
        except AppointmentServiceError as exc:
            return service_error_response(exc)
        return success_response(appointment_data(appointment), message='Cập nhật lịch hẹn thành công')


class AppointmentCancelView(APIView):
    def patch(self, request, pk):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'RECEPTIONIST', 'DOCTOR'):
            return error_response('FORBIDDEN', 'Bạn không có quyền thực hiện hành động này', status=403)
        try:
            appointment = Appointment.objects.select_related('patient', 'doctor').get(pk=pk)
        except Appointment.DoesNotExist:
            return error_response('APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn', status=404)
        try:
            appointment = cancel_appointment(
                appointment,
                actor=request.user,
                cancellation_reason=request.data.get('cancellationReason') or '',
                cancellation_note=request.data.get('cancellationNote') or '',
            )
        except AppointmentServiceError as exc:
            return service_error_response(exc)
        return success_response(appointment_data(appointment), message='Huỷ lịch hẹn thành công')


class AppointmentCheckInView(APIView):
    def post(self, request, pk):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'RECEPTIONIST'):
            return error_response('FORBIDDEN', 'Chỉ lễ tân được xác nhận bệnh nhân đã đến', status=403)
        try:
            appointment = Appointment.objects.select_related('patient', 'doctor', 'slot').get(pk=pk)
        except Appointment.DoesNotExist:
            return error_response('APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn', status=404)
        try:
            appointment = check_in_appointment(appointment, checked_in_at=timezone.now())
        except AppointmentServiceError as exc:
            return service_error_response(exc)
        return success_response(appointment_data(appointment), message='Bệnh nhân đã được tiếp nhận')


class AppointmentStartView(APIView):
    def post(self, request, pk):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'DOCTOR'):
            return error_response('FORBIDDEN', 'Chỉ bác sĩ được bắt đầu lượt khám', status=403)
        try:
            appointment = Appointment.objects.select_related('patient', 'doctor', 'slot').get(pk=pk)
        except Appointment.DoesNotExist:
            return error_response('APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn', status=404)
        if appointment.doctor_id != request.user.id:
            return error_response('FORBIDDEN', 'Bạn không được xử lý lịch khám của bác sĩ khác', status=403)
        if appointment.status != 'WAITING':
            return error_response('INVALID_STATUS_TRANSITION', 'Chỉ bệnh nhân đang chờ mới được bắt đầu khám', status=400)
        appointment.status = 'IN_PROGRESS'
        appointment.save(update_fields=['status', 'updated_at'])
        return success_response(appointment_data(appointment), message='Bắt đầu lượt khám thành công')


class MedicalRecordCreateView(APIView):
    def post(self, request):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'DOCTOR'):
            return error_response('FORBIDDEN', 'Chỉ bác sĩ được ghi bệnh án', status=403)
        serializer = MedicalRecordCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', status=400, details=serializer.errors)
        try:
            record = complete_appointment(
                appointment_id=serializer.validated_data['appointmentId'],
                doctor=request.user,
                data=serializer.validated_data,
            )
        except AppointmentServiceError as exc:
            return service_error_response(exc)
        return success_response(medical_record_data(record), message='Lưu bệnh án thành công', status=201)


class DashboardTodayView(APIView):
    def get(self, request):
        if auth_err := require_auth(request):
            return auth_err
        data = dashboard_today(
            doctor_id=request.user.id if has_role(request, 'DOCTOR') else None,
            now=timezone.now(),
        )
        return success_response(data, message='Lấy dữ liệu dashboard thành công')


class AppointmentStatsView(APIView):
    permission_classes = [IsManager]  # noqa: RUF012

    def get(self, request):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, 'MANAGER'):
            return error_response('FORBIDDEN', 'Bạn không có quyền truy cập', status=403)
        start_raw, end_raw, group_by = (
            request.query_params.get('startDate'),
            request.query_params.get('endDate'),
            request.query_params.get('groupBy'),
        )
        if not start_raw or not end_raw or not group_by:
            return error_response('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', status=400,
                                  details={'startDate': 'Bắt buộc', 'endDate': 'Bắt buộc', 'groupBy': 'Bắt buộc'})
        start_date, end_date = parse_date(start_raw), parse_date(end_raw)
        if start_date is None or end_date is None:
            return error_response('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', status=400, details={
                'startDate': 'Định dạng phải là YYYY-MM-DD', 'endDate': 'Định dạng phải là YYYY-MM-DD'})
        if end_date < start_date:
            return error_response('INVALID_DATE_RANGE', 'Ngày kết thúc không được trước ngày bắt đầu', status=400)
        stats = appointment_stats(start_date, end_date, group_by)
        if stats is None:
            return error_response('VALIDATION_ERROR', 'groupBy không hợp lệ', status=400,
                                  details={'groupBy': 'Phải là status, doctor hoặc day'})
        return success_response({'stats': stats}, message='Lấy thống kê thành công')
