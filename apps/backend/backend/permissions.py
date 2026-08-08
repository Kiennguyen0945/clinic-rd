from rest_framework.permissions import BasePermission


class IsReceptionist(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role.code == 'RECEPTIONIST'
        )


class IsDoctor(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role.code == 'DOCTOR'
        )


class IsManager(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role.code == 'MANAGER'
        )


class IsReceptionistOrDoctor(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role.code in ('RECEPTIONIST', 'DOCTOR')
        )
