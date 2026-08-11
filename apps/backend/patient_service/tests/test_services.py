from django.test import TestCase

from patient_service.services import (
    create_patient,
    generate_patient_code,
    update_patient,
)

from .factories import create_patient as patient_factory


class PatientServiceTests(TestCase):
    def test_generate_patient_code_uses_global_sequence(self):
        patient_factory(patient_code="BN-00000009")

        self.assertEqual(generate_patient_code(), "BN-00000010")

    def test_create_patient_generates_code(self):
        patient = create_patient(
            validated_data={
                "full_name": "New Patient",
                "dob": "2000-01-01",
                "gender": "F",
                "phone": "0911222333",
                "address": "",
            }
        )

        self.assertEqual(patient.patient_code, "BN-00000001")

    def test_update_patient_only_changes_allowed_fields(self):
        patient = patient_factory()

        update_patient(
            patient=patient,
            validated_data={"full_name": "Updated Patient"},
        )

        patient.refresh_from_db()
        self.assertEqual(patient.full_name, "Updated Patient")
