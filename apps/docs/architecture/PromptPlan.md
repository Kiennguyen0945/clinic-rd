# 🏥 CLINIC-RD: Kế Hoạch Lập Trình Chi Tiết

> **Ngày lập kế hoạch:** 2026-07-02
> **Tổng số prompt ước tính:** 12 prompt
> **Thời gian dự kiến:** 6-8 giờ làm việc

---

## 📊 SƠ ĐỒ TỔNG QUAN CÁC GIAI ĐOẠN

```
GIAI ĐOẠN 1: BACKEND FOUNDATION (Prompt #1 → #3)
├── #1: Sửa Auth + CORS + Permission + Chuẩn hóa response
├── #2: Patient API (search, create, update, detail)
└── #3: Appointment API (list, create, update, cancel)

GIAI ĐOẠN 2: BACKEND ADVANCED (Prompt #4 → #5)
├── #4: Medical Records API + Dashboard API
└── #5: Statistics API + Password change + Staff management

GIAI ĐOẠN 3: FRONTEND PAGES (Prompt #6 → #10)
├── #6: Patients page (search + create)
├── #7: Patients page (edit + detail)
├── #8: Appointments page (list + create)
├── #9: Appointments page (update + cancel)
└── #10: Dashboard fix + Medical records page

GIAI ĐOẠN 4: POLISH & INTEGRATION (Prompt #11 → #12)
├── #11: Staff management + Statistics pages
└── #12: Password change + Final integration test
```

---

## 🔧 CHUẨN BỊ TRƯỚC KHI BẮT ĐẦU

### Công cụ kiểm tra API (dùng cho mọi prompt)

```bash
# Dùng curl (có sẵn)
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Hoặc dùng httpie
pip install httpie
http POST http://localhost:8000/api/auth/login/ username=admin password=admin123
```

### Cách chạy Django server

```bash
cd /home/kien/clinic-rd/apps/backend
source ../../venv/bin/activate
python manage.py runserver
```

### Cách kiểm tra output mỗi prompt

| Loại kiểm tra | Cách thực hiện |
|---|---|
| **API response** | Dùng curl/httpie gọi endpoint, kiểm tra HTTP status + JSON body |
| **Database** | `python manage.py dbshell` hoặc dùng DB browser mở `db.sqlite3` |
| **Frontend UI** | `cd frontend && npm run dev`, mở browser tại `http://localhost:5173` |
| **Lỗi syntax** | `python manage.py check` (backend), `npm run build` (frontend) |

---

---

# GIAI ĐOẠN 1: BACKEND FOUNDATION

---

## 📝 PROMPT #1: SỬA AUTH, CORS, PERMISSION & CHUẨN HÓA RESPONSE

### 🎯 Mục tiêu
- Sửa lỗi chính tả trong `login_api`
- Chuẩn hóa format response JSON (success/error)
- Thêm CORS headers
- Tạo permission classes cho từng role
- Đăng ký models vào Django Admin
- Tạo file `urls.py` cho `patient_service` và `appointment_service`
- Cấu hình router chính `backend/urls.py`

### 📦 Context cần cung cấp
Đính kèm các file sau:
- `apps/backend/auth_service/views.py`
- `apps/backend/auth_service/urls.py`
- `apps/backend/auth_service/serializers.py`
- `apps/backend/auth_service/models.py`
- `apps/backend/auth_service/admin.py`
- `apps/backend/backend/settings.py`
- `apps/backend/backend/urls.py`
- File usecase `docs/usecases/AuthService.md`
- `apps/backend/requirements.txt`

### 🔨 Prompt chi tiết

```
Tôi đang xây dựng một hệ thống phòng khám (clinic) với Django REST Framework backend và React frontend.

HIỆN TẠI: Backend đã có auth_service với models (Role, User), views (login, role CRUD, user CRUD) và JWT authentication đã được cấu hình. Tuy nhiên còn nhiều vấn đề cần sửa.

YÊU CẦU CỤ THỂ:

1. **Sửa lỗi chính tả trong `auth_service/views.py`:**
   - Trong `login_api`: sửa "Account is looked." → "Account is locked."
   - Sửa "Invalid credentials" thành tiếng Việt: "Tên đăng nhập hoặc mật khẩu không đúng."

2. **Chuẩn hóa format response:**
   TẤT CẢ API response phải theo format:
   - Success: `{ "success": true, "data": {...}, "message": "Mô tả tiếng Việt" }`
   - Error: `{ "success": false, "error": { "code": "ERROR_CODE", "message": "Mô tả tiếng Việt", "details": {} } }`
   
   Tạo file `apps/backend/backend/response_utils.py` với 2 helper function:
   ```python
   # success_response(data, message="Thành công", status=200)
   # error_response(code, message, status=400, details=None)
   ```
   
   Sửa lại `login_api`, `role_api`, `user_api` để dùng format này.
   
   Login success trả về:
   ```json
   {
     "success": true,
     "data": {
       "token": "...",
       "user": { "id": "...", "username": "...", "fullName": "...", "role": "..." }
     },
     "message": "Đăng nhập thành công"
   }
   ```

3. **Thêm CORS headers:**
   - Thêm `django-cors-headers` vào `requirements.txt`
   - Cấu hình trong `settings.py`:
     - Thêm `'corsheaders'` vào `INSTALLED_APPS`
     - Thêm `'corsheaders.middleware.CorsMiddleware'` vào `MIDDLEWARE` (trên cùng)
     - Set `CORS_ALLOW_ALL_ORIGINS = True` (development)
     - Set `CORS_ALLOW_CREDENTIALS = True`

4. **Tạo Permission Classes:**
   Tạo file `apps/backend/backend/permissions.py`:
   - `IsReceptionist`: user.role.code == 'RECEPTIONIST'
   - `IsDoctor`: user.role.code == 'DOCTOR'
   - `IsManager`: user.role.code == 'MANAGER'
   - `IsReceptionistOrDoctor`: role in ('RECEPTIONIST', 'DOCTOR')

5. **Đăng ký models vào Django Admin:**
   - Trong `auth_service/admin.py`: đăng ký `Role` và `User`
   - Trong `patient_service/admin.py`: đăng ký `Patient`
   - Trong `appointment_service/admin.py`: đăng ký `Appointment` và `MedicalRecord`

6. **Tạo URL routes cho patient_service và appointment_service:**
   - Tạo `patient_service/urls.py` (để trống, sẽ thêm sau)
   - Tạo `appointment_service/urls.py` (để trống, sẽ thêm sau)
   - Sửa `backend/urls.py` để include cả 3 service:
   ```python
   urlpatterns = [
       path('admin/', admin.site.urls),
       path('api/', include('auth_service.urls')),
       path('api/', include('patient_service.urls')),
       path('api/', include('appointment_service.urls')),
   ]
   ```

7. **Sửa `auth_service/urls.py`** để chuẩn hóa prefix URL:
   - `/api/auth/login/` thay vì `/api/login/`
   - `/api/auth/roles/` thay vì `/api/roles/`
   - `/api/auth/users/` thay vì `/api/users/`

8. **Thêm `UserSerializer`** có trường `id` và `role` (string):
   - Thêm `id` vào fields
   - Thêm `role = serializers.CharField(source='role.code', read_only=True)`
   - Thêm method `create()` để hash password khi tạo user

SAU KHI HOÀN THÀNH, CHẠY `python manage.py check` ĐỂ XÁC NHẬN KHÔNG CÓ LỖI.
```

### ✅ Cách kiểm tra output

