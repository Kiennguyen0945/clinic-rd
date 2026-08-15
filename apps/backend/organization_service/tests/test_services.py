from django.test import TestCase

from organization_service.services import (
    assign_doctor_to_department,
    create_department,
    create_room,
)

from .factories import create_doctor


class OrganizationServiceTests(TestCase):
    def test_create_department_normalizes_input(self):
        department = create_department(code=" noi ", name=" Internal Medicine ")

        self.assertEqual(department.code, "NOI")
        self.assertEqual(department.name, "Internal Medicine")

    def test_create_room_strips_room_number(self):
        department = create_department(code="NOI", name="Internal Medicine")
        room = create_room(
            room_number=" A-101 ",
            department=department,
            description=" Consultation room ",
        )

        self.assertEqual(room.room_number, "A-101")
        self.assertEqual(room.department, department)
        self.assertEqual(room.description, "Consultation room")

    def test_assign_doctor_is_idempotent(self):
        doctor = create_doctor()
        department = create_department(code="NOI", name="Internal Medicine")

        first, first_created = assign_doctor_to_department(
            doctor=doctor,
            department=department,
        )
        second, second_created = assign_doctor_to_department(
            doctor=doctor,
            department=department,
        )

        self.assertEqual(first, second)
        self.assertTrue(first_created)
        self.assertFalse(second_created)
