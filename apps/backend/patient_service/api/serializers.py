# ruff: noqa: RUF012

from rest_framework import serializers

from ..models import Patient


class PatientSerializer(serializers.ModelSerializer):
    def validate_cccd(self, value):
        return value or None

    def validate_email(self, value):
        return value or None

    class Meta:
        model = Patient
        fields = [
            "id",
            "patient_code",
            "full_name",
            "dob",
            "gender",
            "phone",
            "email",
            "cccd",
            "address",
            "insurance_number",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "patient_code", "created_at", "updated_at"]
        extra_kwargs = {"address": {"required": False, "allow_blank": True}}