```bash
# 1. Kiểm tra Django check
cd /home/kien/clinic-rd/apps/backend
python manage.py check

# 2. Test login API với format mới
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Kỳ vọng: 200, {"success":true,"data":{"token":"...","user":{...}},...}

# 3. Test CORS từ frontend
cd /home/kien/clinic-rd/frontend && npm run dev
# Mở browser console, gọi fetch từ frontend đến backend, kiểm tra không bị CORS lỗi

# 4. Kiểm tra Admin
python manage.py createsuperuser  # nếu chưa có
python manage.py runserver
# Mở http://localhost:8000/admin/, đăng nhập, kiểm tra thấy Role, User, Patient, Appointment, MedicalRecord
```

### 📋 Tiêu chí Done
- [ ] `python manage.py check` không có lỗi
- [ ] Login API trả về đúng format mới
- [ ] Frontend có thể gọi API không bị CORS
- [ ] Django Admin hiển thị đủ 5 models
- [ ] Permission classes import được

---

## 📝 PROMPT #2: PATIENT API (Search, Create, Update, Detail)

### 🎯 Mục tiêu
Xây dựng API quản lý bệnh nhân theo `docs/api/patient-api.md`:
- `GET /api/patients/?keyword=` – Tìm kiếm bệnh nhân
- `POST /api/patients/` – Tạo hồ sơ bệnh nhân mới
- `PUT /api/patients/{id}/` – Cập nhật thông tin
- `GET /api/patients/{id}/` – Xem chi tiết bệnh nhân

