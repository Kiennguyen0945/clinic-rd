from django.db.models import Prefetch, Q

from organization_service.models import DoctorDepartment

from ..models import User


def list_users():
    return User.objects.select_related("role").all()


def list_staff():
    return _staff_queryset().filter(role__code__in=("RECEPTIONIST", "DOCTOR"))


def get_user_by_username(username):
    try:
        return User.objects.select_related("role").get(username=username)
    except User.DoesNotExist:
        return None


def get_user(user_id):
    try:
        return User.objects.select_related("role").get(pk=user_id)
    except User.DoesNotExist:
        return None


def get_staff(user_id):
    try:
        return _staff_queryset().get(
            pk=user_id,
            role__code__in=("RECEPTIONIST", "DOCTOR"),
        )
    except User.DoesNotExist:
        return None


def staff_has_clinical_dependencies(user):
    return User.objects.filter(pk=user.pk).filter(
        Q(doctor_appointments__isnull=False)
        | Q(created_appointments__isnull=False)
        | Q(signed_medical_records__isnull=False)
        | Q(prescriptions__isnull=False)
    ).exists()


def _staff_queryset():
    assignments = DoctorDepartment.objects.select_related("department").order_by(
        "department__name"
    )
    return User.objects.select_related("role").prefetch_related(
        Prefetch("department_assignments", queryset=assignments)
    ).order_by("full_name", "id")
