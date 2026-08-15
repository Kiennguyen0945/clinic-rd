# ruff: noqa: RUF012

from rest_framework import serializers

from auth_service.models import User

from ..models import Department, DoctorDepartment, Room
from ..services import assign_doctor_to_department, create_department, create_room


class DepartmentSerializer(serializers.ModelSerializer):
    has_appointments = serializers.BooleanField(read_only=True)

    class Meta:
        model = Department
        fields = ["id", "code", "name", "description", "has_appointments"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        return create_department(**validated_data)

    def validate(self, attrs):
        if self.instance and self.instance.has_appointments:
            locked = {
                field: "Không thể thay đổi vì khoa đã có lịch hẹn"
                for field in ("code", "name")
                if field in attrs and attrs[field] != getattr(self.instance, field)
            }
            if locked:
                raise serializers.ValidationError(locked)
        return attrs


class RoomSerializer(serializers.ModelSerializer):
    has_appointments = serializers.BooleanField(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        source="department",
        queryset=Department.objects.all(),
    )
    department = DepartmentSerializer(read_only=True)
    doctor_id = serializers.PrimaryKeyRelatedField(
        source="doctor",
        queryset=User.objects.filter(role__code="DOCTOR", status="ACTIVE"),
        required=False,
        allow_null=True,
    )
    doctor = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            "id", "room_number", "description", "department_id", "department",
            "doctor_id", "doctor",
            "has_appointments",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        return create_room(**validated_data)

    def get_doctor(self, obj):
        if not obj.doctor_id:
            return None
        return {
            "id": obj.doctor_id,
            "username": obj.doctor.username,
            "full_name": obj.doctor.full_name,
        }

    def validate(self, attrs):
        if self.instance and self.instance.has_appointments:
            locked = {}
            if "room_number" in attrs and attrs["room_number"] != self.instance.room_number:
                locked["room_number"] = "Không thể thay đổi vì phòng đã có lịch hẹn"
            if "department" in attrs and attrs["department"] != self.instance.department:
                locked["department_id"] = "Không thể thay đổi vì phòng đã có lịch hẹn"
            if locked:
                raise serializers.ValidationError(locked)
        department = attrs.get("department", getattr(self.instance, "department", None))
        doctor = attrs.get("doctor", getattr(self.instance, "doctor", None))
        if doctor and department and not doctor.department_assignments.filter(
            department=department
        ).exists():
            raise serializers.ValidationError(
                {"doctor_id": "Bác sĩ không thuộc khoa đã chọn"}
            )
        return attrs


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
