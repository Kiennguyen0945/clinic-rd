"""Role-based API permissions."""

from rest_framework.permissions import BasePermission


def _has_role(request, *role_codes):
    user = getattr(request, "user", None)
    role = getattr(user, "role", None)
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and getattr(role, "code", None) in role_codes
    )


class IsReceptionist(BasePermission):
    def has_permission(self, request, view):
        return _has_role(request, "RECEPTIONIST")


class IsDoctor(BasePermission):
    def has_permission(self, request, view):
        return _has_role(request, "DOCTOR")


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return _has_role(request, "MANAGER")


class IsReceptionistOrDoctor(BasePermission):
    def has_permission(self, request, view):
        return _has_role(request, "RECEPTIONIST", "DOCTOR")
