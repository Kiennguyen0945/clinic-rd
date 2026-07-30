from datetime import datetime, time, timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from appointment_service.models import Appointment, DoctorSlot
from appointment_service.scheduled_jobs import (
    cancel_confirmed_no_shows,
    cancel_expired_waiting,
    generate_doctor_slots,
)
from auth_service.models import Role, User
from organization_service.models import Department, DoctorDepartment, Room
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
        past.refresh_from_db()
        today.refresh_from_db()
        tomorrow.refresh_from_db()
        self.assertEqual(past.cancellation_reason, 'NO_SHOW')
        self.assertEqual(today.cancellation_reason, 'NO_SHOW')
        self.assertEqual(tomorrow.status, 'CONFIRMED')

    def test_cancels_expired_waiting_but_not_tomorrow(self):
        past = self.make_appointment(-1, 'WAITING')
        today = self.make_appointment(0, 'WAITING')
        tomorrow = self.make_appointment(1, 'WAITING')

        self.assertEqual(cancel_expired_waiting(today=self.today), 2)
        past.refresh_from_db()
        today.refresh_from_db()
        tomorrow.refresh_from_db()
        self.assertEqual(past.cancellation_reason, 'EXPIRED')
        self.assertEqual(today.cancellation_reason, 'EXPIRED')
        self.assertEqual(tomorrow.status, 'WAITING')


