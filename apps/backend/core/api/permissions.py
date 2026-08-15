from rest_framework.permissions import SAFE_METHODS, BasePermission


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


class IsAuthenticatedReadOnlyManagerWrite(BasePermission):
    def has_permission(self, request, view):
        if not getattr(request.user, "is_authenticated", False):
            return False
        if request.method in SAFE_METHODS:
            return True
        return _has_role(request, "MANAGER")
