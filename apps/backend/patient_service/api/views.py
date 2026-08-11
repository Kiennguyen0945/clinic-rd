import re

from django.core.paginator import EmptyPage, Paginator
from rest_framework.decorators import api_view
from rest_framework.views import APIView

from core.api.responses import error_response, success_response
from medical_records.serializers import MedicalRecordListSerializer

from ..models import Patient
from ..selectors import medical_history, patient_by_id, patients
from ..services import PATIENT_UPDATE_FIELDS, create_patient, update_patient
from .helpers import has_role, require_auth
from .serializers import PatientSerializer

PHONE_PATTERN = re.compile(r"^\d{10,11}$")

# Historical private aliases retained for integrations that imported them.
_require_auth = require_auth
_check_role = has_role


def _pagination(request):
    try:
        page = max(1, int(request.query_params.get("page", 1)))
        page_size = min(100, max(1, int(request.query_params.get("pageSize", 10))))
    except (TypeError, ValueError):
        return None
    return page, page_size


class PatientMedicalHistoryView(APIView):
    def get(self, request, patientId):
        if auth_err := require_auth(request):
            return auth_err
        if not has_role(request, "DOCTOR"):
            return error_response(
                "FORBIDDEN",
                "Bạn không có quyền truy cập",
                status=403,
            )
        try:
            patient_by_id(patientId)
        except Patient.DoesNotExist:
            return error_response(
                "PATIENT_NOT_FOUND",
                "Không tìm thấy bệnh nhân",
                status=404,
            )
        serializer = MedicalRecordListSerializer(
            medical_history(patient_id=patientId),
            many=True,
        )
        return success_response(
            {"medicalRecords": serializer.data},
            message="Lấy lịch sử bệnh án thành công",
        )


@api_view(["GET", "POST"])
def patient_list(request):
    if auth_err := require_auth(request):
        return auth_err

    if request.method == "GET":
        if not has_role(request, "RECEPTIONIST", "DOCTOR", "MANAGER"):
            return error_response(
                "FORBIDDEN",
                "Bạn không có quyền truy cập",
                status=403,
            )
        pagination = _pagination(request)
        if pagination is None:
            return error_response(
                "VALIDATION_ERROR",
                "Thông tin phân trang không hợp lệ",
                status=400,
            )
        page, page_size = pagination
        keyword = (request.query_params.get("keyword") or "").strip()
        queryset = patients(
            keyword=keyword,
            gender=(request.query_params.get("gender") or "").strip().upper(),
            age_group=(request.query_params.get("age") or "").strip(),
        )
        paginator = Paginator(queryset, page_size)
        try:
            patient_page = paginator.page(page)
        except EmptyPage:
            patient_page = paginator.page(paginator.num_pages)
        serializer = PatientSerializer(patient_page.object_list, many=True)
        return success_response(
            {
                "patients": serializer.data,
                "pagination": {
                    "page": patient_page.number,
                    "pageSize": page_size,
                    "totalItems": paginator.count,
                    "totalPages": paginator.num_pages,
                },
            },
            message=(
                "Tìm kiếm bệnh nhân thành công"
                if keyword
                else "Lấy danh sách bệnh nhân thành công"
            ),
        )

    if not has_role(request, "RECEPTIONIST"):
        return error_response(
            "FORBIDDEN",
            "Bạn không có quyền thực hiện hành động này",
            status=403,
        )
    phone = request.data.get("phone", "")
    if not PHONE_PATTERN.fullmatch(phone):
        return error_response(
            "VALIDATION_ERROR",
            "Số điện thoại không hợp lệ",
            status=400,
            details={"phone": "Số điện thoại phải có 10-11 chữ số"},
        )
    force = request.data.get("force", False) in (True, "true", "True")
    if not force and Patient.objects.filter(phone=phone).exists():
        return error_response(
            "DUPLICATE_PHONE",
            "Số điện thoại này có thể đã tồn tại. Vui lòng kiểm tra lại.",
            status=400,
        )
    serializer = PatientSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            status=400,
            details=serializer.errors,
        )
    patient = create_patient(validated_data=serializer.validated_data)
    return success_response(
        {"patient": PatientSerializer(patient).data},
        message="Tạo hồ sơ bệnh nhân thành công",
        status=201,
    )


@api_view(["GET", "PUT"])
def patient_detail(request, pk):
    if auth_err := require_auth(request):
        return auth_err
    try:
        patient = patient_by_id(pk)
    except Patient.DoesNotExist:
        return error_response(
            "PATIENT_NOT_FOUND",
            "Không tìm thấy bệnh nhân",
            status=404,
        )

    if request.method == "GET":
        if not has_role(request, "RECEPTIONIST", "DOCTOR", "MANAGER"):
            return error_response(
                "FORBIDDEN",
                "Bạn không có quyền truy cập",
                status=403,
            )
        return success_response(
            {"patient": PatientSerializer(patient).data},
            message="Lấy thông tin bệnh nhân thành công",
        )

    if not has_role(request, "RECEPTIONIST"):
        return error_response(
            "FORBIDDEN",
            "Bạn không có quyền thực hiện hành động này",
            status=403,
        )
    update_data = {
        field: request.data[field]
        for field in PATIENT_UPDATE_FIELDS
        if field in request.data
    }
    if "phone" in update_data and not PHONE_PATTERN.fullmatch(update_data["phone"]):
        return error_response(
            "VALIDATION_ERROR",
            "Số điện thoại không hợp lệ",
            status=400,
            details={"phone": "Số điện thoại phải có 10-11 chữ số"},
        )
    serializer = PatientSerializer(patient, data=update_data, partial=True)
    if not serializer.is_valid():
        return error_response(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            status=400,
            details=serializer.errors,
        )
    patient = update_patient(
        patient=patient,
        validated_data=serializer.validated_data,
    )
    return success_response(
        {"patient": PatientSerializer(patient).data},
        message="Cập nhật thông tin thành công",
    )