### 📦 Context cần cung cấp
- `apps/docs/api/patient-api.md` (endpoint 1-4)
- `apps/docs/usecases/PatientService.md` (UC_PAT_01 → UC_PAT_03)
- `apps/backend/patient_service/models.py`
- `apps/backend/patient_service/views.py` (hiện đang trống)
- `apps/backend/backend/response_utils.py` (đã tạo ở Prompt #1)
- `apps/backend/backend/permissions.py` (đã tạo ở Prompt #1)
- `apps/backend/patient_service/urls.py` (đã tạo rỗng ở Prompt #1)

### 🔨 Prompt chi tiết

```
Tôi đang xây dựng Patient API cho hệ thống phòng khám.

ĐẶC TẢ API: Xem file patient-api.md đính kèm (chỉ quan tâm endpoint 1-4).
USECASE: Xem file PatientService.md đính kèm (UC_PAT_01, UC_PAT_02, UC_PAT_03).

YÊU CẦU CỤ THỂ:

1. **Tạo `patient_service/serializers.py`:**
   - `PatientSerializer`: fields ['id', 'patient_code', 'full_name', 'dob', 'gender', 'phone', 'address', 'created_at', 'updated_at']
   - read_only: id, patient_code, created_at, updated_at

2. **Tạo `patient_service/views.py` với các view sau:**

   a) **PatientSearchView (GET /api/patients/)**
      - Permission: IsAuthenticated (receptionist, doctor, manager)
      - Query param: keyword (required)
      - Tìm kiếm case-insensitive trong patient_code, full_name, phone dùng Q objects OR
      - Nếu không có keyword: trả về lỗi VALIDATION_ERROR
      - Nếu không có kết quả: trả về mảng rỗng
      - Sử dụng success_response() từ backend.response_utils

   b) **PatientCreateView (POST /api/patients/)**
      - Permission: IsReceptionist
      - Tự động sinh patient_code format BN-{YYYYMMDD}-{SEQ} (SEQ là số thứ tự 3 chữ số, đếm số BN trong ngày + 1)
      - Validate phone format (10-11 số)
      - Nếu phone đã tồn tại: trả về 400 với code DUPLICATE_PHONE
      - Trả về 201 với patient object

   c) **PatientDetailView (GET /api/patients/{pk}/)**
      - Permission: IsAuthenticated
      - Trả về chi tiết 1 bệnh nhân
      - 404: PATIENT_NOT_FOUND

   d) **PatientUpdateView (PUT /api/patients/{pk}/)**
      - Permission: IsReceptionist
      - Chỉ cập nhật: full_name, phone, address
      - KHÔNG cho sửa: patient_code, dob, gender
      - Tự động cập nhật updated_at
      - 404: PATIENT_NOT_FOUND

3. **Tạo `patient_service/urls.py`:**
   - Dùng URL patterns với phân biệt method (GET/POST cho cùng path)

4. **TẤT CẢ response phải dùng success_response() và error_response().**

SAU KHI HOÀN THÀNH: CHẠY `python manage.py check` VÀ TEST TỪNG ENDPOINT BẰNG curl.
```

### ✅ Cách kiểm tra output

```bash
# Lấy token trước
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"receptionist1","password":"123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 1. Test tạo bệnh nhân (POST)
curl -X POST http://localhost:8000/api/patients/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"full_name":"Nguyễn Văn A","dob":"1990-01-15","gender":"M","phone":"0901234567","address":"123 Lê Lợi, Q1"}'
# Kỳ vọng: 201, patient_code = BN-20260702-001

# 2. Test tìm kiếm (GET)
curl "http://localhost:8000/api/patients/?keyword=Nguyễn" \
  -H "Authorization: Bearer $TOKEN"
# Kỳ vọng: 200, mảng patients có ít nhất 1 phần tử

# 3. Test chi tiết (GET /api/patients/{id}/)
curl "http://localhost:8000/api/patients/<UUID>/" \
  -H "Authorization: Bearer $TOKEN"

# 4. Test cập nhật (PUT)
curl -X PUT "http://localhost:8000/api/patients/<UUID>/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phone":"0911222333"}'
# Kỳ vọng: 200, phone đã đổi

# 5. Test lỗi trùng phone
# Tạo bệnh nhân thứ 2 với cùng phone → kỳ vọng 400 DUPLICATE_PHONE
```

### 📋 Tiêu chí Done
- [ ] 4 endpoints hoạt động đúng HTTP status code
- [ ] Response format đúng như patient-api.md
- [ ] patient_code tự sinh đúng format
- [ ] Lỗi DUPLICATE_PHONE hoạt động
- [ ] Không cho phép sửa patient_code, dob, gender
- [ ] Permission: chỉ receptionist mới tạo/sửa được

---

## 📝 PROMPT #3: APPOINTMENT API (List, Create, Update, Cancel)

### 🎯 Mục tiêu
Xây dựng API quản lý lịch hẹn theo `docs/api/appointment-api.md`:
- `GET /api/appointments/` – Danh sách lịch hẹn (có filter)
- `POST /api/appointments/` – Tạo lịch hẹn mới
- `PUT /api/appointments/{id}/` – Cập nhật lịch hẹn
- `PATCH /api/appointments/{id}/cancel/` – Hủy lịch hẹn

### 📦 Context cần cung cấp
- `apps/docs/api/appointment-api.md` (endpoint 1-4)
- `apps/docs/usecases/AppointmentService.md` (UC_APPT_01, UC_APPT_02)
- `apps/backend/appointment_service/models.py`
- `apps/backend/appointment_service/views.py` (hiện đang trống)
- `apps/backend/backend/response_utils.py`
- `apps/backend/backend/permissions.py`
- `apps/backend/appointment_service/urls.py`

### 🔨 Prompt chi tiết

```
Tôi đang xây dựng Appointment API cho hệ thống phòng khám.

ĐẶC TẢ API: Xem file appointment-api.md đính kèm (endpoint 1-4).
USECASE: Xem file AppointmentService.md đính kèm (UC_APPT_01, UC_APPT_02).

YÊU CẦU CỤ THỂ:

1. **Tạo `appointment_service/serializers.py`:**

   a) AppointmentListSerializer:
      - Fields: id, patient (nested: id, patientCode, fullName, phone), doctor (nested: id, fullName), appointment_time, reason, status, created_at, updated_at
      - Dùng SerializerMethodField cho patient và doctor

   b) AppointmentCreateSerializer:
      - Fields write_only: patientId (UUID), doctorId (UUID)
      - Fields: appointment_time, reason

2. **Tạo `appointment_service/views.py` với các view sau:**

   a) **AppointmentListView (GET /api/appointments/)**
      - Permission: IsAuthenticated
      - Query params (tất cả optional):
        - date: lọc theo ngày (YYYY-MM-DD), mặc định = hôm nay
        - doctorId: lọc theo bác sĩ
        - status: PENDING|CONFIRMED|COMPLETED|CANCELLED
      - **Business rule:** Nếu user role = doctor → tự động filter doctorId = request.user.id, bỏ qua param doctorId
      - Sắp xếp theo appointment_time ASC
      - Dùng AppointmentListSerializer

   b) **AppointmentCreateView (POST /api/appointments/)**
      - Permission: IsReceptionist
      - Validate:
        - appointmentTime > now (nếu không: 400, PAST_TIME)
        - patientId tồn tại (404, PATIENT_NOT_FOUND)
        - doctorId tồn tại và có role = DOCTOR (404, DOCTOR_NOT_FOUND)
      - creator = request.user
      - status mặc định = PENDING
      - Mapping camelCase → snake_case fields

   c) **AppointmentUpdateView (PUT /api/appointments/{pk}/)**
      - Permission: IsReceptionist
      - Chỉ update nếu status != COMPLETED (400, ALREADY_COMPLETED)
      - Chỉ update: appointmentTime, doctorId, reason
      - 404: APPOINTMENT_NOT_FOUND

   d) **AppointmentCancelView (PATCH /api/appointments/{pk}/cancel/)**
      - Permission: IsReceptionist
      - Chỉ hủy nếu status != COMPLETED (400, ALREADY_COMPLETED)
      - Set status = "CANCELLED"
      - 404: APPOINTMENT_NOT_FOUND

3. **Tạo `appointment_service/urls.py`.**

4. **TẤT CẢ response dùng success_response() và error_response().**

SAU KHI HOÀN THÀNH: CHẠY `python manage.py check` VÀ TEST BẰNG curl.
```

### ✅ Cách kiểm tra output

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"receptionist1","password":"123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 1. Test tạo lịch hẹn
curl -X POST http://localhost:8000/api/appointments/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"patientId":"<UUID>","doctorId":"<UUID>","appointmentTime":"2026-07-03T09:00:00Z","reason":"Đau đầu"}'
# Kỳ vọng: 201, status=PENDING

# 2. Test danh sách (mặc định hôm nay)
curl "http://localhost:8000/api/appointments/" \
  -H "Authorization: Bearer $TOKEN"

# 3. Test filter theo ngày và trạng thái
curl "http://localhost:8000/api/appointments/?date=2026-07-03&status=PENDING" \
  -H "Authorization: Bearer $TOKEN"

# 4. Test cập nhật
curl -X PUT "http://localhost:8000/api/appointments/<UUID>/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason":"Đau đầu dữ dội"}'

# 5. Test hủy
curl -X PATCH "http://localhost:8000/api/appointments/<UUID>/cancel/" \
  -H "Authorization: Bearer $TOKEN"
# Kỳ vọng: 200, status=CANCELLED

# 6. Test lỗi thời gian quá khứ → kỳ vọng 400 PAST_TIME

# 7. Test lỗi sửa appointment đã COMPLETED → kỳ vọng 400 ALREADY_COMPLETED
```

### 📋 Tiêu chí Done
- [ ] 4 endpoints hoạt động đúng
- [ ] Doctor chỉ xem được appointment của mình
- [ ] Mặc định filter theo ngày hiện tại nếu không có param date
- [ ] Validate appointmentTime > now
- [ ] Không cho sửa/hủy appointment đã COMPLETED
- [ ] Response format đúng appointment-api.md
- [ ] Sắp xếp theo appointment_time ASC

---

---

# GIAI ĐOẠN 2: BACKEND ADVANCED

---

## 📝 PROMPT #4: MEDICAL RECORDS API + DASHBOARD API

### 🎯 Mục tiêu
- `GET /api/patients/{id}/medical-records/` – Xem lịch sử bệnh án (doctor)
- `POST /api/medical-records/` – Tạo bệnh án + tự động COMPLETED appointment (doctor)
- `GET /api/dashboard/today/` – Dashboard tổng quan hôm nay

### 📦 Context cần cung cấp
- `apps/docs/api/patient-api.md` (endpoint 5-6)
- `apps/docs/api/appointment-api.md` (endpoint 5)
- `apps/docs/usecases/PatientService.md` (UC_PAT_04, UC_PAT_05)
- `apps/docs/usecases/AppointmentService.md` (UC_APPT_03)
- `apps/backend/appointment_service/models.py` (đã có MedicalRecord)
- `apps/backend/patient_service/views.py`
- `apps/backend/appointment_service/views.py`
- `apps/backend/backend/permissions.py`

### 🔨 Prompt chi tiết

```
Tôi đang xây dựng Medical Records API và Dashboard API cho hệ thống phòng khám.

ĐẶC TẢ:
- Medical Records: patient-api.md endpoint 5-6, PatientService.md UC_PAT_04, UC_PAT_05
- Dashboard: appointment-api.md endpoint 5, AppointmentService.md UC_APPT_03

YÊU CẦU CỤ THỂ:

PHẦN 1: MEDICAL RECORDS

1. **Bổ sung `appointment_service/serializers.py`:**
   - MedicalRecordSerializer: fields ['id', 'appointment', 'symptoms', 'diagnosis', 'notes', 'created_at']
   - MedicalRecordListSerializer (cho list view): fields ['id', 'appointmentId', 'visitDate', 'doctorName', 'symptoms', 'diagnosis', 'notes']
     - appointmentId: source='appointment.id'
     - visitDate: source='appointment.appointment_time'
     - doctorName: source='appointment.doctor.full_name'

2. **Thêm `PatientMedicalHistoryView` (GET /api/patients/{patientId}/medical-records/) vào `patient_service/views.py`:**
   - Permission: IsDoctor
   - Query MedicalRecord qua appointment__patient_id=patientId
   - Join Appointment → User (doctor)
   - Sắp xếp theo appointment__appointment_time DESC
   - Nếu không có kết quả → mảng rỗng
   - Dùng MedicalRecordListSerializer

3. **Thêm `MedicalRecordCreateView` (POST /api/medical-records/) vào `appointment_service/views.py`:**
   - Permission: IsDoctor
   - Validate:
     - appointmentId tồn tại → 404 APPOINTMENT_NOT_FOUND
     - MedicalRecord chưa tồn tại → 409 RECORD_EXISTS
   - Sau khi tạo → tự động update Appointment.status = "COMPLETED"
   - Request body dùng camelCase: appointmentId, symptoms, diagnosis, notes

PHẦN 2: DASHBOARD

4. **Thêm `DashboardTodayView` (GET /api/dashboard/today/) vào `appointment_service/views.py`:**
   - Permission: IsAuthenticated
   - todayStats: COUNT group by status cho ngày hiện tại
     - total, pending, confirmed, inProgress, completed, cancelled
   - upcomingAppointments: 5 appointment sắp tới nhất trong ngày, appointment_time >= now, ASC
     - Mỗi item: id, patientName, patientCode, doctorName, appointmentTime, status
   - Nếu role = doctor → chỉ tính appointment của doctor đó
   - Output format theo appointment-api.md endpoint 5

PHẦN 3: URL ROUTING

5. **Cập nhật `patient_service/urls.py`:**
   - path('patients/<uuid:patientId>/medical-records/', ...)

6. **Cập nhật `appointment_service/urls.py`:**
   - path('medical-records/', ...)
   - path('dashboard/today/', ...)

TẤT CẢ RESPONSE DÙNG success_response() và error_response().
```

### ✅ Cách kiểm tra output

```bash
TOKEN_DOC=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"doctor1","password":"123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 1. Test Dashboard
curl "http://localhost:8000/api/dashboard/today/" \
  -H "Authorization: Bearer $TOKEN_DOC"
# Kỳ vọng: 200, có todayStats và upcomingAppointments

# 2. Test tạo medical record
curl -X POST http://localhost:8000/api/medical-records/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_DOC" \
  -d '{"appointmentId":"<UUID>","symptoms":"Sốt cao, ho","diagnosis":"Viêm họng cấp","notes":"Uống thuốc 3 ngày"}'
# Kỳ vọng: 201, appointment status → COMPLETED

# 3. Test lịch sử bệnh án
curl "http://localhost:8000/api/patients/<patientId>/medical-records/" \
  -H "Authorization: Bearer $TOKEN_DOC"

# 4. Test lỗi tạo trùng medical record → kỳ vọng 409 RECORD_EXISTS
```

### 📋 Tiêu chí Done
- [ ] Dashboard trả về đúng cấu trúc todayStats + upcomingAppointments
- [ ] Doctor dashboard chỉ hiển thị appointment của chính mình
- [ ] Medical record tạo thành công + appointment status → COMPLETED
- [ ] Không cho tạo trùng medical record (409)
- [ ] Medical history sắp xếp mới nhất trước
- [ ] Chỉ doctor mới tạo được medical record

---

## 📝 PROMPT #5: STATISTICS API + PASSWORD CHANGE + STAFF MANAGEMENT

### 🎯 Mục tiêu
- `GET /api/appointments/stats/` – Thống kê (manager only)
- `POST /api/auth/change-password/` – Đổi mật khẩu
- `POST /api/auth/staff/` – Tạo tài khoản nhân viên (manager)
- `PATCH /api/auth/staff/{id}/lock/` – Khóa/Mở khóa tài khoản (manager)

### 📦 Context cần cung cấp
- `apps/docs/api/appointment-api.md` (endpoint 6)
- `apps/docs/usecases/AppointmentService.md` (UC_APPT_05)
- `apps/docs/usecases/AuthService.md` (UC_AUTH_02, UC_AUTH_03, UC_AUTH_04)
- `apps/backend/auth_service/views.py`
- `apps/backend/auth_service/serializers.py`
- `apps/backend/appointment_service/views.py`
- `apps/backend/backend/permissions.py`

### 🔨 Prompt chi tiết

```
Tôi đang xây dựng Statistics, Password Change và Staff Management API.

ĐẶC TẢ:
- Statistics: appointment-api.md endpoint 6, AppointmentService.md UC_APPT_05
- Password: AuthService.md UC_AUTH_02
- Staff: AuthService.md UC_AUTH_03, UC_AUTH_04

YÊU CẦU CỤ THỂ:

PHẦN 1: STATISTICS API

1. **Thêm `AppointmentStatsView` (GET /api/appointments/stats/) vào `appointment_service/views.py`:**
   - Permission: IsManager
   - Query params required: startDate, endDate, groupBy
   - Validate endDate >= startDate → 400 INVALID_DATE_RANGE
   - groupBy có 3 mode:
     - status: COUNT group by status → [{label, count}]
     - doctor: COUNT group by doctor → [{doctorId, doctorName, count}]
     - day: COUNT group by date (YYYY-MM-DD) → [{date, count}]
   - Dùng Django ORM .values().annotate(count=Count('id'))

PHẦN 2: PASSWORD CHANGE

2. **Thêm `ChangePasswordView` (POST /api/auth/change-password/) vào `auth_service/views.py`:**
   - Permission: IsAuthenticated
   - Request body: { currentPassword, newPassword, confirmNewPassword }
   - Validate:
     - currentPassword khớp password_hash → 400 WRONG_PASSWORD
     - newPassword == confirmNewPassword → 400 PASSWORD_MISMATCH
     - newPassword >= 6 ký tự → 400 WEAK_PASSWORD
   - Hash và lưu newPassword, cập nhật updated_at

PHẦN 3: STAFF MANAGEMENT

3. **Thêm `StaffCreateView` (POST /api/auth/staff/) vào `auth_service/views.py`:**
   - Permission: IsManager
   - Request body: { username, fullName, phone, roleCode }
   - roleCode: RECEPTIONIST | DOCTOR
   - Nếu không có password → tự generate 8 ký tự
   - Username không trùng → 400 DUPLICATE_USERNAME
   - Status mặc định = ACTIVE
   - Trả về user + generatedPassword

4. **Thêm `StaffToggleLockView` (PATCH /api/auth/staff/{pk}/lock/) vào `auth_service/views.py`:**
   - Permission: IsManager
   - Request body: { action: "lock" | "unlock" }
   - Không tự lock chính mình → 400 SELF_LOCK
   - Set status = "LOCKED" hoặc "ACTIVE"

PHẦN 4: URL ROUTING

5. **Cập nhật `auth_service/urls.py`:**
   - path('auth/change-password/', ...)
   - path('auth/staff/', ...)
   - path('auth/staff/<uuid:pk>/lock/', ...)

6. **Cập nhật `appointment_service/urls.py`:**
   - path('appointments/stats/', ...)

TẤT CẢ RESPONSE DÙNG success_response() và error_response().
```

### ✅ Cách kiểm tra output

```bash
TOKEN_MGR=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"manager1","password":"123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 1. Test Statistics (3 mode)
curl "http://localhost:8000/api/appointments/stats/?startDate=2026-01-01&endDate=2026-12-31&groupBy=status" \
  -H "Authorization: Bearer $TOKEN_MGR"
curl "http://localhost:8000/api/appointments/stats/?startDate=2026-01-01&endDate=2026-12-31&groupBy=doctor" \
  -H "Authorization: Bearer $TOKEN_MGR"
curl "http://localhost:8000/api/appointments/stats/?startDate=2026-01-01&endDate=2026-12-31&groupBy=day" \
  -H "Authorization: Bearer $TOKEN_MGR"

# 2. Test đổi mật khẩu
curl -X POST http://localhost:8000/api/auth/change-password/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_MGR" \
  -d '{"currentPassword":"123","newPassword":"newpass123","confirmNewPassword":"newpass123"}'

# 3. Test tạo staff
curl -X POST http://localhost:8000/api/auth/staff/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_MGR" \
  -d '{"username":"doctor2","fullName":"Bác sĩ B","phone":"0901111222","roleCode":"DOCTOR"}'

# 4. Test lock/unlock
curl -X PATCH "http://localhost:8000/api/auth/staff/<UUID>/lock/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_MGR" \
  -d '{"action":"lock"}'

# 5. Test permission: receptionist gọi stats → kỳ vọng 403
```

### 📋 Tiêu chí Done
- [ ] Statistics hoạt động với cả 3 groupBy mode
- [ ] Statistics chỉ manager mới gọi được
- [ ] Đổi mật khẩu hoạt động, validate đủ các case lỗi
- [ ] Tạo staff tự sinh password, không trùng username
- [ ] Lock/Unlock không cho tự lock chính mình
- [ ] Sau khi lock, tài khoản không login được

---

---

# GIAI ĐOẠN 3: FRONTEND PAGES

---

## 📝 PROMPT #6: PATIENTS PAGE (Search + Create Form)

### 🎯 Mục tiêu
Xây dựng trang `Patients.tsx` với đầy đủ chức năng:
- Thanh tìm kiếm bệnh nhân (theo tên, mã BN, số điện thoại)
- Danh sách kết quả tìm kiếm dạng bảng
- Nút "Thêm bệnh nhân mới" mở Modal/Form
- Form tạo bệnh nhân với validation

### 📦 Context cần cung cấp
- `apps/frontend/src/pages/Patients.tsx` (hiện là stub)
- `apps/frontend/src/store.ts`
- `apps/docs/api/patient-api.md` (endpoint 1, 2)
- `apps/frontend/src/App.css`

### 🔨 Prompt chi tiết

```
Tôi đang xây dựng trang Patients cho frontend React + TypeScript.

BACKEND API đã sẵn sàng:
- GET /api/patients/?keyword=... → tìm kiếm bệnh nhân
- POST /api/patients/ → tạo bệnh nhân mới

ZUSTAND STORE hiện tại có:
- token: string | null
- user: { id, username, fullName, role } | null

YÊU CẦU:

1. **Tạo `Patients.tsx` với các component sau:**

   a) **Thanh tìm kiếm:**
      - Input text + nút "Tìm kiếm" (icon 🔍)
      - Gọi API khi nhấn Enter hoặc click nút tìm
      - Hiển thị loading spinner khi đang fetch

   b) **Bảng kết quả:**
      - Cột: Mã BN | Họ tên | Ngày sinh | Giới tính | SĐT | Địa chỉ
      - Nếu không có kết quả: hiển thị "Không tìm thấy bệnh nhân nào"
      - Mỗi dòng có thể click để xem chi tiết (sẽ làm ở prompt sau)

   c) **Nút "Thêm bệnh nhân" (nếu role=receptionist):**
      - Mở Modal chứa form tạo bệnh nhân

   d) **Modal/Form tạo bệnh nhân:**
      - Fields: Họ tên (required), Ngày sinh (required, date picker), Giới tính (select M/F/O, required), SĐT (required), Địa chỉ (optional)
      - Validation frontend:
        - Họ tên không được trống
        - SĐT: 10-11 chữ số
        - Ngày sinh không được trong tương lai
      - Khi submit → gọi POST /api/patients/
      - Nếu lỗi DUPLICATE_PHONE → hiển thị warning "SĐT này có thể đã tồn tại" + hỏi xác nhận "Vẫn tạo?"
      - Thành công → đóng modal, hiển thị toast/thông báo, tự động search lại

