from datetime import date, datetime, time

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from appointment_service.models import Appointment, DoctorSlot
from organization_service.models import Department, Room
from patient_service.models import Patient

from .factories import create_staff


class OrganizationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = create_staff(role_code="MANAGER", username="manager")
        self.client.force_authenticate(self.manager)

    def test_create_and_list_departments(self):
        response = self.client.post(
            reverse("department-list"),
            {"code": " noi ", "name": " Internal Medicine "},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Department.objects.get().code, "NOI")
        self.assertEqual(self.client.get(reverse("department-list")).status_code, 200)

    def test_manager_creates_room_for_department(self):
        department = Department.objects.create(code="NOI", name="Internal Medicine")

        response = self.client.post(
            reverse("room-list"),
            {
                "room_number": " Room 101 ",
                "description": "General consultation room",
                "department_id": department.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        room = Room.objects.get()
        self.assertEqual(room.room_number, "Room 101")
        self.assertEqual(room.department, department)
        self.assertEqual(response.data["department"]["id"], department.id)

    def test_receptionist_can_read_but_cannot_modify(self):
        receptionist = create_staff(role_code="RECEPTIONIST", username="receptionist")
        self.client.force_authenticate(receptionist)

        self.assertEqual(self.client.get(reverse("department-list")).status_code, 200)
        denied = self.client.post(
            reverse("department-list"),
            {"code": "NOI", "name": "Internal Medicine"},
            format="json",
        )
        self.assertEqual(denied.status_code, 403)

    def test_cannot_delete_department_with_rooms(self):
        department = Department.objects.create(code="NOI", name="Internal Medicine")
        Room.objects.create(room_number="Room 101", department=department)

        response = self.client.delete(
            reverse("department-detail", args=[department.id])
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["code"], "RESOURCE_IN_USE")

    def test_appointment_locks_department_and_room_identity_and_deletion(self):
        doctor = create_staff(role_code="DOCTOR", username="doctor")
        patient = Patient.objects.create(
            patient_code="P001", full_name="Patient", dob=date(1990, 1, 1),
            gender="F", phone="0900000000", address="Test address",
        )
        department = Department.objects.create(code="NOI", name="Internal Medicine")
        room = Room.objects.create(room_number="Room 101", department=department)
        slot = DoctorSlot.objects.create(
            doctor=doctor, room=room, slot_date=date(2026, 8, 17),
            start_time=time(6), end_time=time(7),
        )
        Appointment.objects.create(
            slot=slot, patient=patient, doctor=doctor, creator=self.manager,
            department=department,
            appointment_time=timezone.make_aware(datetime(2026, 8, 17, 6)),
        )

        room_update = self.client.patch(
            reverse("room-detail", args=[room.id]),
            {"room_number": "Room 102"}, format="json",
        )
        department_update = self.client.patch(
            reverse("department-detail", args=[department.id]),
            {"name": "New name"}, format="json",
        )

        self.assertEqual(room_update.status_code, 400)
        self.assertEqual(department_update.status_code, 400)
        self.assertEqual(
            self.client.delete(reverse("room-detail", args=[room.id])).status_code,
            409,
        )
        self.assertEqual(
            self.client.delete(reverse("department-detail", args=[department.id])).status_code,
            409,
        )

        room.refresh_from_db()
        department.refresh_from_db()
        self.assertEqual(room.room_number, "Room 101")
        self.assertEqual(department.name, "Internal Medicine")
