from django.db import transaction
from django.utils import timezone

from ..models import User
from . import AuthServiceError
from .staff_names import format_staff_name


@transaction.atomic
def update_profile(
    *, user, full_name, email, phone="", gender="", date_of_birth=None, address=""
):
    if date_of_birth and date_of_birth > timezone.localdate():
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Thông tin cá nhân không hợp lệ",
            details={"dateOfBirth": "Ngày sinh không thể ở tương lai"},
        )
    if User.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
        raise AuthServiceError("DUPLICATE_EMAIL", "Email đã tồn tại")

    user.full_name = format_staff_name(full_name, user.role.code)
    user.email = email.lower()
    user.phone = phone
    user.gender = gender
    user.date_of_birth = date_of_birth
    user.address = address
    user.save(
        update_fields=[
            "full_name", "email", "phone", "gender", "date_of_birth",
            "address", "updated_at",
        ]
    )
    return user
