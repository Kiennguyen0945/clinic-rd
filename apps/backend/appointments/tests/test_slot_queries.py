from django.test import TestCase

from appointments.selectors.slot_queries import slot_capacity

from .factories import (
    appointment_factory,
    doctor_context_factory,
    patient_factory,
    slot_factory,
    user_factory,
)


class SlotQueryTests(TestCase):
    def test_cancelled_appointments_do_not_consume_capacity(self):
        doctor, room, _ = doctor_context_factory(suffix="capacity")
        receptionist = user_factory(
            role_code="RECEPTIONIST",
            username="receptionist-capacity",
        )
        patient = patient_factory(code="BN-CAPACITY")
        slot = slot_factory(
            doctor=doctor,
            room=room,
            capacity=2,
        )
        appointment_factory(
            doctor=doctor,
            creator=receptionist,
            patient=patient,
            slot=slot,
            status="CONFIRMED",
        )
        appointment_factory(
            doctor=doctor,
            creator=receptionist,
            patient=patient,
            slot=slot,
            status="CANCELLED",
            sequence_number=2,
        )

        self.assertEqual(slot_capacity(slot), (1, 1))
