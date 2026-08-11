from rest_framework.views import APIView

from core.api.responses import error_response, success_response

from ..services import MedicalRecordServiceError
from ..services.create_medical_record import get_or_create_draft
from ..services.sign_medical_record import sign_medical_record
from ..services.update_medical_record import update_medical_record
from ..services.update_prescription import replace_prescription
from .serializers import MedicalRecordDetailSerializer


def _require_auth(request):
    if not getattr(request.user, "is_authenticated", False):
        return error_response("UNAUTHORIZED", "Vui lòng đăng nhập", status=401)
    return None


def _record_response(record, message="Thành công", status=200):
    return success_response(
        {"medicalRecord": MedicalRecordDetailSerializer(record).data},
        message=message,
        status=status,
    )


def _service_error_response(exc):
    return error_response(
        exc.code,
        exc.message,
        status=exc.status,
        details=exc.details,
    )


class AppointmentMedicalRecordView(APIView):
    def get(self, request, appointment_id):
        auth_error = _require_auth(request)
        if auth_error:
            return auth_error
        try:
            record, created = get_or_create_draft(appointment_id=appointment_id)
        except MedicalRecordServiceError as exc:
            return _service_error_response(exc)
        return _record_response(
            record,
            message=(
                "Tạo hồ sơ nháp thành công"
                if created
                else "Lấy hồ sơ bệnh án thành công"
            ),
            status=201 if created else 200,
        )


class MedicalRecordUpdateView(APIView):
    def patch(self, request, pk):
        auth_error = _require_auth(request)
        if auth_error:
            return auth_error
        try:
            record = update_medical_record(record_id=pk, data=request.data)
        except MedicalRecordServiceError as exc:
            return _service_error_response(exc)
        return _record_response(record, message="Cập nhật hồ sơ thành công")


class MedicalRecordPrescriptionView(APIView):
    def put(self, request, pk):
        auth_error = _require_auth(request)
        if auth_error:
            return auth_error
        try:
            record = replace_prescription(
                record_id=pk,
                prescribed_by=request.user,
                items=request.data.get("items"),
            )
        except MedicalRecordServiceError as exc:
            return _service_error_response(exc)
        return _record_response(record, message="Cập nhật đơn thuốc thành công")


class MedicalRecordSignView(APIView):
    def post(self, request, pk):
        auth_error = _require_auth(request)
        if auth_error:
            return auth_error
        try:
            record = sign_medical_record(record_id=pk, signer=request.user)
        except MedicalRecordServiceError as exc:
            return _service_error_response(exc)
        return _record_response(record, message="Ký hồ sơ thành công")
