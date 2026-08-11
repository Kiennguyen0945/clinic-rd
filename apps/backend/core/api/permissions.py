from rest_framework.permissions import BasePermission


def _has_role(request, *role_codes):
    user = request.user
    return (
        user
        and user.is_authenticated
        and getattr(user, "role", None)
        and user.role.code in role_codes
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