2. **Style:**
   - Dùng CSS trong App.css
   - Giao diện sạch sẽ, chuyên nghiệp (màu xanh dương medical theme)
   - Table có striped rows, hover effect
   - Modal căn giữa màn hình, overlay nền tối

3. **Xử lý lỗi:**
   - Hiển thị message lỗi từ API
   - Network error → "Không thể kết nối đến máy chủ"

4. **Chỉnh sửa file `Patients.tsx` hiện tại (đang là stub).**
```

### ✅ Cách kiểm tra output

```bash
cd /home/kien/clinic-rd/frontend && npm run dev
# Mở http://localhost:5173/patients
# Đăng nhập với receptionist để test đầy đủ
```

**Test cases manual:**
1. Nhập từ khóa "Nguyễn" → Enter → kiểm tra danh sách hiển thị
2. Nhấn "Thêm bệnh nhân" → điền form → Submit → kiểm tra BN mới xuất hiện
3. Để trống Họ tên → Submit → kiểm tra validation
4. Nhập SĐT đã tồn tại → kiểm tra warning DUPLICATE_PHONE
5. Nhập SĐT sai format → kiểm tra validation

### 📋 Tiêu chí Done
- [ ] Tìm kiếm hoạt động (Enter và click button)
- [ ] Bảng hiển thị đúng dữ liệu từ API
- [ ] Loading state khi đang fetch
- [ ] Empty state khi không có kết quả
- [ ] Form tạo bệnh nhân có validation đầy đủ
- [ ] Chỉ receptionist mới thấy nút "Thêm bệnh nhân"
- [ ] Giao diện responsive, đẹp mắt

---

## 📝 PROMPT #7: PATIENTS PAGE (Edit + Detail)

### 🎯 Mục tiêu
Bổ sung cho `Patients.tsx`:
- Modal xem chi tiết bệnh nhân (click vào dòng trong bảng)
- Modal chỉnh sửa thông tin bệnh nhân
- Cập nhật danh sách sau khi sửa

### 📦 Context cần cung cấp
- `apps/frontend/src/pages/Patients.tsx` (đã code ở Prompt #6)
- `apps/docs/api/patient-api.md` (endpoint 3, 4)

### 🔨 Prompt chi tiết

```
Từ trang Patients.tsx đã code, bổ sung thêm 2 chức năng:

