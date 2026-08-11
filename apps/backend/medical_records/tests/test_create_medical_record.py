from django.test import TestCase

from medical_records.services import MedicalRecordServiceError
from medical_records.services.create_medical_record import get_or_create_draft

from .factories import medical_record_context


class CreateMedicalRecordTests(TestCase):
    def test_creates_one_draft_and_is_idempotent(self):
        _, appointment = medical_record_context()

        record, created = get_or_create_draft(appointment_id=appointment.id)
        same_record, created_again = get_or_create_draft(appointment_id=appointment.id)

        self.assertTrue(created)
        self.assertFalse(created_again)
        self.assertEqual(record, same_record)
        self.assertEqual(record.status, "DRAFT")

    def test_rejects_appointment_that_is_not_in_progress(self):
        _, appointment = medical_record_context(appointment_status="CONFIRMED")

        with self.assertRaises(MedicalRecordServiceError) as caught:
            get_or_create_draft(appointment_id=appointment.id)

        self.assertEqual(caught.exception.code, "INVALID_APPOINTMENT_STATUS")
