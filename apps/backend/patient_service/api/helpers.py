from core.api.responses import error_response


def require_auth(request):
    if not request.user.is_authenticated:
        return error_response("UNAUTHORIZED", "Vui lòng đăng nhập", status=401)
    return None


def has_role(request, *roles: str) -> bool:
    return request.user.role.code in roles
