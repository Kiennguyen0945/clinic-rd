from django.test import TestCase

from medical_records.selectors.medical_record_queries import get_medical_record
from medical_records.services.create_medical_record import get_or_create_draft

from .factories import medical_record_context


class MedicalRecordQueryTests(TestCase):
    def test_gets_record_with_appointment(self):
        _, appointment = medical_record_context()
        record, _ = get_or_create_draft(appointment_id=appointment.id)

        selected = get_medical_record(record.id)

        self.assertEqual(selected.appointment, appointment)

    def test_returns_none_for_missing_record(self):
        self.assertIsNone(get_medical_record(999999))
