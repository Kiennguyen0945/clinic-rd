from django.test import TestCase

from medical_records.models import PrescriptionItem
from medical_records.services.create_medical_record import get_or_create_draft
from medical_records.services.update_medical_record import update_medical_record
from medical_records.services.update_prescription import replace_prescription

from .factories import medical_record_context


class UpdateMedicalRecordTests(TestCase):
    def setUp(self):
        self.doctor, appointment = medical_record_context()
        self.record, _ = get_or_create_draft(appointment_id=appointment.id)

    def test_updates_clinical_fields(self):
        record = update_medical_record(
            record_id=self.record.id,
            data={"diagnosis": "Flu", "vitalSigns": "Stable"},
        )

        self.assertEqual(record.diagnosis, "Flu")
        self.assertEqual(record.vital_signs, "Stable")

    def test_replaces_prescription_items(self):
        record = replace_prescription(
            record_id=self.record.id,
            prescribed_by=self.doctor,
            items=[
                {
                    "medicationName": "Medicine",
                    "dosage": "Once daily",
                    "durationDays": 3,
                    "quantity": 3,
                    "instructions": "After food",
                }
            ],
        )

        item = PrescriptionItem.objects.get(prescription=record.prescription)
        self.assertEqual(item.medication_name, "Medicine")
        self.assertEqual(item.duration_days, 3)
