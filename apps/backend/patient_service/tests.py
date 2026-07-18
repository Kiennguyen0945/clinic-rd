from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth.hashers import make_password
from datetime import date
from auth_service.models import Role, User
from patient_service.models import Patient


class PatientAPITestCase(TestCase):
    """Test cho Patient API endpoints 1-4."""

    def setUp(self):
        # ── Roles ──
        self.role_receptionist = Role.objects.create(
            code='RECEPTIONIST', name='Receptionist',
        )
        self.role_doctor = Role.objects.create(
            code='DOCTOR', name='Doctor',
        )
        self.role_manager = Role.objects.create(
            code='MANAGER', name='Manager',
        )

        # ── Users ──
        self.receptionist = User.objects.create(
            username='receptionist',
            password_hash=make_password('Recep@123'),
            full_name='Lễ tân Test',
            phone='0900000001',
            role=self.role_receptionist,
            status='ACTIVE',
        )
        self.doctor = User.objects.create(
            username='doctor',
            password_hash=make_password('Doctor@123'),
            full_name='Bác sĩ Test',
            phone='0900000002',
            role=self.role_doctor,
            status='ACTIVE',
        )
        self.manager = User.objects.create(
            username='manager',
            password_hash=make_password('Manager@123'),
            full_name='Quản lý Test',
            phone='0900000003',
            role=self.role_manager,
            status='ACTIVE',
        )

        # ── Sample Patients ──
        self.patient1 = Patient.objects.create(
            patient_code='BN-20260711-001',
            full_name='Nguyễn Văn A',
            dob='1990-01-15',
            gender='M',
            phone='0901234567',
            address='123 Lê Lợi, Q1',
        )
        self.patient2 = Patient.objects.create(
            patient_code='BN-20260711-002',
            full_name='Trần Thị B',
            dob='1995-05-20',
            gender='F',
            phone='0987654321',
            address='456 Hai Bà Trưng, Q3',
        )

        self.client = APIClient()
        self.url = '/api/patients/'

    # ── Helper ──────────────────────────────────────────

    def _auth(self, user):
        """Force authenticate client as user."""
        self.client.force_authenticate(user=user)

    def _logout(self):
        """Remove authentication."""
        self.client.force_authenticate(user=None)

    # ══════════════════════════════════════════════════════
    # POST /api/patients/ — Tạo bệnh nhân
    # ══════════════════════════════════════════════════════

    def test_create_patient_success(self):
        """Receptionist tạo bệnh nhân mới → 201 + có patient_code."""
        self._auth(self.receptionist)
        data = {
            'full_name': 'Lê Văn C',
            'dob': '2000-08-10',
            'gender': 'M',
            'phone': '0911222333',
            'address': '789 Điện Biên Phủ',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertTrue(body['success'])
        patient = body['data']['patient']
        self.assertEqual(patient['full_name'], 'Lê Văn C')
        self.assertEqual(patient['phone'], '0911222333')
        self.assertIn('BN-', patient['patient_code'])

    def test_create_patient_auto_generates_code(self):
        """patient_code tự sinh format BN-YYYYMMDD-SEQ."""
        self._auth(self.receptionist)
        data = {
            'full_name': 'Test',
            'dob': '2000-01-01',
            'gender': 'M',
            'phone': '0900000111',
        }
        today = date.today()
        date_str = today.strftime('%Y%m%d')
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 201)
        code = resp.json()['data']['patient']['patient_code']
        self.assertTrue(code.startswith(f'BN-{date_str}-'))
        self.assertEqual(len(code), len(f'BN-{date_str}-') + 3)

    def test_create_patient_duplicate_phone(self):
        """Phone đã tồn tại → 400 DUPLICATE_PHONE."""
        self._auth(self.receptionist)
        data = {
            'full_name': 'Trùng phone',
            'dob': '2000-01-01',
            'gender': 'M',
            'phone': self.patient1.phone,
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()['error']['code'], 'DUPLICATE_PHONE')

    def test_create_patient_invalid_phone_format(self):
        """Phone không hợp lệ (chữ) → 400 VALIDATION_ERROR."""
        self._auth(self.receptionist)
        data = {
            'full_name': 'Test',
            'dob': '2000-01-01',
            'gender': 'M',
            'phone': 'abc123',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()['error']['code'], 'VALIDATION_ERROR')

    def test_create_patient_invalid_phone_length(self):
        """Phone 9 số → 400 VALIDATION_ERROR."""
        self._auth(self.receptionist)
        data = {
            'full_name': 'Test',
            'dob': '2000-01-01',
            'gender': 'M',
            'phone': '091234567',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()['error']['code'], 'VALIDATION_ERROR')

    def test_create_patient_missing_full_name(self):
        """Thiếu full_name → 400 VALIDATION_ERROR."""
        self._auth(self.receptionist)
        data = {
            'dob': '2000-01-01',
            'gender': 'M',
            'phone': '0911222333',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()['error']['code'], 'VALIDATION_ERROR')

    def test_create_patient_missing_dob(self):
        """Thiếu dob → 400 VALIDATION_ERROR."""
        self._auth(self.receptionist)
        data = {
            'full_name': 'Test',
            'gender': 'M',
            'phone': '0911222333',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_create_patient_missing_gender(self):
        """Thiếu gender → 400 VALIDATION_ERROR."""
        self._auth(self.receptionist)
        data = {
            'full_name': 'Test',
            'dob': '2000-01-01',
            'phone': '0911222333',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_create_patient_missing_phone(self):
        """Thiếu phone → 400 VALIDATION_ERROR."""
        self._auth(self.receptionist)
        data = {
            'full_name': 'Test',
            'dob': '2000-01-01',
            'gender': 'M',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_create_patient_address_optional(self):
        """address là optional → tạo thành công khi không gửi address."""
        self._auth(self.receptionist)
        data = {
            'full_name': 'No Address',
            'dob': '2000-01-01',
            'gender': 'F',
            'phone': '0999888777',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_create_patient_doctor_forbidden(self):
        """Doctor không được tạo → 403."""
        self._auth(self.doctor)
        data = {
            'full_name': 'Test',
            'dob': '2000-01-01',
            'gender': 'M',
            'phone': '0911222333',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()['error']['code'], 'FORBIDDEN')

    def test_create_patient_manager_forbidden(self):
        """Manager không được tạo → 403."""
        self._auth(self.manager)
        data = {
            'full_name': 'Test',
            'dob': '2000-01-01',
            'gender': 'M',
            'phone': '0911222333',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_create_patient_unauthenticated(self):
        """Chưa đăng nhập → 401."""
        self._logout()
        data = {
            'full_name': 'Test',
            'dob': '2000-01-01',
            'gender': 'M',
            'phone': '0911222333',
        }
        resp = self.client.post(self.url, data, format='json')
        self.assertEqual(resp.status_code, 401)

    # ══════════════════════════════════════════════════════
    # GET /api/patients/?keyword= — Tìm kiếm
    # ══════════════════════════════════════════════════════

    def test_search_by_full_name(self):
        """Tìm kiếm theo full_name."""
        self._auth(self.receptionist)
        resp = self.client.get(f'{self.url}?keyword=Nguyễn')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body['success'])
        patients = body['data']['patients']
        self.assertEqual(len(patients), 1)
        self.assertEqual(patients[0]['full_name'], 'Nguyễn Văn A')

    def test_search_by_phone(self):
        """Tìm kiếm theo phone."""
        self._auth(self.receptionist)
        resp = self.client.get(f'{self.url}?keyword=0987654321')
        self.assertEqual(resp.status_code, 200)
        patients = resp.json()['data']['patients']
        self.assertEqual(len(patients), 1)
        self.assertEqual(patients[0]['phone'], '0987654321')

    def test_search_by_patient_code(self):
        """Tìm kiếm theo patient_code."""
        self._auth(self.receptionist)
        resp = self.client.get(f'{self.url}?keyword=BN-20260711-001')
        self.assertEqual(resp.status_code, 200)
        patients = resp.json()['data']['patients']
        self.assertEqual(len(patients), 1)
        self.assertEqual(patients[0]['patient_code'], 'BN-20260711-001')

    def test_search_partial_match(self):
        """Tìm kiếm với keyword một phần."""
        self._auth(self.receptionist)
        resp = self.client.get(f'{self.url}?keyword=BN-20260711')
        self.assertEqual(resp.status_code, 200)
        patients = resp.json()['data']['patients']
        self.assertEqual(len(patients), 2)

    def test_search_case_insensitive(self):
        """Tìm kiếm không phân biệt hoa-thường."""
        self._auth(self.receptionist)
        resp = self.client.get(f'{self.url}?keyword=nguyễn')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()['data']['patients']), 1)

    def test_search_no_keyword(self):
        """Thiếu keyword → trả toàn bộ danh sách."""
        self._auth(self.receptionist)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body['success'])
        self.assertEqual(len(body['data']['patients']), 2)

    def test_search_empty_keyword(self):
        """Keyword rỗng → trả toàn bộ danh sách."""
        self._auth(self.receptionist)
        resp = self.client.get(f'{self.url}?keyword=')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body['success'])
        self.assertEqual(len(body['data']['patients']), 2)

    def test_search_no_results(self):
        """Không có kết quả → mảng rỗng."""
        self._auth(self.receptionist)
        resp = self.client.get(f'{self.url}?keyword=XXXXXX')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['data']['patients'], [])

    def test_search_doctor_allowed(self):
        """Doctor được tìm kiếm."""
        self._auth(self.doctor)
        resp = self.client.get(f'{self.url}?keyword=Nguyễn')
        self.assertEqual(resp.status_code, 200)

    def test_search_manager_allowed(self):
        """Manager được tìm kiếm."""
        self._auth(self.manager)
        resp = self.client.get(f'{self.url}?keyword=Nguyễn')
        self.assertEqual(resp.status_code, 200)

    def test_search_unauthenticated(self):
        """Chưa đăng nhập → 401."""
        self._logout()
        resp = self.client.get(f'{self.url}?keyword=Nguyễn')
        self.assertEqual(resp.status_code, 401)

    # ══════════════════════════════════════════════════════
    # GET /api/patients/{pk}/ — Chi tiết bệnh nhân
    # ══════════════════════════════════════════════════════

    def test_detail_success(self):
        """Xem chi tiết bệnh nhân → đầy đủ fields."""
        self._auth(self.receptionist)
        resp = self.client.get(f'{self.url}{self.patient1.pk}/')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body['success'])
        p = body['data']['patient']
        self.assertEqual(p['full_name'], 'Nguyễn Văn A')
        self.assertEqual(p['patient_code'], 'BN-20260711-001')
        self.assertEqual(p['dob'], '1990-01-15')
        self.assertEqual(p['gender'], 'M')
        self.assertEqual(p['phone'], '0901234567')
        self.assertIn('created_at', p)
        self.assertIn('updated_at', p)

    def test_detail_not_found(self):
        """PK không tồn tại → 404 PATIENT_NOT_FOUND."""
        self._auth(self.receptionist)
        resp = self.client.get(f'{self.url}999/')
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()['error']['code'], 'PATIENT_NOT_FOUND')

    def test_detail_doctor_allowed(self):
        """Doctor được xem chi tiết."""
        self._auth(self.doctor)
        resp = self.client.get(f'{self.url}{self.patient1.pk}/')
        self.assertEqual(resp.status_code, 200)

    def test_detail_manager_allowed(self):
        """Manager được xem chi tiết."""
        self._auth(self.manager)
        resp = self.client.get(f'{self.url}{self.patient1.pk}/')
        self.assertEqual(resp.status_code, 200)

    def test_detail_unauthenticated(self):
        """Chưa đăng nhập → 401."""
        self._logout()
        resp = self.client.get(f'{self.url}{self.patient1.pk}/')
        self.assertEqual(resp.status_code, 401)

    # ══════════════════════════════════════════════════════
    # PUT /api/patients/{pk}/ — Cập nhật
    # ══════════════════════════════════════════════════════

    def test_update_full_name(self):
        """Cập nhật full_name."""
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'full_name': 'Nguyễn Văn A (Updated)'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.patient1.refresh_from_db()
        self.assertEqual(self.patient1.full_name, 'Nguyễn Văn A (Updated)')

    def test_update_phone(self):
        """Cập nhật phone."""
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'phone': '0911222333'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.patient1.refresh_from_db()
        self.assertEqual(self.patient1.phone, '0911222333')

    def test_update_address(self):
        """Cập nhật address."""
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'address': 'New Address, Q1'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.patient1.refresh_from_db()
        self.assertEqual(self.patient1.address, 'New Address, Q1')

    def test_update_multiple_fields(self):
        """Cập nhật nhiều field cùng lúc."""
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {
                'full_name': 'New Name',
                'phone': '0999888777',
                'address': 'New Address',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.patient1.refresh_from_db()
        self.assertEqual(self.patient1.full_name, 'New Name')
        self.assertEqual(self.patient1.phone, '0999888777')
        self.assertEqual(self.patient1.address, 'New Address')

    def test_update_updated_at_changes(self):
        """updated_at được refresh sau update."""
        old_updated = self.patient1.updated_at
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'full_name': 'Renamed'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.patient1.refresh_from_db()
        self.assertGreater(self.patient1.updated_at, old_updated)

    def test_update_cannot_change_patient_code(self):
        """patient_code KHÔNG được sửa."""
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'patient_code': 'BN-HACKED-999'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.patient1.refresh_from_db()
        self.assertEqual(self.patient1.patient_code, 'BN-20260711-001')

    def test_update_cannot_change_dob(self):
        """dob KHÔNG được sửa."""
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'dob': '2000-01-01'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.patient1.refresh_from_db()
        self.assertEqual(self.patient1.dob.isoformat(), '1990-01-15')

    def test_update_cannot_change_gender(self):
        """gender KHÔNG được sửa."""
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'gender': 'F'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.patient1.refresh_from_db()
        self.assertEqual(self.patient1.gender, 'M')

    def test_update_not_found(self):
        """PK không tồn tại → 404 PATIENT_NOT_FOUND."""
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}999/',
            {'full_name': 'Test'},
            format='json',
        )
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.json()['error']['code'], 'PATIENT_NOT_FOUND')

    def test_update_invalid_phone(self):
        """Phone không hợp lệ → 400."""
        self._auth(self.receptionist)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'phone': 'invalid'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_update_doctor_forbidden(self):
        """Doctor không được update → 403."""
        self._auth(self.doctor)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'full_name': 'Hacked'},
            format='json',
        )
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.json()['error']['code'], 'FORBIDDEN')

    def test_update_manager_forbidden(self):
        """Manager không được update → 403."""
        self._auth(self.manager)
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'full_name': 'Hacked'},
            format='json',
        )
        self.assertEqual(resp.status_code, 403)

    def test_update_unauthenticated(self):
        """Chưa đăng nhập → 401."""
        self._logout()
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'full_name': 'Test'},
            format='json',
        )
        self.assertEqual(resp.status_code, 401)

    def test_update_partial_preserves_other_fields(self):
        """Chỉ gửi phone → các field khác giữ nguyên."""
        self._auth(self.receptionist)
        old_name = self.patient1.full_name
        old_addr = self.patient1.address
        resp = self.client.put(
            f'{self.url}{self.patient1.pk}/',
            {'phone': '0999888777'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.patient1.refresh_from_db()
        self.assertEqual(self.patient1.phone, '0999888777')
        self.assertEqual(self.patient1.full_name, old_name)
        self.assertEqual(self.patient1.address, old_addr)
