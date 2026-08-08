from django.test import TestCase

from appointments.services.reschedule_appointment import reschedule_appointment

from .factories import (
    appointment_factory,
    doctor_context_factory,
    patient_factory,
    slot_factory,
    user_factory,
)


class RescheduleAppointmentTests(TestCase):
    def test_moves_appointment_and_reallocates_sequence(self):
        doctor, room, department = doctor_context_factory(suffix="reschedule")
        receptionist = user_factory(
            role_code="RECEPTIONIST",
            username="receptionist-reschedule",
        )
        patient = patient_factory(code="BN-RESCHEDULE")
        old_slot = slot_factory(
            doctor=doctor,
            room=room,
            hour=10,
            day_offset=1,
        )
        new_slot = slot_factory(
            doctor=doctor,
            room=room,
            hour=11,
            day_offset=2,
        )
        appointment = appointment_factory(
            doctor=doctor,
            creator=receptionist,
            patient=patient,
            slot=old_slot,
        )

        reschedule_appointment(
            appointment=appointment,
            target_doctor=doctor,
            department=department,
            requested_slot_id=new_slot.id,
        )

        appointment.refresh_from_db()
        self.assertEqual(appointment.slot, new_slot)
        self.assertEqual(appointment.appointment_time.date(), new_slot.slot_date)
        self.assertEqual(appointment.sequence_number, 1)
