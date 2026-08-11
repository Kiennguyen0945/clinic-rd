from django.contrib.auth.hashers import check_password, make_password

from . import AuthServiceError


def change_password(*, user, current_password, new_password, confirmation):
    if not check_password(current_password or "", user.password_hash):
        raise AuthServiceError("WRONG_PASSWORD", "Mật khẩu hiện tại không đúng")
    if new_password != confirmation:
        raise AuthServiceError(
            "PASSWORD_MISMATCH",
            "Xác nhận mật khẩu mới không khớp",
        )
    if not new_password or len(new_password) < 6:
        raise AuthServiceError(
            "WEAK_PASSWORD",
            "Mật khẩu mới phải có ít nhất 6 ký tự",
        )

    user.password_hash = make_password(new_password)
    user.save(update_fields=["password_hash", "updated_at"])
    return user