class ReceptionistBookingFlowTests(TestCase):
    def setUp(self):
        doctor_role = Role.objects.create(code='DOCTOR', name='Doctor')
        receptionist_role = Role.objects.create(code='RECEPTIONIST', name='Receptionist')
        self.doctor = User.objects.create(
            role=doctor_role, username='flow-doctor', password_hash='x',
            full_name='Doctor Flow', phone='0900000100',
        )
        self.receptionist = User.objects.create(
            role=receptionist_role, username='flow-receptionist', password_hash='x',
            full_name='Receptionist Flow', phone='0900000101',
        )
        self.room = Room.objects.create(room_number='Flow Room')
        self.department = Department.objects.create(code='FLOW', name='Flow Department')
        DoctorDepartment.objects.create(doctor=self.doctor, department=self.department)
        self.patient = Patient.objects.create(
            patient_code='BN-FLOW', full_name='Patient Flow', dob='1990-01-01',
            gender='M', phone='0900000102', address='Address',
        )
        self.now = timezone.make_aware(
            datetime.combine(timezone.localdate(), time(10, 15)),
            timezone.get_current_timezone(),
        )
        self.current_slot = DoctorSlot.objects.create(
            doctor=self.doctor, room=self.room, slot_date=timezone.localdate(),
            start_time=time(10), end_time=time(11), capacity=1,
        )
        self.future_slot = DoctorSlot.objects.create(
            doctor=self.doctor, room=self.room, slot_date=timezone.localdate(),
            start_time=time(11), end_time=time(12), capacity=2,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.receptionist)
        self.url = '/api/appointments/'

    def payload(self, booking_type, slot_id=None):
        data = {
            'patientId': self.patient.id,
            'doctorId': self.doctor.id,
            'departmentId': self.department.id,
            'bookingType': booking_type,
            'patientType': 'SERVICE',
            'reason': 'Test flow',
        }
        if slot_id is not None:
            data['slotId'] = slot_id
        return data

    def fill_slot(self, slot):
        for sequence in range(1, slot.capacity + 1):
            Appointment.objects.create(
                slot=slot, patient=self.patient, doctor=self.doctor,
                creator=self.receptionist, appointment_time=_slot_start(slot),
                sequence_number=sequence, status='CONFIRMED', booking_type='SCHEDULE',
            )

    @patch('appointment_service.views.timezone.now')
    def test_walk_in_without_slot_uses_current_slot_and_waits(self, mocked_now):
        mocked_now.return_value = self.now
        response = self.client.post(self.url, self.payload('WALK_IN'), format='json')
        self.assertEqual(response.status_code, 201)
        appointment = Appointment.objects.get()
        self.assertEqual(appointment.slot, self.current_slot)
        self.assertEqual(appointment.status, 'WAITING')
        self.assertEqual(appointment.check_in_at, self.now)
        self.assertEqual(appointment.sequence_number, 1)

    @patch('appointment_service.views.timezone.now')
    def test_schedule_without_slot_requires_confirmation(self, mocked_now):
        mocked_now.return_value = self.now
        response = self.client.post(self.url, self.payload('SCHEDULE'), format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error']['code'], 'SLOT_CONFIRMATION_REQUIRED')
        self.assertEqual(response.json()['error']['details']['suggestedSlot']['id'], self.current_slot.id)
        self.assertFalse(Appointment.objects.exists())

    @patch('appointment_service.views.timezone.now')
    def test_selected_future_schedule_is_confirmed_without_check_in(self, mocked_now):
        mocked_now.return_value = self.now
        response = self.client.post(self.url, self.payload('SCHEDULE', self.future_slot.id), format='json')
        self.assertEqual(response.status_code, 201)
        appointment = Appointment.objects.get()
        self.assertEqual(appointment.status, 'CONFIRMED')
        self.assertIsNone(appointment.check_in_at)

    @patch('appointment_service.views.timezone.now')
    def test_selected_future_walk_in_stays_waiting(self, mocked_now):
        mocked_now.return_value = self.now
        response = self.client.post(self.url, self.payload('WALK_IN', self.future_slot.id), format='json')
        self.assertEqual(response.status_code, 201)
        appointment = Appointment.objects.get()
        self.assertEqual(appointment.status, 'WAITING')
        self.assertEqual(appointment.check_in_at, self.now)

    @patch('appointment_service.views.timezone.now')
    def test_full_current_walk_in_suggests_nearest_future_slot(self, mocked_now):
        mocked_now.return_value = self.now
        Appointment.objects.create(
            slot=self.current_slot, patient=self.patient, doctor=self.doctor,
            creator=self.receptionist, appointment_time=self.now,
            sequence_number=1, status='WAITING', booking_type='WALK_IN',
        )
        response = self.client.post(self.url, self.payload('WALK_IN', self.current_slot.id), format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error']['code'], 'SLOT_CONFIRMATION_REQUIRED')
        self.assertEqual(response.json()['error']['details']['suggestedSlot']['id'], self.future_slot.id)

    @patch('appointment_service.views.timezone.now')
    def test_check_in_preserves_sequence_and_sets_timestamp(self, mocked_now):
        mocked_now.return_value = self.now
        appointment = Appointment.objects.create(
            slot=self.future_slot, patient=self.patient, doctor=self.doctor,
            creator=self.receptionist, appointment_time=_slot_start(self.future_slot),
            sequence_number=7, status='CONFIRMED', booking_type='SCHEDULE',
        )
        response = self.client.post(f'{self.url}{appointment.id}/check-in/', format='json')
        self.assertEqual(response.status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.sequence_number, 7)
        self.assertEqual(appointment.status, 'WAITING')
        self.assertEqual(appointment.check_in_at, self.now)

    @patch('appointment_service.views.timezone.now')
    def test_walk_in_suggestion_does_not_cross_into_tomorrow(self, mocked_now):
        mocked_now.return_value = self.now
        self.fill_slot(self.current_slot)
        self.fill_slot(self.future_slot)
        DoctorSlot.objects.create(
            doctor=self.doctor, room=self.room,
            slot_date=timezone.localdate() + timedelta(days=1),
            start_time=time(8), end_time=time(9),
        )
        response = self.client.post(self.url, self.payload('WALK_IN'), format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error']['code'], 'NO_AVAILABLE_SLOT')

    @patch('appointment_service.views.timezone.now')
    def test_schedule_suggestion_can_use_tomorrow(self, mocked_now):
        mocked_now.return_value = self.now
        self.fill_slot(self.current_slot)
        self.fill_slot(self.future_slot)
        tomorrow_slot = DoctorSlot.objects.create(
            doctor=self.doctor, room=self.room,
            slot_date=timezone.localdate() + timedelta(days=1),
            start_time=time(8), end_time=time(9),
        )
        response = self.client.post(self.url, self.payload('SCHEDULE'), format='json')
        self.assertEqual(response.status_code, 409)
        details = response.json()['error']['details']
        self.assertEqual(details['suggestedSlot']['id'], tomorrow_slot.id)


def _slot_start(slot):
    return timezone.make_aware(
        datetime.combine(slot.slot_date, slot.start_time),
        timezone.get_current_timezone(),
    )
