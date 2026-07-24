from rest_framework.decorators import api_view
from rest_framework.views import APIView
from django.db.models import Q
import re
from .models import Patient
from .serializers import PatientSerializer
from backend.response_utils import success_response, error_response
from appointment_service.models import MedicalRecord
from appointment_service.views import generate_patient_code
from appointment_service.serializers import MedicalRecordListSerializer


def _require_auth(request):
    """Return error response if not authenticated, else None."""
    if not request.user.is_authenticated:
        return error_response("UNAUTHORIZED", "Vui lòng đăng nhập", status=401)
    return None


def _check_role(request, *roles):
    """Check if user has one of the specified roles. Must call _require_auth first."""
    return request.user.role.code in roles


class PatientMedicalHistoryView(APIView):
    def get(self, request, patientId):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        if not _check_role(request, 'DOCTOR'):
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        try:
            Patient.objects.get(pk=patientId)
        except Patient.DoesNotExist:
            return error_response(
                "PATIENT_NOT_FOUND",
                "Không tìm thấy bệnh nhân",
                status=404,
            )

        records = MedicalRecord.objects.select_related('appointment', 'appointment__doctor').filter(
            appointment__patient_id=patientId
        ).order_by('-appointment__appointment_time')

        serializer = MedicalRecordListSerializer(records, many=True)
        return success_response(
            {"medicalRecords": serializer.data},
            message="Lấy lịch sử bệnh án thành công",
        )


@api_view(['GET', 'POST'])
def patient_list(request):
    auth_err = _require_auth(request)
    if auth_err:
        return auth_err

    if request.method == 'GET':
        # Search - require receptionist, doctor, or manager
        if not _check_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        keyword = (request.query_params.get('keyword') or '').strip()
        patients = Patient.objects.all().order_by('-created_at')
        if keyword:
            patients = patients.filter(
                Q(patient_code__icontains=keyword) |
                Q(full_name__icontains=keyword) |
                Q(phone__icontains=keyword)
            )

        serializer = PatientSerializer(patients, many=True)
        return success_response(
            {"patients": serializer.data},
            message="Lấy danh sách bệnh nhân thành công" if not keyword else "Tìm kiếm bệnh nhân thành công"
        )

    elif request.method == 'POST':
        # Create - require receptionist only
        if not _check_role(request, 'RECEPTIONIST'):
            return error_response("FORBIDDEN", "Bạn không có quyền thực hiện hành động này", status=403)

        phone = request.data.get('phone', '')

        # Validate phone format
        if not re.match(r'^\d{10,11}$', phone):
            return error_response(
                "VALIDATION_ERROR",
                "Số điện thoại không hợp lệ",
                status=400,
                details={"phone": "Số điện thoại phải có 10-11 chữ số"}
            )

        # Check duplicate phone (skip if force=True)
        force = request.data.get('force', False) in (True, 'true', 'True')
        if not force and Patient.objects.filter(phone=phone).exists():
            return error_response(
                "DUPLICATE_PHONE",
                "Số điện thoại này có thể đã tồn tại. Vui lòng kiểm tra lại.",
                status=400
            )

        patient_code = generate_patient_code()

        serializer = PatientSerializer(data={
            **request.data,
            'patient_code': patient_code
        })

        if serializer.is_valid():
            serializer.save()
            return success_response(
                {"patient": serializer.data},
                message="Tạo hồ sơ bệnh nhân thành công",
                status=201
            )

        return error_response(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            status=400,
            details=serializer.errors
        )


@api_view(['GET', 'PUT'])
def patient_detail(request, pk):
    auth_err = _require_auth(request)
    if auth_err:
        return auth_err

    try:
        patient = Patient.objects.get(pk=pk)
    except Patient.DoesNotExist:
        return error_response(
            "PATIENT_NOT_FOUND",
            "Không tìm thấy bệnh nhân",
            status=404
        )

    if request.method == 'GET':
        # Detail - require receptionist, doctor, or manager
        if not _check_role(request, 'RECEPTIONIST', 'DOCTOR', 'MANAGER'):
            return error_response("FORBIDDEN", "Bạn không có quyền truy cập", status=403)

        serializer = PatientSerializer(patient)
        return success_response(
            {"patient": serializer.data},
            message="Lấy thông tin bệnh nhân thành công"
        )

    elif request.method == 'PUT':
        # Update - require receptionist only
        if not _check_role(request, 'RECEPTIONIST'):
            return error_response("FORBIDDEN", "Bạn không có quyền thực hiện hành động này", status=403)

        # Only update allowed fields
        allowed_fields = ['full_name', 'phone', 'address', 'insurance_number']
        update_data = {}
        for field in allowed_fields:
            if field in request.data:
                update_data[field] = request.data[field]

        # Validate phone if provided
        if 'phone' in update_data:
            phone = update_data['phone']
            if not re.match(r'^\d{10,11}$', phone):
                return error_response(
                    "VALIDATION_ERROR",
                    "Số điện thoại không hợp lệ",
                    status=400,
                    details={"phone": "Số điện thoại phải có 10-11 chữ số"}
                )

        serializer = PatientSerializer(patient, data=update_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return success_response(
                {"patient": serializer.data},
                message="Cập nhật thông tin thành công"
            )

        return error_response(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            status=400,
            details=serializer.errors
        )
