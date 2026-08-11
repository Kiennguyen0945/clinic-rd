from django.urls import path

from .views import (
    DepartmentDetailView,
    DepartmentListCreateView,
    DoctorDepartmentDetailView,
    DoctorDepartmentListCreateView,
    RoomDetailView,
    RoomListCreateView,
)

urlpatterns = [
    path("departments/", DepartmentListCreateView.as_view(), name="department-list"),
    path("departments/<int:pk>/", DepartmentDetailView.as_view(), name="department-detail"),
    path("rooms/", RoomListCreateView.as_view(), name="room-list"),
    path("rooms/<int:pk>/", RoomDetailView.as_view(), name="room-detail"),
    path(
        "doctor-departments/",
        DoctorDepartmentListCreateView.as_view(),
        name="doctor-department-list",
    ),
    path(
        "doctor-departments/<int:pk>/",
        DoctorDepartmentDetailView.as_view(),
        name="doctor-department-detail",
    ),
]