BACKEND API:
- GET /api/patients/{id}/ → chi tiết bệnh nhân
- PUT /api/patients/{id}/ → cập nhật bệnh nhân

YÊU CẦU:

1. **Click vào dòng trong bảng → mở Modal chi tiết:**
   - Gọi GET /api/patients/{id}/
   - Hiển thị đầy đủ thông tin: Mã BN, Họ tên, Ngày sinh, Giới tính, SĐT, Địa chỉ, Ngày tạo, Ngày cập nhật
   - Nút "Đóng" và "Chỉnh sửa" (chỉ hiện nếu role=receptionist)
   - Nút "Xem bệnh án" (chỉ hiện nếu role=doctor, sẽ navigate sang medical-records ở prompt sau)

2. **Nút "Chỉnh sửa" → chuyển sang chế độ Edit trong Modal:**
   - Cho phép sửa: Họ tên, SĐT, Địa chỉ
   - KHÔNG cho sửa: Mã BN, Ngày sinh, Giới tính (hiển thị disabled)
   - Validation: SĐT 10-11 số, Họ tên không trống
   - Submit → PUT /api/patients/{id}/
   - Thành công → đóng modal, refresh danh sách

3. **Chỉ receptionist mới thấy nút "Chỉnh sửa".**
```

### ✅ Cách kiểm tra output

1. Click vào 1 bệnh nhân trong bảng → Modal hiển thị đầy đủ thông tin
2. Nhấn "Chỉnh sửa" → Form chuyển sang edit mode, các trường không được sửa bị disabled
3. Sửa Họ tên → Save → Đóng modal → Kiểm tra bảng đã cập nhật
4. Đăng nhập với doctor → Kiểm tra không thấy nút "Chỉnh sửa"
5. Đăng nhập với doctor → Kiểm tra thấy nút "Xem bệnh án"

### 📋 Tiêu chí Done
- [ ] Click vào dòng mở modal chi tiết
- [ ] Modal có chế độ view và edit
- [ ] Chỉ sửa được Họ tên, SĐT, Địa chỉ
- [ ] Permission đúng theo role
- [ ] Danh sách tự refresh sau khi sửa

---

## 📝 PROMPT #8: APPOINTMENTS PAGE (List + Create Form)

### 🎯 Mục tiêu
Xây dựng trang `Appointments.tsx` với:
- Bộ lọc: theo ngày, bác sĩ, trạng thái
- Danh sách lịch hẹn dạng bảng
- Nút "Tạo lịch hẹn" mở Modal/Form
- Form tạo lịch hẹn (chọn bệnh nhân, bác sĩ, thời gian, lý do)

### 📦 Context cần cung cấp
- `apps/frontend/src/pages/Appointments.tsx` (hiện là stub)
- `apps/docs/api/appointment-api.md` (endpoint 1, 2)
- `apps/frontend/src/store.ts`

### 🔨 Prompt chi tiết

```
Tôi đang xây dựng trang Appointments cho frontend React + TypeScript.

