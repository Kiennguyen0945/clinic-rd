from backend.response_utils import error_response

from .serializers import AppointmentListSerializer, MedicalRecordSerializer


def service_error_response(exc):
    return error_response(exc.code, exc.message, status=exc.status, details=exc.details)


def appointment_data(appointment):
    return {'appointment': AppointmentListSerializer(appointment).data}


def appointment_list_data(appointments):
    return {'appointments': AppointmentListSerializer(appointments, many=True).data}


def medical_record_data(record):
    return {'medicalRecord': MedicalRecordSerializer(record).data}


def slot_detail_data(slot, appointments, *, booking_type, slot_payload):
    return {
        'slot': slot_payload(slot, booking_type),
        'appointments': AppointmentListSerializer(appointments, many=True).data,
    }
