from rest_framework import serializers

from .models import Appointment, MedicalRecord


class AppointmentListSerializer(serializers.ModelSerializer):
    patient = serializers.SerializerMethodField()
    doctor = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id',
            'patient',
            'doctor',
            'appointment_time',
            'reason',
            'status',
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


class AppointmentCreateSerializer(serializers.Serializer):
    patientId = serializers.IntegerField(write_only=True)
    doctorId = serializers.IntegerField(write_only=True)
    appointmentTime = serializers.DateTimeField(source='appointment_time')
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate_reason(self, value):
        return value or ''

    def create(self, validated_data):
        return Appointment.objects.create(
            patient_id=validated_data['patientId'],
            doctor_id=validated_data['doctorId'],
            creator=validated_data['creator'],
            appointment_time=validated_data['appointment_time'],
            reason=validated_data.get('reason', ''),
            status='PENDING',
        )


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