BACKEND API đã sẵn sàng:
- GET /api/appointments/?date=&doctorId=&status= → danh sách lịch hẹn
- POST /api/appointments/ → tạo lịch hẹn mới
- GET /api/patients/?keyword= → tìm kiếm bệnh nhân (để chọn trong form)
- GET /api/auth/users/ → danh sách users (lọc role=DOCTOR ở frontend)

ZUSTAND STORE: token, user (id, username, fullName, role)

YÊU CẦU:

1. **Thay thế stub `Appointments.tsx` với các component:**

   a) **Bộ lọc (Filter bar):**
      - Date picker (mặc định hôm nay)
      - Dropdown chọn bác sĩ (nếu role != doctor) - gọi API lấy danh sách bác sĩ
      - Dropdown chọn trạng thái: Tất cả | PENDING | CONFIRMED | COMPLETED | CANCELLED
      - Tự động fetch khi thay đổi filter
      - Nếu role = doctor: ẩn dropdown chọn bác sĩ (tự động filter theo token)

   b) **Bảng danh sách lịch hẹn:**
      - Cột: Giờ | Mã BN | Bệnh nhân | Bác sĩ | Lý do | Trạng thái | Thao tác
      - Trạng thái hiển thị dạng badge màu:
        - PENDING: vàng, CONFIRMED: xanh dương, COMPLETED: xanh lá, CANCELLED: đỏ
      - Cột "Thao tác": nút Sửa + Hủy (chỉ hiện nếu status != COMPLETED và role=receptionist)
      - Sắp xếp theo giờ tăng dần

   c) **Nút "Tạo lịch hẹn" (chỉ hiện nếu role=receptionist):**
      - Mở Modal form tạo lịch hẹn

   d) **Modal tạo lịch hẹn:**
      - Tìm và chọn bệnh nhân: input search + dropdown kết quả (gọi GET /api/patients/?keyword=)
      - Chọn bác sĩ: dropdown (gọi API lấy danh sách bác sĩ)
      - Chọn ngày giờ: datetime picker (chỉ cho chọn thời gian tương lai)
      - Lý do khám: textarea
      - Validation: phải chọn BN và BS, thời gian trong tương lai
      - Submit → POST /api/appointments/
      - Lỗi PAST_TIME → hiển thị message
      - Thành công → đóng modal, refresh danh sách

2. **Style:**
   - Giữ nguyên theme medical
   - Status badges có màu sắc rõ ràng
   - Bảng responsive

3. **Format datetime: dùng `date-fns` (đã có trong project)**
```

### ✅ Cách kiểm tra output

```bash
cd /home/kien/clinic-rd/frontend && npm run dev
# Mở http://localhost:5173/appointments
```

**Test cases:**
1. Mặc định hiển thị lịch hẹn hôm nay
2. Đổi ngày → danh sách cập nhật
3. Chọn trạng thái → filter hoạt động
4. Đăng nhập doctor → không thấy dropdown bác sĩ, chỉ thấy lịch của mình
5. Tạo lịch hẹn mới → chọn BN, BS, thời gian → Submit
6. Chọn thời gian quá khứ → báo lỗi

### 📋 Tiêu chí Done
- [ ] Filter hoạt động (date, doctor, status)
- [ ] Doctor tự động filter theo ID của mình
- [ ] Status badges có màu đúng
- [ ] Form tạo lịch hẹn có validation
- [ ] Tự refresh sau khi tạo thành công
- [ ] Chỉ receptionist thấy nút tạo/sửa/hủy

---

## 📝 PROMPT #9: APPOINTMENTS PAGE (Update + Cancel)

### 🎯 Mục tiêu
Bổ sung cho `Appointments.tsx`:
- Modal sửa lịch hẹn (đổi giờ, đổi bác sĩ, sửa lý do)
- Nút hủy lịch hẹn với confirm dialog
- Không cho sửa/hủy nếu status = COMPLETED

### 📦 Context cần cung cấp
- `apps/frontend/src/pages/Appointments.tsx` (đã code ở Prompt #8)
- `apps/docs/api/appointment-api.md` (endpoint 3, 4)

### 🔨 Prompt chi tiết

```
Từ trang Appointments.tsx đã code, bổ sung chức năng sửa và hủy lịch hẹn.

BACKEND API:
- PUT /api/appointments/{id}/ → cập nhật lịch hẹn
- PATCH /api/appointments/{id}/cancel/ → hủy lịch hẹn

YÊU CẦU:

1. **Nút "Sửa" trên mỗi dòng (chỉ hiện nếu status != COMPLETED và role=receptionist):**
   - Mở Modal sửa lịch hẹn
   - Cho phép sửa: Thời gian, Bác sĩ, Lý do
   - KHÔNG cho sửa: Bệnh nhân (hiển thị disabled)
   - Validation: thời gian phải trong tương lai
   - Submit → PUT /api/appointments/{id}/
   - Thành công → đóng modal, refresh danh sách

2. **Nút "Hủy" trên mỗi dòng (chỉ hiện nếu status != COMPLETED và role=receptionist):**
   - Click → hiển thị Confirm dialog: "Bạn có chắc chắn muốn hủy lịch hẹn này?"
   - OK → PATCH /api/appointments/{id}/cancel/
   - Thành công → refresh danh sách, status chuyển thành CANCELLED (màu đỏ)

3. **Nếu status = COMPLETED:**
   - Không hiện nút Sửa và Hủy
   - Có thể hiển thị icon ✅ hoặc text "Đã hoàn thành"

4. **Xử lý lỗi:**
   - ALREADY_COMPLETED → "Không thể sửa/hủy lịch hẹn đã hoàn thành"
   - APPOINTMENT_NOT_FOUND → "Không tìm thấy lịch hẹn"
```

### ✅ Cách kiểm tra output

1. Click "Sửa" trên 1 lịch hẹn → Modal hiện ra với dữ liệu cũ
2. Đổi bác sĩ + thời gian → Save → Kiểm tra danh sách cập nhật
3. Click "Hủy" → Confirm dialog → OK → Status chuyển thành CANCELLED
4. Tìm 1 lịch hẹn COMPLETED → Không thấy nút Sửa/Hủy
5. Đăng nhập doctor → Không thấy nút Sửa/Hủy

### 📋 Tiêu chí Done
- [ ] Sửa lịch hẹn hoạt động (đổi giờ, bác sĩ, lý do)
- [ ] Hủy lịch hẹn có confirm dialog
- [ ] Không sửa/hủy được COMPLETED appointment
- [ ] Permission đúng (chỉ receptionist)
- [ ] Danh sách tự refresh sau mỗi thao tác

---

## 📝 PROMPT #10: DASHBOARD FIX + MEDICAL RECORDS PAGE

### 🎯 Mục tiêu
- Sửa `Dashboard.tsx` để khớp với API backend mới
- Tạo trang `MedicalRecords.tsx` cho bác sĩ:
  - Xem lịch sử bệnh án của bệnh nhân
  - Form tạo bệnh án mới (từ appointment)

### 📦 Context cần cung cấp
- `apps/frontend/src/pages/Dashboard.tsx` (đã có code, cần sửa)
- `apps/frontend/src/pages/Patients.tsx` (đã có nút "Xem bệnh án")
- `apps/docs/api/patient-api.md` (endpoint 5, 6)
- `apps/docs/api/appointment-api.md` (endpoint 5)
- `apps/frontend/src/store.ts`
- `apps/frontend/src/App.tsx` (cần thêm route /medical-records)

### 🔨 Prompt chi tiết

```
Tôi cần sửa Dashboard và tạo mới MedicalRecords page.

BACKEND API đã sẵn sàng:
- GET /api/dashboard/today/ → dashboard
- GET /api/patients/{id}/medical-records/ → lịch sử bệnh án
- POST /api/medical-records/ → tạo bệnh án mới
- GET /api/appointments/?status=CONFIRMED (để lấy danh sách appointment đang chờ khám)

