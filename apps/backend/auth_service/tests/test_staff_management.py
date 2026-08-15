from datetime import time, timedelta

from django.test import TestCase
from django.utils import timezone

from appointment_service.models import DEFAULT_SLOT_HOURS, DoctorSlot
from auth_service.models import Role
from auth_service.services import AuthServiceError
from auth_service.services.create_staff import create_staff
from auth_service.services.toggle_staff_lock import toggle_staff_lock
from organization_service.models import Department, Room

from .factories import create_user


class StaffManagementServiceTests(TestCase):
    def setUp(self):
        self.manager = create_user(role_code="MANAGER", username="manager")
        Role.objects.create(code="DOCTOR", name="Doctor")
        self.department = Department.objects.create(code="GENERAL", name="General")
        self.room = Room.objects.create(room_number="Room 101")

    def test_creates_staff_and_returns_generated_password(self):
        user, generated_password, allocation = create_staff(
            username="new-doctor",
            full_name="New Doctor",
            email="doctor@example.com",
            phone="0900000001",
            role_code="DOCTOR",
            department_id=self.department.id,
            room_id=self.room.id,
        )

        self.assertEqual(user.role.code, "DOCTOR")
        self.assertEqual(len(generated_password), 8)
        self.assertEqual(user.department_assignments.get().department, self.department)
        self.assertEqual(allocation["room"]["id"], self.room.id)
        self.assertEqual(allocation["slotCount"], len(DEFAULT_SLOT_HOURS))
        self.assertEqual(
            DoctorSlot.objects.filter(
                doctor=user,
                room=self.room,
                slot_date=timezone.localdate() + timedelta(days=1),
            ).count(),
            len(DEFAULT_SLOT_HOURS),
        )

    def test_rejects_room_already_allocated_for_tomorrow(self):
        existing_doctor = create_user(username="existing-doctor")
        DoctorSlot.objects.create(
            doctor=existing_doctor,
            room=self.room,
            slot_date=timezone.localdate() + timedelta(days=1),
            start_time=time(8),
            end_time=time(9),
        )

        with self.assertRaises(AuthServiceError) as caught:
            create_staff(
                username="new-doctor",
                full_name="New Doctor",
                email="new-doctor@example.com",
                phone="",
                role_code="DOCTOR",
                department_id=self.department.id,
                room_id=self.room.id,
            )

        self.assertEqual(caught.exception.code, "ROOM_UNAVAILABLE")

    def test_creates_unscheduled_doctor_when_room_is_omitted(self):
        user, _, allocation = create_staff(
            username="unscheduled-doctor",
            full_name="Unscheduled Doctor",
            email="unscheduled@example.com",
            phone="",
            role_code="DOCTOR",
            department_id=self.department.id,
        )

        self.assertIsNone(allocation)
        self.assertFalse(DoctorSlot.objects.filter(doctor=user).exists())

    def test_rejects_duplicate_email(self):
        create_user(username="existing", email="staff@example.com")

        with self.assertRaises(AuthServiceError) as caught:
            create_staff(
                username="new-staff",
                full_name="New Staff",
                email="STAFF@example.com",
                phone="",
                role_code="RECEPTIONIST",
            )

        self.assertEqual(caught.exception.code, "DUPLICATE_EMAIL")

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
