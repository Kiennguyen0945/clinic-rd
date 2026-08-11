from django.test import TestCase

from medical_records.services import MedicalRecordServiceError
from medical_records.services.create_medical_record import get_or_create_draft
from medical_records.services.sign_medical_record import sign_medical_record

from .factories import medical_record_context


class SignMedicalRecordTests(TestCase):
    def test_signing_completes_the_appointment(self):
        doctor, appointment = medical_record_context()
        record, _ = get_or_create_draft(appointment_id=appointment.id)
        record.diagnosis = "Flu"
        record.save(update_fields=["diagnosis", "updated_at"])

        signed = sign_medical_record(record_id=record.id, signer=doctor)

        appointment.refresh_from_db()
        self.assertEqual(signed.status, "SIGNED")
        self.assertEqual(signed.signed_by, doctor)
        self.assertEqual(appointment.status, "COMPLETED")

    def test_diagnosis_is_required(self):
        doctor, appointment = medical_record_context()
        record, _ = get_or_create_draft(appointment_id=appointment.id)

        with self.assertRaises(MedicalRecordServiceError) as caught:
            sign_medical_record(record_id=record.id, signer=doctor)

        self.assertEqual(caught.exception.code, "DIAGNOSIS_REQUIRED")