YÊU CẦU:

PHẦN 1: SỬA DASHBOARD (Dashboard.tsx)

1. **Sửa lại `Dashboard.tsx` để khớp với response format mới:**
   - API trả về: { success, data: { todayStats: {...}, upcomingAppointments: [...] } }
   - todayStats: total, pending, confirmed, inProgress, completed, cancelled
   - upcomingAppointments: id, patientName, patientCode, doctorName, appointmentTime, status
   - **LƯU Ý:** Frontend hiện tại đang dùng data.stats và data.appointments, cần sửa thành data.todayStats và data.upcomingAppointments
   - Status badge thêm màu cho CONFIRMED (xanh dương), IN_PROGRESS (cam)

PHẦN 2: TẠO MEDICAL RECORDS PAGE (MedicalRecords.tsx)

2. **Tạo file mới `pages/MedicalRecords.tsx`:**
   - Trang này có 2 tab/chế độ:
     - Tab "Bệnh án hôm nay": danh sách appointment CONFIRMED đang chờ khám
     - Tab "Tra cứu bệnh án": xem lịch sử bệnh án của bệnh nhân

   a) **Tab "Bệnh án hôm nay":**
      - Gọi GET /api/appointments/?status=CONFIRMED&date={today}
      - Hiển thị danh sách appointment dạng cards
      - Click vào card → mở form tạo bệnh án

   b) **Form tạo bệnh án (Modal hoặc section mở rộng):**
      - Hiển thị thông tin appointment
      - Fields: Triệu chứng (required), Chẩn đoán (required), Ghi chú (optional)
      - Submit → POST /api/medical-records/
      - Thành công → thông báo, xóa khỏi danh sách chờ

   c) **Tab "Tra cứu bệnh án":**
      - Nhận patientId từ URL query string
      - Gọi GET /api/patients/{patientId}/medical-records/
      - Hiển thị timeline lịch sử bệnh án
      - Nếu không có → "Bệnh nhân chưa có lịch sử khám bệnh"

3. **Cập nhật `App.tsx`:**
   - Thêm route: /medical-records, /medical-records?patientId=

4. **Cập nhật `Patients.tsx`:**
   - Nút "Xem bệnh án" → navigate đến /medical-records?patientId=

5. **Permission: Chỉ doctor mới truy cập được /medical-records**
```

### ✅ Cách kiểm tra output

```bash
cd /home/kien/clinic-rd/frontend && npm run dev
```

**Test cases:**
1. Mở Dashboard → kiểm tra todayStats và upcomingAppointments hiển thị đúng
2. Đăng nhập doctor → vào /medical-records → thấy tab "Bệnh án hôm nay"
3. Click vào 1 appointment → mở form → điền triệu chứng, chẩn đoán → Save
4. Kiểm tra appointment đã biến mất khỏi danh sách chờ
5. Từ Patients page → click "Xem bệnh án" → kiểm tra medical history hiển thị
6. Kiểm tra bệnh nhân chưa có lịch sử → hiển thị message phù hợp

### 📋 Tiêu chí Done
- [ ] Dashboard hiển thị đúng dữ liệu từ API mới
- [ ] Medical Records page hoạt động với 2 tab
- [ ] Tạo bệnh án thành công, appointment → COMPLETED
- [ ] Lịch sử bệnh án hiển thị đúng (mới nhất trước)
- [ ] Chỉ doctor truy cập được /medical-records
- [ ] Link "Xem bệnh án" từ Patients page hoạt động

---

---

# GIAI ĐOẠN 4: POLISH & INTEGRATION

---

## 📝 PROMPT #11: STAFF MANAGEMENT + STATISTICS PAGES

### 🎯 Mục tiêu
Tạo 2 trang mới cho manager:
- `Staff.tsx` – Quản lý nhân sự (danh sách, tạo mới, lock/unlock)
- `Statistics.tsx` – Thống kê (biểu đồ theo status, doctor, day)

### 📦 Context cần cung cấp
- `apps/frontend/src/store.ts`
- `apps/frontend/src/App.tsx`
- `apps/docs/api/appointment-api.md` (endpoint 6 - stats)
- `apps/docs/usecases/AuthService.md` (UC_AUTH_03, UC_AUTH_04)
- `apps/frontend/src/components/Sidebar.tsx` (đã có link /staff và /statistics)

### 🔨 Prompt chi tiết

```
Tôi cần tạo 2 trang mới cho Manager: Staff và Statistics.

BACKEND API đã sẵn sàng:
- POST /api/auth/staff/ → tạo tài khoản nhân viên
- PATCH /api/auth/staff/{id}/lock/ → lock/unlock
- GET /api/auth/users/ → danh sách users
- GET /api/appointments/stats/?startDate=&endDate=&groupBy= → thống kê

YÊU CẦU:

PHẦN 1: STAFF PAGE (pages/Staff.tsx)

1. **Tạo `Staff.tsx` với các component:**

   a) **Bảng danh sách nhân viên:**
      - Gọi GET /api/auth/users/
      - Cột: Username | Họ tên | SĐT | Role | Trạng thái | Thao tác
      - Trạng thái: Active (xanh lá) | Locked (đỏ)
      - Lọc theo role (tabs: Tất cả | Lễ tân | Bác sĩ)

   b) **Nút "Thêm nhân viên" → Modal form:**
      - Fields: Username, Họ tên, SĐT, Role (select RECEPTIONIST/DOCTOR)
      - Validation: username không trùng, các trường required
      - Submit → POST /api/auth/staff/
      - Thành công → hiển thị generated password trong toast

   c) **Nút Lock/Unlock trên mỗi dòng:**
      - Active → nút "Khóa" (đỏ), Locked → nút "Mở khóa" (xanh)
      - Không được tự lock chính mình
      - Confirm dialog trước khi lock/unlock

2. **Permission: Chỉ manager mới thấy trang /staff**

PHẦN 2: STATISTICS PAGE (pages/Statistics.tsx)

3. **Tạo `Statistics.tsx` với các component:**

   a) **Bộ lọc:**
      - Date range picker (startDate, endDate)
      - Group by selector: Theo trạng thái | Theo bác sĩ | Theo ngày

   b) **Biểu đồ / Bảng thống kê:**
      - Cài thêm: `npm install recharts`
      - groupBy=status: Pie chart hoặc Bar chart
      - groupBy=doctor: Bar chart (tên bác sĩ vs số lượng)
      - groupBy=day: Line chart (ngày vs số lượng)
      - Kèm bảng số liệu bên dưới

   c) **Empty state:** "Không có dữ liệu trong khoảng thời gian này"

4. **Cập nhật `App.tsx`:**
   - Thêm routes: /staff, /statistics
   - Wrap với role check (chỉ manager)

