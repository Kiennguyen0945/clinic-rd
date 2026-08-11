"""Organization write operations."""

from .assign_doctor import assign_doctor_to_department
from .create_department import create_department
from .create_room import create_room

__all__ = ["assign_doctor_to_department", "create_department", "create_room"]
