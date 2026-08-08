"""Authentication shared by the API applications."""

from django.utils.translation import gettext_lazy as _
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
from rest_framework_simplejwt.settings import api_settings

from auth_service.models import User


class CustomJWTAuthentication(JWTAuthentication):
    """Resolve JWT subjects against the project's custom user model."""

    def get_user(self, validated_token):
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError as exc:
            raise InvalidToken(
                _("Token contained no recognizable user identification"),
            ) from exc

        try:
            user = User.objects.get(**{api_settings.USER_ID_FIELD: user_id})
        except User.DoesNotExist as exc:
            raise AuthenticationFailed(
                _("User not found"),
                code="user_not_found",
            ) from exc

        if api_settings.CHECK_USER_IS_ACTIVE and user.status != "ACTIVE":
            raise AuthenticationFailed(_("User is inactive"), code="user_inactive")

        return user
