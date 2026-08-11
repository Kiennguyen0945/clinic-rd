from django.contrib.auth.hashers import check_password
from django.test import TestCase

from auth_service.services import AuthServiceError
from auth_service.services.change_password import change_password

from .factories import create_user


class ChangePasswordServiceTests(TestCase):
    def test_changes_password(self):
        user = create_user()

        change_password(
            user=user,
            current_password="secret123",
            new_password="new-secret",
            confirmation="new-secret",
        )

        user.refresh_from_db()
        self.assertTrue(check_password("new-secret", user.password_hash))

    def test_rejects_mismatched_confirmation(self):
        user = create_user()

        with self.assertRaises(AuthServiceError) as caught:
            change_password(
                user=user,
                current_password="secret123",
                new_password="new-secret",
                confirmation="different",
            )

        self.assertEqual(caught.exception.code, "PASSWORD_MISMATCH")
