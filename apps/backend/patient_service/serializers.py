from rest_framework import serializers
from .models import Patient


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            'id', 'patient_code', 'full_name', 'dob', 'gender',
            'phone', 'address', 'insurance_number', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'patient_code': {'required': False},
            'address': {'required': False, 'allow_blank': True},
        }
