from django.test import TestCase

from patient_service.selectors import patient_by_id, patients

from .factories import create_patient


class PatientSelectorTests(TestCase):
    def test_searches_patient_directory(self):
        patient = create_patient(full_name="Nguyễn Văn An")
        create_patient(
            patient_code="BN-00000002",
            full_name="Trần Thị Bình",
            phone="0900000002",
        )

        self.assertEqual(list(patients(keyword="Nguyễn")), [patient])
        self.assertEqual(patient_by_id(patient.id), patient)
