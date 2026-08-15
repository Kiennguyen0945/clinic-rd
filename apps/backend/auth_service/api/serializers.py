# ruff: noqa: RUF012

from django.contrib.auth.hashers import make_password
from rest_framework import serializers

from ..models import Role, User


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='role.code', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'phone', 'status', 'role']
        read_only_fields = ['id']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if password:
            validated_data['password_hash'] = make_password(password)
        elif 'password_hash' not in validated_data:
            validated_data['password_hash'] = make_password('default123')
        return super().create(validated_data)


class StaffCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=100)
    fullName = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=User.GENDER_CHOICES, required=False, allow_blank=True)
    dateOfBirth = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    roleCode = serializers.ChoiceField(choices=("RECEPTIONIST", "DOCTOR"))
    password = serializers.CharField(required=False, allow_blank=False, write_only=True)
    departmentId = serializers.IntegerField(required=False)
    roomId = serializers.IntegerField(required=False)

    def validate(self, attrs):
        if attrs["roleCode"] == "DOCTOR" and not attrs.get("departmentId"):
            raise serializers.ValidationError(
                {"departmentId": "Bác sĩ phải được phân khoa"}
            )
        return attrs


class StaffUpdateSerializer(serializers.Serializer):
    fullName = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=User.GENDER_CHOICES, required=False, allow_blank=True)
    dateOfBirth = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=User.STATUS_CHOICES)
    departmentId = serializers.IntegerField(required=False)


class PersonalProfileSerializer(serializers.Serializer):
    fullName = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.RegexField(
        regex=r"^\d{9,11}$", required=False, allow_blank=True,
        error_messages={"invalid": "Số điện thoại phải có 9–11 chữ số"},
    )
    gender = serializers.ChoiceField(
        choices=User.GENDER_CHOICES, required=False, allow_blank=True
    )
    dateOfBirth = serializers.DateField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)


class RoomAllocationSerializer(serializers.Serializer):
    roomId = serializers.IntegerField()
    date = serializers.DateField()
    startTime = serializers.TimeField()
    endTime = serializers.TimeField()
