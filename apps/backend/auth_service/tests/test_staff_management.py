from django.test import TestCase

from auth_service.models import Role
from auth_service.services import AuthServiceError
from auth_service.services.create_staff import create_staff
from auth_service.services.toggle_staff_lock import toggle_staff_lock

from .factories import create_user


class StaffManagementServiceTests(TestCase):
    def setUp(self):
        self.manager = create_user(role_code="MANAGER", username="manager")
        Role.objects.create(code="DOCTOR", name="Doctor")

    def test_creates_staff_and_returns_generated_password(self):
        user, generated_password = create_staff(
            username="new-doctor",
            full_name="New Doctor",
            phone="0900000001",
            role_code="DOCTOR",
        )

        self.assertEqual(user.role.code, "DOCTOR")
        self.assertEqual(len(generated_password), 8)

    def test_locks_and_unlocks_staff(self):
        staff = create_user(username="staff")

        toggle_staff_lock(actor=self.manager, user_id=staff.id, action="lock")
        staff.refresh_from_db()
        self.assertEqual(staff.status, "LOCKED")

        toggle_staff_lock(actor=self.manager, user_id=staff.id, action="unlock")
        staff.refresh_from_db()
        self.assertEqual(staff.status, "ACTIVE")

    def test_manager_cannot_lock_self(self):
        with self.assertRaises(AuthServiceError) as caught:
            toggle_staff_lock(
                actor=self.manager,
                user_id=self.manager.id,
                action="lock",
            )

        self.assertEqual(caught.exception.code, "SELF_LOCK")
