from django.test import TestCase

from organization_service.selectors import departments, doctor_departments, rooms
from organization_service.services import (
    assign_doctor_to_department,
    create_department,
    create_room,
)

from .factories import create_doctor


class OrganizationSelectorTests(TestCase):
    def test_queries_are_ordered_and_filter_assignments(self):
        cardiology = create_department(code="CARD", name="Cardiology")
        create_department(code="DERM", name="Dermatology")
        create_room(room_number="B-2")
        create_room(room_number="A-1")
        doctor = create_doctor()
        assign_doctor_to_department(doctor=doctor, department=cardiology)

        self.assertEqual(list(departments().values_list("name", flat=True)), ["Cardiology", "Dermatology"])
        self.assertEqual(list(rooms().values_list("room_number", flat=True)), ["A-1", "B-2"])
        self.assertEqual(doctor_departments(doctor_id=doctor.id).count(), 1)
