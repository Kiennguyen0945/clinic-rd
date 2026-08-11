from django.test import TestCase

from auth_service.selectors.role_queries import get_role_by_code, list_roles
from auth_service.selectors.user_queries import get_user, get_user_by_username

from .factories import create_user


class AuthQueryTests(TestCase):
    def test_queries_users_and_roles(self):
        user = create_user(username="doctor")

        self.assertEqual(get_user(user.id), user)
        self.assertEqual(get_user_by_username("doctor"), user)
        self.assertEqual(get_role_by_code("DOCTOR"), user.role)
        self.assertEqual(list(list_roles()), [user.role])

    def test_missing_queries_return_none(self):
        self.assertIsNone(get_user(999999))
        self.assertIsNone(get_user_by_username("missing"))
        self.assertIsNone(get_role_by_code("MISSING"))
