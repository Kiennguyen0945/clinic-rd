from ..selectors.user_queries import get_user
from . import AuthServiceError


def toggle_staff_lock(*, actor, user_id, action):
    if action not in {"lock", "unlock"}:
        raise AuthServiceError(
            "VALIDATION_ERROR",
            "Dữ liệu không hợp lệ",
            details={"action": "Phải là lock hoặc unlock"},
        )
    if str(actor.id) == str(user_id):
        raise AuthServiceError(
            "SELF_LOCK",
            "Không thể tự khóa tài khoản của chính mình",
        )

    user = get_user(user_id)
    if user is None:
        raise AuthServiceError(
            "USER_NOT_FOUND",
            "Không tìm thấy người dùng",
            status=404,
        )

    user.status = "LOCKED" if action == "lock" else "ACTIVE"
    user.save(update_fields=["status", "updated_at"])
    return user
