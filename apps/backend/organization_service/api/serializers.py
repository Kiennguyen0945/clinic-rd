# ruff: noqa: RUF012

from rest_framework import serializers

from auth_service.models import User

from ..models import Department, DoctorDepartment, Room
from ..services import assign_doctor_to_department, create_department, create_room


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "code", "name", "description"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        return create_department(**validated_data)


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ["id", "room_number"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        return create_room(**validated_data)


class DoctorDepartmentSerializer(serializers.ModelSerializer):
    doctor_id = serializers.PrimaryKeyRelatedField(
        source="doctor",
        queryset=User.objects.all(),
    )
    department_id = serializers.PrimaryKeyRelatedField(
        source="department",
        queryset=Department.objects.all(),
    )

    class Meta:
        model = DoctorDepartment
        fields = ["id", "doctor_id", "department_id"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        assignment, _ = assign_doctor_to_department(**validated_data)
        return assignment
