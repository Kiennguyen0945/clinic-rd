"""Backward-compatible exports for organization API views."""

from .api.views import (
    DepartmentDetailView,
    DepartmentListCreateView,
    DoctorDepartmentDetailView,
    DoctorDepartmentListCreateView,
    RoomDetailView,
    RoomListCreateView,
)

__all__ = [
    "DepartmentDetailView",
    "DepartmentListCreateView",
    "DoctorDepartmentDetailView",
    "DoctorDepartmentListCreateView",
    "RoomDetailView",
    "RoomListCreateView",
]
