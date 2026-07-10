from rest_framework import serializers
from .models import Role, User
from django.contrib.auth.hashers import make_password


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

