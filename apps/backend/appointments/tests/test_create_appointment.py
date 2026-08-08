from django.test import TestCase

from appointments.services import AppointmentServiceError
from appointments.services.create_appointment import create_appointment

from .factories import (
    doctor_context_factory,
    patient_factory,
    slot_factory,
    user_factory,
)


class CreateAppointmentTests(TestCase):
    def setUp(self):
        self.doctor, self.room, self.department = doctor_context_factory(
            suffix="create",
        )
        self.receptionist = user_factory(
            role_code="RECEPTIONIST",
            username="receptionist-create",
        )
        self.patient = patient_factory(code="BN-CREATE")
        self.slot = slot_factory(
            doctor=self.doctor,
            room=self.room,
            hour=10,
        )

    def test_creates_confirmed_scheduled_appointment(self):
        appointment = create_appointment(
            creator=self.receptionist,
            data={
                "patientId": self.patient.id,
                "doctorId": self.doctor.id,
                "departmentId": self.department.id,
                "slotId": self.slot.id,
                "bookingType": "SCHEDULE",
                "patientType": "SERVICE",
                "reason": "Routine check",
            },
        )

        self.assertEqual(appointment.status, "CONFIRMED")
        self.assertEqual(appointment.slot, self.slot)
        self.assertEqual(appointment.sequence_number, 1)
        self.assertTrue(appointment.appointment_code.startswith("LHK-"))

    def test_requires_insurance_number_for_bhyt_patient(self):
        with self.assertRaises(AppointmentServiceError) as context:
            create_appointment(
                creator=self.receptionist,
                data={
                    "patientId": self.patient.id,
                    "doctorId": self.doctor.id,
                    "slotId": self.slot.id,
                    "bookingType": "SCHEDULE",
                    "patientType": "BHYT",
                },
            )

        self.assertEqual(context.exception.code, "VALIDATION_ERROR")
        self.assertIn("bhytNumber", context.exception.details)
