# ruff: noqa: RUF012

from rest_framework import serializers

from .models import MedicalRecord, Prescription, PrescriptionItem


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


class PrescriptionItemSerializer(serializers.ModelSerializer):
    medicationName = serializers.CharField(source='medication_name')
    durationDays = serializers.IntegerField(source='duration_days')

    class Meta:
        model = PrescriptionItem
        fields = ['id', 'medicationName', 'dosage', 'durationDays', 'quantity', 'instructions']


class MedicalRecordDetailSerializer(serializers.ModelSerializer):
    appointmentId = serializers.IntegerField(source='appointment_id', read_only=True)
    illnessHistory = serializers.CharField(source='illness_history')
    vitalSigns = serializers.CharField(source='vital_signs')
    examinationNote = serializers.CharField(source='examination_note')
    signedBy = serializers.IntegerField(source='signed_by_id', read_only=True, allow_null=True)
    signedAt = serializers.DateTimeField(source='signed_at', read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)
    prescription = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = [
            'id',
            'appointmentId',
            'illnessHistory',
            'vitalSigns',
            'examinationNote',
            'diagnosis',
            'status',
            'signedBy',
            'signedAt',
            'createdAt',
            'updatedAt',
            'prescription',
        ]
        read_only_fields = [
            'id',
            'appointmentId',
            'status',
            'signedBy',
            'signedAt',
            'createdAt',
            'updatedAt',
            'prescription',
        ]

    def get_prescription(self, obj):
        try:
            prescription = obj.prescription
        except Prescription.DoesNotExist:
            return None
        return {
            'id': prescription.id,
            'medicalRecordId': prescription.medical_record_id,
            'prescribedBy': prescription.prescribed_by_id,
            'createdAt': prescription.created_at,
            'items': PrescriptionItemSerializer(prescription.items.all(), many=True).data,
        }
