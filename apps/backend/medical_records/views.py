from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView

from appointment_service.models import Appointment
from backend.response_utils import error_response, success_response

from .models import MedicalRecord, Prescription, PrescriptionItem
from .serializers import MedicalRecordDetailSerializer

MEDICAL_RECORD_FIELDS = {
    'illnessHistory': 'illness_history',
    'vitalSigns': 'vital_signs',
    'examinationNote': 'examination_note',
    'diagnosis': 'diagnosis',
}


def _require_auth(request):
    if not getattr(request.user, 'is_authenticated', False):
        return error_response('UNAUTHORIZED', 'Vui lòng đăng nhập', status=401)
    return None


def _record_response(record, message='Thành công', status=200):
    return success_response(
        {'medicalRecord': MedicalRecordDetailSerializer(record).data},
        message=message,
        status=status,
    )


def _get_record(pk):
    try:
        return MedicalRecord.objects.select_related('appointment').get(pk=pk)
    except MedicalRecord.DoesNotExist:
        return None


class AppointmentMedicalRecordView(APIView):
    def get(self, request, appointment_id):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        try:
            appointment = Appointment.objects.get(pk=appointment_id)
        except Appointment.DoesNotExist:
            return error_response('APPOINTMENT_NOT_FOUND', 'Không tìm thấy lịch hẹn', status=404)

        if appointment.status != 'IN_PROGRESS':
            return error_response(
                'INVALID_APPOINTMENT_STATUS',
                'Chỉ có thể lập hồ sơ khi lượt khám đang ở trạng thái Đang khám',
                status=400,
            )

        with transaction.atomic():
            record, created = MedicalRecord.objects.get_or_create(
                appointment=appointment,
                defaults={
                    'illness_history': '',
                    'vital_signs': '',
                    'examination_note': '',
                    'diagnosis': '',
                    'status': 'DRAFT',
                },
            )

        return _record_response(
            record,
            message='Tạo hồ sơ nháp thành công' if created else 'Lấy hồ sơ bệnh án thành công',
            status=201 if created else 200,
        )


class MedicalRecordUpdateView(APIView):
    def patch(self, request, pk):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        record = _get_record(pk)
        if record is None:
            return error_response('MEDICAL_RECORD_NOT_FOUND', 'Không tìm thấy hồ sơ bệnh án', status=404)
        if record.status == 'SIGNED':
            return error_response('MEDICAL_RECORD_SIGNED', 'Hồ sơ đã ký, không thể chỉnh sửa', status=403)

        invalid_fields = [
            field for field in request.data
            if field not in MEDICAL_RECORD_FIELDS and field != 'status'
        ]
        if invalid_fields:
            return error_response(
                'VALIDATION_ERROR',
                'Có trường dữ liệu không hợp lệ',
                status=400,
                details={'fields': invalid_fields},
            )

        update_fields = []
        for request_field, model_field in MEDICAL_RECORD_FIELDS.items():
            if request_field in request.data:
                value = request.data[request_field]
                if value is None:
                    value = ''
                if not isinstance(value, str):
                    return error_response(
                        'VALIDATION_ERROR',
                        f'{request_field} phải là chuỗi',
                        status=400,
                    )
                setattr(record, model_field, value)
                update_fields.append(model_field)

        if update_fields:
            record.save(update_fields=[*update_fields, 'updated_at'])

        return _record_response(record, message='Cập nhật hồ sơ thành công')


def _validate_prescription_items(items):
    if not isinstance(items, list):
        return None, {'items': 'Phải là một mảng'}

    errors = {}
    validated_items = []
    for index, item in enumerate(items):
        item_errors = {}
        if not isinstance(item, dict):
            errors[f'items[{index}]'] = 'Phải là một object'
            continue

        medication_name = item.get('medicationName')
        if not isinstance(medication_name, str) or not medication_name.strip():
            item_errors['medicationName'] = 'Không được để trống'

        dosage = item.get('dosage', '')
        instructions = item.get('instructions', '')
        if dosage is None:
            dosage = ''
        if instructions is None:
            instructions = ''
        if not isinstance(dosage, str):
            item_errors['dosage'] = 'Phải là chuỗi'
        if not isinstance(instructions, str):
            item_errors['instructions'] = 'Phải là chuỗi'

        values = {}
        for field in ('quantity', 'durationDays'):
            value = item.get(field)
            if isinstance(value, bool) or not isinstance(value, int):
                item_errors[field] = 'Phải là số nguyên không âm'
            elif value < 0:
                item_errors[field] = 'Không được là số âm'
            else:
                values[field] = value

        if item_errors:
            errors[f'items[{index}]'] = item_errors
        else:
            validated_items.append({
                'medication_name': medication_name.strip(),
                'dosage': dosage,
                'duration_days': values['durationDays'],
                'quantity': values['quantity'],
                'instructions': instructions,
            })

    return validated_items, errors or None


class MedicalRecordPrescriptionView(APIView):
    def put(self, request, pk):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        record = _get_record(pk)
        if record is None:
            return error_response('MEDICAL_RECORD_NOT_FOUND', 'Không tìm thấy hồ sơ bệnh án', status=404)
        if record.status == 'SIGNED':
            return error_response('MEDICAL_RECORD_SIGNED', 'Hồ sơ đã ký, không thể chỉnh sửa đơn thuốc', status=403)

        items, errors = _validate_prescription_items(request.data.get('items'))
        if errors:
            return error_response('VALIDATION_ERROR', 'Dữ liệu đơn thuốc không hợp lệ', status=400, details=errors)

        with transaction.atomic():
            prescription, _ = Prescription.objects.get_or_create(
                medical_record=record,
                defaults={'prescribed_by': request.user},
            )
            prescription.prescribed_by = request.user
            prescription.save(update_fields=['prescribed_by'])
            prescription.items.all().delete()
            PrescriptionItem.objects.bulk_create(
                [PrescriptionItem(prescription=prescription, **item) for item in items]
            )
            record = MedicalRecord.objects.select_related('appointment').get(pk=record.pk)

        return _record_response(record, message='Cập nhật đơn thuốc thành công')


class MedicalRecordSignView(APIView):
    def post(self, request, pk):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        with transaction.atomic():
            try:
                record = MedicalRecord.objects.select_for_update().get(pk=pk)
            except MedicalRecord.DoesNotExist:
                return error_response('MEDICAL_RECORD_NOT_FOUND', 'Không tìm thấy hồ sơ bệnh án', status=404)
            appointment = Appointment.objects.select_for_update().get(pk=record.appointment_id)
            if record.status == 'SIGNED':
                return error_response('MEDICAL_RECORD_ALREADY_SIGNED', 'Hồ sơ đã được ký trước đó', status=409)
            if appointment.doctor_id != request.user.id:
                return error_response(
                    'FORBIDDEN',
                    'Chỉ bác sĩ được phân công cho lượt khám mới được ký hồ sơ',
                    status=403,
                )
            if not (record.diagnosis or '').strip():
                return error_response(
                    'DIAGNOSIS_REQUIRED',
                    'Không thể ký hồ sơ khi chưa có chẩn đoán',
                    status=400,
                )

            record.status = 'SIGNED'
            record.signed_by = request.user
            record.signed_at = timezone.now()
            record.save(update_fields=['status', 'signed_by', 'signed_at', 'updated_at'])
            appointment.status = 'COMPLETED'
            appointment.save(update_fields=['status', 'updated_at'])
        return _record_response(record, message='Ký hồ sơ thành công')
