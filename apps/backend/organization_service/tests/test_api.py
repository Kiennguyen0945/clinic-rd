from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from organization_service.models import Department, Room

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
