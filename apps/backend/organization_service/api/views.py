from rest_framework import generics

from ..models import Department, DoctorDepartment, Room
from ..selectors import departments, doctor_departments, rooms
from .serializers import (
    DepartmentSerializer,
    DoctorDepartmentSerializer,
    RoomSerializer,
)


class DepartmentListCreateView(generics.ListCreateAPIView):
    serializer_class = DepartmentSerializer

    def get_queryset(self):
        return departments()


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer


class RoomListCreateView(generics.ListCreateAPIView):
    serializer_class = RoomSerializer

    def get_queryset(self):
        return rooms()


class RoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer


class DoctorDepartmentListCreateView(generics.ListCreateAPIView):
    serializer_class = DoctorDepartmentSerializer

    def get_queryset(self):
        doctor_id = self.request.query_params.get("doctor_id")
        return doctor_departments(doctor_id=int(doctor_id) if doctor_id else None)


class DoctorDepartmentDetailView(generics.RetrieveDestroyAPIView):
    queryset = DoctorDepartment.objects.select_related("doctor", "department")
    serializer_class = DoctorDepartmentSerializer
