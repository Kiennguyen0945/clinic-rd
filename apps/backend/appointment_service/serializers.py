# ruff: noqa: RUF012

from rest_framework import serializers

from .models import Appointment, MedicalRecord


class AppointmentListSerializer(serializers.ModelSerializer):
    patient = serializers.SerializerMethodField()
    doctor = serializers.SerializerMethodField()
    slot = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id',
            'patient',
            'doctor',
            'slot',
            'slot_id',
            'appointment_code',
            'department_id',
            'department',
            'sequence_number',
            'booking_type',
            'patient_type',
            'bhyt_number',
            'appointment_time',
            'check_in_at',
            'reason',
            'status',
            'cancellation_reason',
            'cancellation_note',
            'created_at',
            'updated_at',
        ]

    def get_patient(self, obj):
        return {
            'id': str(obj.patient_id),
            'patientCode': obj.patient.patient_code,
            'fullName': obj.patient.full_name,
            'phone': obj.patient.phone,
        }

    def get_doctor(self, obj):
        return {
            'id': str(obj.doctor_id),
            'fullName': obj.doctor.full_name,
        }

    def get_slot(self, obj):
        if not obj.slot_id:
            return None
        return {
            'id': obj.slot_id,
            'slotDate': obj.slot.slot_date.isoformat(),
            'startTime': obj.slot.start_time.strftime('%H:%M'),
            'endTime': obj.slot.end_time.strftime('%H:%M'),
            'roomNumber': obj.slot.room.room_number,
            'status': obj.slot.status,
        }

    def get_department(self, obj):
        if not obj.department_id:
            return None
        return {'id': obj.department_id, 'name': obj.department.name}


class AppointmentCreateSerializer(serializers.Serializer):
    patientId = serializers.IntegerField(write_only=True)
    doctorId = serializers.IntegerField(write_only=True)
    slotId = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    slotKey = serializers.CharField(required=False, allow_blank=True, write_only=True)
    departmentId = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    appointmentTime = serializers.DateTimeField(source='appointment_time', required=False, allow_null=True)
    bookingType = serializers.ChoiceField(choices=Appointment.BOOKING_TYPE_CHOICES, required=False, default='SCHEDULE')
    patientType = serializers.ChoiceField(choices=Appointment.PATIENT_TYPE_CHOICES, required=False, default='SERVICE')
    bhytNumber = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    deferWalkIn = serializers.BooleanField(required=False, default=False, write_only=True)
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_reason(self, value):
        return value or ''

class AppointmentUpdateSerializer(serializers.Serializer):
    appointmentTime = serializers.DateTimeField(source='appointment_time', required=False)
    doctorId = serializers.IntegerField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_reason(self, value):
        return value or ''


class MedicalRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalRecord
        fields = ['id', 'appointment', 'symptoms', 'diagnosis', 'notes', 'created_at']


class MedicalRecordListSerializer(serializers.ModelSerializer):
    appointmentId = serializers.IntegerField(source='appointment.id', read_only=True)
    visitDate = serializers.DateTimeField(source='appointment.appointment_time', read_only=True, format='%Y-%m-%d %H:%M')
    doctorName = serializers.CharField(source='appointment.doctor.full_name', read_only=True)

    class Meta:
        model = MedicalRecord
        fields = [
            'id',
            'appointmentId',
            'visitDate',
            'doctorName',
            'symptoms',
            'diagnosis',
            'notes',
        ]



class MedicalRecordCreateSerializer(serializers.Serializer):
    appointmentId = serializers.IntegerField()
    symptoms = serializers.CharField()
    diagnosis = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
