# ruff: noqa: RUF012

from rest_framework import serializers

from .models import MedicalRecord


class MedicalRecordSerializer(serializers.ModelSerializer):
    # Keep the existing API contract while storing the new domain names.
    symptoms = serializers.CharField(source='illness_history')
    notes = serializers.CharField(source='examination_note', allow_blank=True, allow_null=True)

    class Meta:
        model = MedicalRecord
        fields = ['id', 'appointment', 'symptoms', 'diagnosis', 'notes', 'created_at']


class MedicalRecordListSerializer(serializers.ModelSerializer):
    appointmentId = serializers.IntegerField(source='appointment.id', read_only=True)
    visitDate = serializers.DateTimeField(source='appointment.appointment_time', read_only=True, format='%Y-%m-%d %H:%M')
    doctorName = serializers.CharField(source='appointment.doctor.full_name', read_only=True)
    symptoms = serializers.CharField(source='illness_history', read_only=True)
    notes = serializers.CharField(source='examination_note', read_only=True)

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
