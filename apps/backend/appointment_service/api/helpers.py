from datetime import datetime

from django.utils import timezone

from backend.response_utils import error_response


def require_auth(request):
    if not getattr(request.user, 'is_authenticated', False):
        return error_response('UNAUTHORIZED', 'Vui lòng đăng nhập', status=401)
    return None


def has_role(request, *roles):
    return getattr(getattr(request.user, 'role', None), 'code', None) in roles


def parse_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_date(value):
    if not value:
        return timezone.localdate()
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()  # noqa: DTZ007
    except ValueError:
        return None
