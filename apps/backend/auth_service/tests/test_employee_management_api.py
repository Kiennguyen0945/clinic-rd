from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from appointment_service.models import Appointment
from organization_service.models import Department, Room
from patient_service.models import Patient

from .factories import create_user


class EmployeeManagementApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = create_user(role_code="MANAGER", username="manager")
        self.receptionist = create_user(
            role_code="RECEPTIONIST", username="receptionist"
        )
        self.doctor = create_user(role_code="DOCTOR", username="doctor")
        self.department = Department.objects.create(code="GENERAL", name="General")
        self.room = Room.objects.create(room_number="Room 101")
        self.client.force_authenticate(self.manager)

    def test_manager_creates_and_lists_receptionist(self):
        response = self.client.post(
            "/api/auth/staff/",
            {
                "username": "new-receptionist",
                "fullName": "New Receptionist",
                "email": "new-receptionist@example.com",
                "phone": "0901234567",
                "roleCode": "RECEPTIONIST",
                "password": "Secret123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        employee_id = response.data["data"]["user"]["id"]
        listing = self.client.get("/api/auth/staff/")
        listed_ids = {item["id"] for item in listing.data["data"]}
        self.assertIn(employee_id, listed_ids)

    def test_manager_creates_doctor_with_department(self):
        response = self.client.post(
            "/api/auth/staff/",
            {
                "username": "new-doctor",
                "fullName": "New Doctor",
                "email": "new-doctor@example.com",
                "roleCode": "DOCTOR",
                "departmentId": self.department.id,
                "roomId": self.room.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data["data"]["user"]["departments"][0]["id"],
            self.department.id,
        )
        self.assertEqual(
            response.data["data"]["allocation"]["room"]["id"], self.room.id
        )
        self.assertGreater(response.data["data"]["allocation"]["slotCount"], 0)

    def test_manager_creates_unscheduled_doctor_then_allocates_room(self):
        created = self.client.post(
            "/api/auth/staff/",
            {
                "username": "unscheduled-doctor",
                "fullName": "Unscheduled Doctor",
                "email": "unscheduled@example.com",
                "roleCode": "DOCTOR",
                "departmentId": self.department.id,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertIsNone(created.data["data"]["allocation"])
        self.assertEqual(
            created.data["data"]["user"]["scheduleStatus"], "UNASSIGNED"
        )
        doctor_id = created.data["data"]["user"]["id"]

        allocated = self.client.post(
            f"/api/auth/staff/{doctor_id}/room-allocations/",
            {
                "roomId": self.room.id,
                "date": (timezone.localdate() + timedelta(days=1)).isoformat(),
                "startTime": "13:00",
                "endTime": "17:00",
            },
            format="json",
        )
        self.assertEqual(allocated.status_code, 201)
        self.assertEqual(allocated.data["data"]["allocation"]["slotCount"], 4)

        detail = self.client.get(f"/api/auth/staff/{doctor_id}/")
        self.assertEqual(detail.data["data"]["user"]["scheduleStatus"], "ASSIGNED")
        self.assertTrue(detail.data["data"]["user"]["canReceiveAppointments"])

    def test_detail_update_and_delete_without_clinical_activity(self):
        detail_url = f"/api/auth/staff/{self.receptionist.id}/"
        detail = self.client.get(detail_url)
        self.assertTrue(detail.data["data"]["user"]["canEdit"])
        self.assertTrue(detail.data["data"]["user"]["canDelete"])

        updated = self.client.patch(
            detail_url,
            {
                "fullName": "Updated Receptionist",
                "email": "updated@example.com",
                "phone": "0909999999",
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["data"]["user"]["fullName"], "Updated Receptionist")

        deleted = self.client.delete(detail_url)
        self.assertEqual(deleted.status_code, 200)

    def test_appointment_locks_employee_dynamically(self):
        patient = Patient.objects.create(
            patient_code="BN000001",
            full_name="Patient",
            dob="1990-01-01",
            gender="M",
            phone="0900000001",
            address="Address",
        )
        Appointment.objects.create(
            patient=patient,
            doctor=self.doctor,
            creator=self.receptionist,
            appointment_time=timezone.now(),
        )

        detail_url = f"/api/auth/staff/{self.receptionist.id}/"
        detail = self.client.get(detail_url)
        self.assertFalse(detail.data["data"]["user"]["canEdit"])
        self.assertFalse(detail.data["data"]["user"]["canDelete"])
        blocked_update = self.client.patch(
            detail_url,
            {
                "fullName": "Blocked Update",
                "email": "blocked@example.com",
                "phone": "",
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(blocked_update.status_code, 409)
        self.assertEqual(self.client.delete(detail_url).status_code, 409)

    def test_non_manager_cannot_access_employee_management(self):
        self.client.force_authenticate(self.receptionist)
        self.assertEqual(self.client.get("/api/auth/staff/").status_code, 403)

    def test_create_validation_and_duplicates(self):
        missing = self.client.post("/api/auth/staff/", {}, format="json")
        self.assertEqual(missing.status_code, 400)
        duplicate = self.client.post(
            "/api/auth/staff/",
            {
                "username": self.receptionist.username,
                "fullName": "Duplicate",
                "email": "other@example.com",
                "roleCode": "RECEPTIONIST",
            },
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(duplicate.data["error"]["code"], "DUPLICATE_USERNAME")
