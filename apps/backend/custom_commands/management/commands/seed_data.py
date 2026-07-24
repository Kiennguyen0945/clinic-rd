from datetime import datetime, time, timedelta

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.utils import timezone

from appointment_service.models import Appointment, DoctorSlot, MedicalRecord
from auth_service.models import Role, User
from organization_service.models import Department, DoctorDepartment, Room
from patient_service.models import Patient


class Command(BaseCommand):
    help = 'Tạo dữ liệu mẫu tiếp nhận/lịch hẹn cho ngày hiện tại và ngày mai.'

    def handle(self, *args, **options):
        today = timezone.localdate()
        tomorrow = today + timedelta(days=1)
        self.stdout.write('=== Seed dữ liệu lịch hẹn lễ tân ===')

        roles = self._seed_roles()
        users = self._seed_users(roles)
        departments = self._seed_departments()
        rooms = self._seed_rooms()
        self._seed_doctor_departments(users, departments)
        patients = self._seed_patients()
        slots = self._seed_slots(users, rooms, today, tomorrow)
        self._seed_appointments(users, departments, patients, slots, today)

        self.stdout.write(self.style.SUCCESS('Đã seed xong dữ liệu test.'))
        self.stdout.write('Đăng nhập lễ tân: receptionist / Recep@123')
        self.stdout.write(f'Ngày dữ liệu chính: {today.isoformat()} (có thêm slot cho {tomorrow.isoformat()}).')

    def _seed_roles(self):
        data = [
            ('MANAGER', 'Quản lý', 'Quản lý phòng khám'),
            ('DOCTOR', 'Bác sĩ', 'Bác sĩ khám chữa bệnh'),
            ('RECEPTIONIST', 'Lễ tân', 'Tiếp nhận và điều phối lịch hẹn'),
        ]
        roles = {}
        for code, name, description in data:
            role, _ = Role.objects.update_or_create(code=code, defaults={'name': name, 'description': description})
            roles[code] = role
        return roles

    def _seed_users(self, roles):
        data = [
            ('manager', 'Manager@123', 'Quản lý Nguyễn Văn A', '0900000001', 'MANAGER'),
            ('doctor1', 'Doctor@123', 'BS. Nguyễn Minh Đức', '0900000002', 'DOCTOR'),
            ('doctor2', 'Doctor@123', 'BS. Trần Thị Mai', '0900000003', 'DOCTOR'),
            ('doctor3', 'Doctor@123', 'BS. Lê Hoàng Nam', '0900000004', 'DOCTOR'),
            ('receptionist', 'Recep@123', 'Lễ tân Phạm Thị D', '0900000005', 'RECEPTIONIST'),
        ]
        users = {}
        for username, password, full_name, phone, role_code in data:
            user, _ = User.objects.update_or_create(
                username=username,
                defaults={
                    'password_hash': make_password(password),
                    'full_name': full_name,
                    'phone': phone,
                    'role': roles[role_code],
                    'status': 'ACTIVE',
                },
            )
            users[username] = user
        return users

    def _seed_departments(self):
        data = [('NOI', 'Nội khoa'), ('NHI', 'Nhi khoa'), ('TMH', 'Tai Mũi Họng')]
        departments = {}
        for code, name in data:
            department, _ = Department.objects.update_or_create(code=code, defaults={'name': name})
            departments[code] = department
        return departments

    def _seed_rooms(self):
        rooms = {}
        for room_number in ('Phòng 1', 'Phòng 2', 'Phòng 3'):
            room, _ = Room.objects.get_or_create(room_number=room_number)
            rooms[room_number] = room
        return rooms

    def _seed_doctor_departments(self, users, departments):
        assignments = [('doctor1', 'NOI'), ('doctor2', 'NHI'), ('doctor3', 'TMH')]
        for username, department_code in assignments:
            DoctorDepartment.objects.get_or_create(doctor=users[username], department=departments[department_code])

    def _seed_patients(self):
        data = [
            ('SEED-BN-001', 'Nguyễn Văn A', '1992-01-01', 'M', '0901234567'),
            ('SEED-BN-002', 'Phạm Thị D', '1990-05-12', 'F', '0901456789'),
            ('SEED-BN-003', 'Lê Văn C', '1998-08-20', 'M', '0902111222'),
            ('SEED-BN-004', 'Đỗ Thị H', '1984-11-15', 'F', '0903333444'),
            ('SEED-BN-005', 'Võ Minh K', '1975-03-04', 'M', '0904555666'),
            ('SEED-BN-006', 'Trần Gia Bảo', '1997-10-09', 'M', '0906123456'),
            ('SEED-BN-007', 'Nguyễn Thu Hà', '1989-12-10', 'F', '0907123456'),
            ('SEED-BN-008', 'Bùi Quốc Anh', '1980-07-22', 'M', '0908123456'),
            ('SEED-BN-009', 'Lý Ngọc Mai', '1995-03-18', 'F', '0909123456'),
            ('SEED-BN-010', 'Hoàng Minh T', '1979-09-17', 'M', '0910123456'),
            ('SEED-BN-011', 'Ngô Thanh N', '1988-01-25', 'F', '0911123456'),
            ('SEED-BN-012', 'Phan Khánh L', '1993-06-30', 'F', '0912123456'),
        ]
        patients = {}
        for code, full_name, dob, gender, phone in data:
            patient, _ = Patient.objects.update_or_create(
                patient_code=code,
                defaults={
                    'full_name': full_name,
                    'dob': datetime.strptime(dob, '%Y-%m-%d').date(),
                    'gender': gender,
                    'phone': phone,
                    'address': 'Quận 1, TP.HCM',
                },
            )
            patients[code] = patient
        return patients

    def _seed_slots(self, users, rooms, today, tomorrow):
        slot_hours = (7, 8, 9, 10, 11, 13, 14, 15, 16)
        doctors = [('doctor1', 'Phòng 1'), ('doctor2', 'Phòng 2'), ('doctor3', 'Phòng 3')]
        slots = {}
        for slot_date in (today, tomorrow):
            for username, room_number in doctors:
                for hour in slot_hours:
                    slot, _ = DoctorSlot.objects.update_or_create(
                        doctor=users[username],
                        slot_date=slot_date,
                        start_time=time(hour, 0),
                        end_time=time(hour + 1, 0),
                        defaults={
                            'room': rooms[room_number],
                            'capacity': 4,
                            'status': 'CLOSED' if username == 'doctor1' and hour == 15 else 'OPEN',
                        },
                    )
                    slots[(slot_date, username, hour)] = slot
        return slots

    def _seed_appointments(self, users, departments, patients, slots, today):
        Appointment.objects.filter(appointment_code__startswith='SEED-').delete()
        reception = users['receptionist']
        data = [
            ('SEED-001', 'doctor1', 8, 'SEED-BN-001', 'CONFIRMED', 'Khám định kỳ', 'SERVICE'),
            ('SEED-002', 'doctor1', 9, 'SEED-BN-003', 'WAITING', 'Đau đầu, chóng mặt', 'SERVICE'),
            ('SEED-003', 'doctor1', 9, 'SEED-BN-005', 'WAITING', 'Theo dõi huyết áp', 'BHYT'),
            ('SEED-004', 'doctor1', 10, 'SEED-BN-002', 'CONFIRMED', 'Đau bụng, đầy hơi', 'SERVICE'),
            ('SEED-005', 'doctor1', 11, 'SEED-BN-006', 'CONFIRMED', 'Tái khám', 'SERVICE'),
            ('SEED-006', 'doctor1', 11, 'SEED-BN-007', 'CONFIRMED', 'Khám nội tổng quát', 'SERVICE'),
            ('SEED-007', 'doctor1', 11, 'SEED-BN-008', 'WAITING', 'Đau khớp gối', 'BHYT'),
            ('SEED-008', 'doctor1', 11, 'SEED-BN-009', 'CONFIRMED', 'Kiểm tra sức khỏe', 'SERVICE'),
            ('SEED-009', 'doctor2', 9, 'SEED-BN-010', 'WAITING', 'Sốt nhẹ', 'SERVICE'),
            ('SEED-010', 'doctor2', 10, 'SEED-BN-011', 'CONFIRMED', 'Khám nhi', 'BHYT'),
            ('SEED-011', 'doctor3', 8, 'SEED-BN-012', 'COMPLETED', 'Đau tai', 'SERVICE'),
            ('SEED-012', 'doctor3', 10, 'SEED-BN-004', 'CANCELLED', 'Khám tai mũi họng', 'SERVICE'),
        ]
        for sequence, (code, username, hour, patient_code, status, reason, patient_type) in enumerate(data, start=1):
            slot = slots[(today, username, hour)]
            appointment = Appointment.objects.create(
                slot=slot,
                patient=patients[patient_code],
                doctor=users[username],
                creator=reception,
                appointment_code=code,
                department=departments['NOI' if username == 'doctor1' else 'NHI' if username == 'doctor2' else 'TMH'],
                sequence_number=sequence,
                booking_type='WALK_IN' if status == 'WAITING' else 'SCHEDULE',
                patient_type=patient_type,
                bhyt_number='DN-TEST-2026-001' if patient_type == 'BHYT' else None,
                appointment_time=timezone.make_aware(datetime.combine(today, slot.start_time), timezone.get_current_timezone()),
                reason=reason,
                status=status,
                cancellation_reason='Bệnh nhân đổi lịch' if status == 'CANCELLED' else '',
            )
            if status == 'COMPLETED':
                MedicalRecord.objects.create(appointment=appointment, symptoms='Đau nhẹ', diagnosis='Viêm tai ngoài', notes='Tái khám sau 7 ngày')
