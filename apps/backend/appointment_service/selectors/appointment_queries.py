from django.db.models import Case, Count, IntegerField, Max, Q, Value, When
from django.db.models.functions import TruncDate
from django.utils import timezone

from auth_service.models import User
from organization_service.models import Department, Room

from ..models import Appointment, DoctorSlot
from .slot_queries import (
    slot_capacity,
    slot_datetimes,
    slot_payload,
    virtual_slots_for_date,
)


def next_sequence(slot):
    """Return the next queue number for a room on a given day."""
    max_sequence = Appointment.objects.filter(
        slot__room_id=slot.room_id,
        slot__slot_date=slot.slot_date,
    ).aggregate(max_sequence=Max('sequence_number'))['max_sequence'] or 0
    return max_sequence + 1


def reception_context(target_date, *, now):
    doctors = list(
        User.objects.filter(role__code='DOCTOR', status='ACTIVE')
        .prefetch_related('department_assignments__department')
        .order_by('full_name')
    )
    persisted = list(
        DoctorSlot.objects
        .select_related('doctor', 'room').prefetch_related('appointments')
        .filter(slot_date=target_date, doctor__in=doctors)
        .order_by('doctor__full_name', 'start_time')
    )
    slots = []
    for doctor in doctors:
        slots.extend(virtual_slots_for_date(doctor, target_date, [s for s in persisted if s.doctor_id == doctor.id]))
    slots_by_doctor = {}
    for slot in slots:
        slots_by_doctor.setdefault(slot.doctor_id, []).append(slot)
    appointments = Appointment.objects.filter(slot__slot_date=target_date).select_related('doctor')
    summary = {key: appointments.filter(status=status).count() for key, status in (
        ('waiting', 'WAITING'), ('confirmed', 'CONFIRMED'), ('inProgress', 'IN_PROGRESS'),
        ('completed', 'COMPLETED'), ('cancelled', 'CANCELLED'),
    )}
    overview, waiting_doctors = [], []
    for doctor in doctors:
        doctor_slots = slots_by_doctor.get(doctor.id, [])
        capacity = sum(slot.capacity for slot in doctor_slots)
        booked = sum(slot_capacity(slot)[0] for slot in doctor_slots)
        remaining = max(capacity - booked, 0)
        ongoing = next((s for s in doctor_slots if slot_datetimes(s)[0] <= now < slot_datetimes(s)[1]), None)
        ongoing = ongoing or next((s for s in doctor_slots if slot_capacity(s)[1] > 0 and s.status == 'OPEN'), None)
        waiting = appointments.filter(doctor=doctor, status='WAITING').count()
        if waiting:
            waiting_doctors.append({'doctorId': str(doctor.id), 'doctorName': doctor.full_name, 'waitingCount': waiting})
        departments = [{'id': a.department_id, 'name': a.department.name} for a in doctor.department_assignments.all()]
        status = 'FULL' if remaining == 0 and capacity else 'NEAR_FULL' if capacity and remaining / capacity <= .2 else 'OPEN'
        overview.append({'doctor': {'id': str(doctor.id), 'fullName': doctor.full_name}, 'departments': departments,
                         'totalSlots': len(doctor_slots), 'capacity': capacity, 'bookedCount': booked,
                         'remainingCapacity': remaining, 'ongoingSlot': slot_payload(ongoing, now=now) if ongoing else None,
                         'status': status})
    return {
        'doctors': [{'id': str(d.id), 'fullName': d.full_name,
                     'departments': [{'id': a.department_id, 'name': a.department.name} for a in d.department_assignments.all()]}
                    for d in doctors],
        'departments': [{'id': d.id, 'name': d.name} for d in Department.objects.order_by('name')],
        'rooms': [{'id': str(r.id), 'roomNumber': r.room_number} for r in Room.objects.order_by('room_number')],
        'openSlotAssignments': [{'doctorId': str(d), 'roomId': str(r), 'roomNumber': n} for d, r, n in sorted({
            (s.doctor_id, s.room_id, s.room.room_number) for s in slots if s.status == 'OPEN'
        }, key=lambda item: (item[2], item[0]))],
        'overview': overview, 'receptionSummary': summary,
        'waitingDoctors': sorted(waiting_doctors, key=lambda item: item['waitingCount'], reverse=True),
    }