5. **Sidebar.tsx đã có link /staff và /statistics → không cần sửa.**
```

### ✅ Cách kiểm tra output

```bash
cd /home/kien/clinic-rd/frontend
npm install recharts
npm run dev
```

**Test cases:**
1. Đăng nhập manager → thấy menu Nhân sự, Thống kê
2. Vào /staff → thấy danh sách nhân viên
3. Tạo nhân viên mới → kiểm tra generated password hiển thị
4. Lock 1 tài khoản → trạng thái chuyển đỏ
5. Đăng nhập receptionist → không thấy menu Nhân sự, Thống kê
6. Vào /statistics → chọn khoảng thời gian → biểu đồ hiển thị
7. Đổi groupBy → biểu đồ thay đổi tương ứng

### 📋 Tiêu chí Done
- [ ] Staff page: danh sách, tạo mới, lock/unlock hoạt động
- [ ] Statistics page: 3 loại biểu đồ hoạt động
- [ ] Permission: chỉ manager truy cập được
- [ ] Sidebar menu đúng theo role
- [ ] Generated password hiển thị sau khi tạo staff

---

## 📝 PROMPT #12: PASSWORD CHANGE + FINAL INTEGRATION TEST

### 🎯 Mục tiêu
- Thêm chức năng đổi mật khẩu vào Header/Profile
- Tổng kiểm tra toàn bộ hệ thống
- Sửa các lỗi nhỏ còn tồn tại

### 📦 Context cần cung cấp
- Tất cả các file frontend hiện tại
- `apps/frontend/src/components/Header.tsx`
- `apps/frontend/src/store.ts`
- `apps/docs/usecases/AuthService.md` (UC_AUTH_02)

### 🔨 Prompt chi tiết

```
Đây là prompt cuối cùng để hoàn thiện hệ thống.

BACKEND API:
- POST /api/auth/change-password/ → đổi mật khẩu

YÊU CẦU:

PHẦN 1: PASSWORD CHANGE

1. **Thêm chức năng đổi mật khẩu vào Header component:**
   - Thêm icon/nút "Đổi mật khẩu" cạnh nút Đăng xuất
   - Click → mở Modal nhỏ
   - Fields: Mật khẩu hiện tại, Mật khẩu mới, Xác nhận mật khẩu mới
   - Validation:
     - Mật khẩu mới >= 6 ký tự
     - Mật khẩu mới == Xác nhận
   - Submit → POST /api/auth/change-password/
   - Lỗi WRONG_PASSWORD → "Mật khẩu hiện tại không đúng"
   - Thành công → thông báo, đóng modal

PHẦN 2: FINAL INTEGRATION TEST

2. **Kiểm tra và sửa các lỗi sau (nếu có):**

   a) **Frontend gọi API đúng URL prefix:**
      - Login: /api/auth/login/
      - Dashboard: /api/dashboard/today/
      - Patients: /api/patients/
      - Appointments: /api/appointments/
      - Medical Records: /api/medical-records/
      - Staff: /api/auth/staff/
      - Stats: /api/appointments/stats/
      - Change Password: /api/auth/change-password/

   b) **Authorization header:**
      - Tất cả API calls phải gửi Authorization: Bearer ${token}
      - Token hết hạn → tự động logout

   c) **Error handling toàn cục:**
      - 401 → chuyển về /login
      - 403 → hiển thị "Bạn không có quyền truy cập"
      - Network error → hiển thị message thân thiện

   d) **Loading states:**
      - Mỗi page có skeleton hoặc spinner khi loading
      - Nút submit bị disable khi đang xử lý

   e) **Empty states:**
      - Không có dữ liệu → hiển thị message phù hợp

3. **Kiểm tra toàn bộ flow người dùng:**

   | STT | Flow | Role |
   |-----|------|------|
   | 1 | Đăng nhập → Dashboard → Xem tổng quan hôm nay | ALL |
   | 2 | Vào Patients → Tìm kiếm BN → Tạo BN mới → Sửa thông tin | RECEPTIONIST |
   | 3 | Vào Appointments → Lọc → Tạo lịch hẹn → Sửa → Hủy | RECEPTIONIST |
   | 4 | Vào Medical Records → Chọn BN → Tạo bệnh án | DOCTOR |
   | 5 | Vào Staff → Xem danh sách → Tạo NV → Lock/Unlock | MANAGER |
   | 6 | Vào Statistics → Chọn khoảng → Xem biểu đồ | MANAGER |
   | 7 | Đổi mật khẩu → Đăng xuất → Đăng nhập lại với MK mới | ALL |

SAU KHI HOÀN THÀNH: CHẠY `npm run build` ĐỂ ĐẢM BẢO KHÔNG CÓ LỖI BUILD.
```

### ✅ Cách kiểm tra output

```bash
# Backend
cd /home/kien/clinic-rd/apps/backend
python manage.py check

# Frontend build
cd /home/kien/clinic-rd/frontend
npm run build

# Chạy full system
# Terminal 1: python manage.py runserver
# Terminal 2: npm run dev
```

**Test toàn bộ 7 flow người dùng như bảng trên.**

### 📋 Tiêu chí Done
- [ ] Đổi mật khẩu hoạt động
- [ ] `npm run build` không có lỗi
- [ ] `python manage.py check` không có lỗi
- [ ] 7 flow người dùng hoạt động trơn tru
- [ ] Error handling hoạt động (401, 403, network error)
- [ ] Loading states hiển thị đúng
- [ ] Empty states hiển thị message phù hợp

---

---

## 📋 TỔNG KẾT

### Bảng phân công Prompt theo Role

| Prompt | Nội dung | Backend | Frontend |
|--------|----------|---------|----------|
| #1 | Auth fix + CORS + Permission | ✅ | - |
| #2 | Patient API | ✅ | - |
| #3 | Appointment API | ✅ | - |
| #4 | Medical Records + Dashboard API | ✅ | - |
| #5 | Statistics + Password + Staff API | ✅ | - |
| #6 | Patients page (search + create) | - | ✅ |
| #7 | Patients page (edit + detail) | - | ✅ |
| #8 | Appointments page (list + create) | - | ✅ |
| #9 | Appointments page (update + cancel) | - | ✅ |
| #10 | Dashboard fix + Medical Records page | - | ✅ |
| #11 | Staff + Statistics pages | - | ✅ |
| #12 | Password change + Final test | - | ✅ |

### Thứ tự thực hiện

```
#1 → #2 → #3 → #4 → #5 (Backend hoàn chỉnh)
                ↓
#6 → #7 (Patients page hoàn chỉnh)
                ↓
#8 → #9 (Appointments page hoàn chỉnh)
                ↓
#10 → #11 → #12 (Hoàn thiện & Test)
```

### Thời gian ước tính mỗi prompt

| Prompt | Thời gian dự kiến |
|--------|-------------------|
| #1 | 30-45 phút |
| #2 | 30-45 phút |
| #3 | 30-45 phút |
| #4 | 30-45 phút |
| #5 | 30-45 phút |
| #6 | 45-60 phút |
| #7 | 20-30 phút |
| #8 | 45-60 phút |
| #9 | 20-30 phút |
| #10 | 45-60 phút |
| #11 | 45-60 phút |
| #12 | 30-45 phút |
| **Tổng** | **~6-8 giờ** |

---

## ⚠️ LƯU Ý QUAN TRỌNG

1. **Luôn chạy `python manage.py check` sau mỗi prompt backend** để phát hiện lỗi syntax sớm.
2. **Test từng endpoint bằng curl/httpie** trước khi chuyển sang frontend.
3. **Không chuyển sang prompt tiếp theo nếu prompt hiện tại chưa done** – mỗi prompt phụ thuộc vào code của prompt trước.
4. **Nếu gặp lỗi CORS** khi test frontend: kiểm tra lại `settings.py` đã có `CorsMiddleware` ở đầu `MIDDLEWARE` chưa.
5. **Nếu JWT token không hoạt động**: kiểm tra `SIMPLE_JWT` settings (có thể cần cấu hình `AUTH_HEADER_TYPES = ('Bearer',)`).
6. **Role codes phải khớp**: Backend dùng `RECEPTIONIST`, `DOCTOR`, `MANAGER` (viết hoa). Frontend store dùng `receptionist`, `doctor`, `manager` (viết thường). Cần mapping khi login.
7. **Tạo dữ liệu mẫu** trước khi test frontend: tạo ít nhất 2-3 bệnh nhân, 2-3 lịch hẹn, 1-2 bác sĩ, 1 receptionist, 1 manager trong DB.
