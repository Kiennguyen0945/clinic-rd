from django.db.models.deletion import ProtectedError
from rest_framework import generics, status
from rest_framework.response import Response

from core.api.permissions import IsAuthenticatedReadOnlyManagerWrite
from core.api.responses import error_response

from ..models import Department, DoctorDepartment, Room
from ..selectors import departments, doctor_departments, rooms
from .serializers import (
    DepartmentSerializer,
    DoctorDepartmentSerializer,
    RoomSerializer,
)


class ProtectedDeleteMixin:
    resource_label = "Dữ liệu"

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if getattr(instance, "has_appointments", False):
            return error_response(
                "RESOURCE_HAS_APPOINTMENTS",
                f"Không thể xóa {self.resource_label.lower()} vì đã có lịch hẹn",
                status=409,
            )
        try:
            instance.delete()
        except ProtectedError:
            return error_response(
                "RESOURCE_IN_USE",
                f"Không thể xóa {self.resource_label.lower()} vì đang có dữ liệu liên quan",
                status=409,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DepartmentListCreateView(generics.ListCreateAPIView):
    serializer_class = DepartmentSerializer
    permission_classes = (IsAuthenticatedReadOnlyManagerWrite,)

    def get_queryset(self):
        return departments()


class DepartmentDetailView(ProtectedDeleteMixin, generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = (IsAuthenticatedReadOnlyManagerWrite,)
    resource_label = "Khoa"


class RoomListCreateView(generics.ListCreateAPIView):
    serializer_class = RoomSerializer
    permission_classes = (IsAuthenticatedReadOnlyManagerWrite,)

    def get_queryset(self):
        return rooms()


class RoomDetailView(ProtectedDeleteMixin, generics.RetrieveUpdateDestroyAPIView):
    queryset = Room.objects.select_related("department", "doctor")
    serializer_class = RoomSerializer
    permission_classes = (IsAuthenticatedReadOnlyManagerWrite,)
    resource_label = "Phòng"


class DoctorDepartmentListCreateView(generics.ListCreateAPIView):
    serializer_class = DoctorDepartmentSerializer
    permission_classes = (IsAuthenticatedReadOnlyManagerWrite,)

    def get_queryset(self):
        doctor_id = self.request.query_params.get("doctor_id")
        return doctor_departments(doctor_id=int(doctor_id) if doctor_id else None)


class DoctorDepartmentDetailView(ProtectedDeleteMixin, generics.RetrieveDestroyAPIView):
    queryset = DoctorDepartment.objects.select_related("doctor", "department")
    serializer_class = DoctorDepartmentSerializer
    permission_classes = (IsAuthenticatedReadOnlyManagerWrite,)
    resource_label = "Phân công bác sĩ"
