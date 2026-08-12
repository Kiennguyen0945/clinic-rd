from django.test import TestCase

from auth_service.services import AuthServiceError
from auth_service.services.authenticate_user import authenticate_user, refresh_session

from .factories import create_user


class AuthenticationServiceTests(TestCase):
    def test_authenticates_and_refreshes_active_user(self):
        user = create_user(username="doctor")

        session = authenticate_user(username="doctor", password="secret123")
        refreshed = refresh_session(refresh_token=session["refreshToken"])

        self.assertEqual(session["user"]["id"], str(user.id))
        self.assertIn("token", refreshed)
        self.assertIn("refreshToken", refreshed)

    def test_rejects_invalid_credentials(self):
        create_user(username="doctor")

        with self.assertRaises(AuthServiceError) as caught:
            authenticate_user(username="doctor", password="wrong")

        self.assertEqual(caught.exception.code, "INVALID_CREDENTIALS")

    def test_locked_account_is_reported_before_password_validation(self):
        create_user(username="doctor", status="LOCKED")

        with self.assertRaises(AuthServiceError) as caught:
            authenticate_user(username="doctor", password="wrong")

        self.assertEqual(caught.exception.code, "ACCOUNT_LOCKED")