def appointment_queue(target_date, *, doctor_id=None, keyword=''):
    queryset = Appointment.objects.select_related('patient', 'doctor', 'slot', 'department').filter(
        slot__slot_date=target_date, status__in=('WAITING', 'CONFIRMED'))
    if doctor_id:
        queryset = queryset.filter(doctor_id=doctor_id)
    if keyword:
        query = Q(patient__full_name__icontains=keyword) | Q(patient__patient_code__icontains=keyword) | Q(
            patient__phone__icontains=keyword) | Q(appointment_code__icontains=keyword)
        try:
            query |= Q(sequence_number=int(keyword))
        except (TypeError, ValueError):
            pass
        queryset = queryset.filter(query)
    return queryset.annotate(status_priority=Case(When(status='WAITING', then=Value(0)), default=Value(1),
                                                    output_field=IntegerField())).order_by('status_priority', 'sequence_number')


def appointments_for_date(target_date, *, status=None, doctor_id=None):
    queryset = Appointment.objects.select_related('patient', 'doctor', 'slot', 'department').filter(
        appointment_time__date=target_date)
    if status:
        queryset = queryset.filter(status=status)
    if doctor_id:
        queryset = queryset.filter(doctor_id=doctor_id)
    return queryset.order_by('appointment_time')


def dashboard_today(*, doctor_id=None, now=None):
    now = now or timezone.now()
    queryset = Appointment.objects.select_related('patient', 'doctor').filter(appointment_time__date=timezone.localdate(now))
    if doctor_id:
        queryset = queryset.filter(doctor_id=doctor_id)
    counts = {
        'pending': queryset.filter(status='PENDING').count(),
        'confirmed': queryset.filter(status='CONFIRMED').count(),
        'inProgress': queryset.filter(status='IN_PROGRESS').count(),
        'completed': queryset.filter(status='COMPLETED').count(),
        'cancelled': queryset.filter(status='CANCELLED').count(),
    }
    upcoming = queryset.filter(status__in=('CONFIRMED', 'WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')).order_by(
        Case(
            When(status='IN_PROGRESS', then=Value(0)),
            When(status='WAITING', then=Value(1)),
            When(status='CONFIRMED', then=Value(2)),
            When(status='COMPLETED', then=Value(3)),
            default=Value(4),
            output_field=IntegerField(),
        ),
        'appointment_time',
    )
    return {'todayStats': {'total': queryset.count(), **counts}, 'upcomingAppointments': [
        {'id': str(a.id), 'patientName': a.patient.full_name, 'patientCode': a.patient.patient_code,
         'doctorName': a.doctor.full_name, 'patientPhone': a.patient.phone,
         'appointmentTime': timezone.localtime(a.appointment_time).isoformat(), 'status': a.status}
        for a in upcoming]}


def appointment_stats(start_date, end_date, group_by):
    queryset = Appointment.objects.select_related('doctor').filter(appointment_time__date__range=(start_date, end_date))
    if group_by == 'status':
        return [{'label': r['status'], 'count': r['count']} for r in queryset.values('status').annotate(count=Count('id')).order_by('status')]
    if group_by == 'doctor':
        return [{'doctorId': str(r['doctor_id']), 'doctorName': r['doctor__full_name'], 'count': r['count']}
                for r in queryset.values('doctor_id', 'doctor__full_name').annotate(count=Count('id')).order_by('doctor__full_name')]
    if group_by == 'day':
        return [{'date': r['date'].isoformat(), 'count': r['count']} for r in queryset.annotate(
            date=TruncDate('appointment_time')).values('date').annotate(count=Count('id')).order_by('date')]
    return None


