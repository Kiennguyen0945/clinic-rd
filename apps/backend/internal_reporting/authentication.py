"""Authentication for server-to-server reporting requests."""

import secrets

from django.conf import settings


def has_valid_service_token(request):
    """Compare service credentials in constant time and reject empty values."""
    provided_token = request.headers.get("X-Service-Token", "")
    configured_token = settings.INTERNAL_SERVICE_TOKEN
    return bool(
        provided_token
        and configured_token
        and secrets.compare_digest(provided_token, configured_token)
    )
