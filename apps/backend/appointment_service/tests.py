from datetime import datetime, time, timedelta

from django.test import TestCase
from django.utils import timezone

from appointment_service.models import Appointment, DoctorSlot
from appointment_service.scheduled_jobs import (
    cancel_confirmed_no_shows,
    cancel_expired_waiting,
    generate_doctor_slots,
)
from auth_service.models import Role, User
from organization_service.models import Room
from patient_service.models import Patient





class ScheduledJobsTests(TestCase):
    def setUp(self):
        role = Role.objects.create(code='DOCTOR', name='Doctor')
        self.doctor = User.objects.create(
            role=role, username='doctor', password_hash='x', full_name='Doctor', phone='0900000000'
        )
        self.room = Room.objects.create(room_number='Room 1')
        self.patient = Patient.objects.create(
            patient_code='BN-1', full_name='Patient', dob='1990-01-01', gender='M',
            phone='0900000001', address='Address'
        )
        self.today = timezone.localdate()

    def make_appointment(self, day_offset, status):
        slot = DoctorSlot.objects.create(
            doctor=self.doctor, room=self.room,
            slot_date=self.today + timedelta(days=day_offset),
            start_time=time(8), end_time=time(9),
        )
        return Appointment.objects.create(
            slot=slot, patient=self.patient, doctor=self.doctor, creator=self.doctor,
            appointment_time=timezone.make_aware(
                datetime.combine(slot.slot_date, slot.start_time), timezone.get_current_timezone()
            ), status=status,
        )

    def test_generates_60_days_and_is_idempotent(self):
        self.assertEqual(generate_doctor_slots(today=self.today), 60 * 11)
        self.assertEqual(generate_doctor_slots(today=self.today), 0)
        self.assertEqual(
            DoctorSlot.objects.filter(
                doctor=self.doctor, slot_date__range=(self.today, self.today + timedelta(days=59))
            ).count(),
            60 * 11,
        )

    def test_cancels_confirmed_past_and_today_but_not_tomorrow(self):
        past = self.make_appointment(-1, 'CONFIRMED')
        today = self.make_appointment(0, 'CONFIRMED')
        tomorrow = self.make_appointment(1, 'CONFIRMED')

        self.assertEqual(cancel_confirmed_no_shows(today=self.today), 2)
        past.refresh_from_db(); today.refresh_from_db(); tomorrow.refresh_from_db()
        self.assertEqual(past.cancellation_reason, 'NO_SHOW')
        self.assertEqual(today.cancellation_reason, 'NO_SHOW')
        self.assertEqual(tomorrow.status, 'CONFIRMED')

    def test_cancels_expired_waiting_but_not_tomorrow(self):
        past = self.make_appointment(-1, 'WAITING')
        today = self.make_appointment(0, 'WAITING')
        tomorrow = self.make_appointment(1, 'WAITING')

        self.assertEqual(cancel_expired_waiting(today=self.today), 2)
        past.refresh_from_db(); today.refresh_from_db(); tomorrow.refresh_from_db()
        self.assertEqual(past.cancellation_reason, 'EXPIRED')
        self.assertEqual(today.cancellation_reason, 'EXPIRED')
        self.assertEqual(tomorrow.status, 'WAITING')
