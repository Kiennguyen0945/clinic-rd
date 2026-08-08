# Patient API Contract — MVP 1.0

## 1. Phạm vi và quy ước

Contract này mô tả API hồ sơ bệnh nhân và lịch sử khám phục vụ luồng Appointment/Consultation MVP 1.0.

- Base path: `/api`.
- Tất cả endpoint yêu cầu `Authorization: Bearer <token>`.
- JSON public dùng `camelCase`; tên field Django/Python vẫn dùng `snake_case` ở nội bộ.
- ID là số nguyên dương vì model và URL hiện tại dùng khóa chính Django dạng integer.
- Date dùng `YYYY-MM-DD`; datetime dùng ISO 8601 có timezone.
- API không xóa vật lý bệnh nhân đã được tham chiếu bởi dữ liệu khám.
- Việc tạo/cập nhật/finalize bệnh án thuộc [Appointment API Contract](appointment-api-1.0.md); Patient API chỉ đọc lịch sử đã finalize.

Success envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Thông báo tiếng Việt"
}
```

Error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mô tả lỗi tiếng Việt",
    "details": {}
  }
}
```

## 2. Patient resource

```json
{
  "id": 15,
  "patientCode": "BN-20260718-001",
  "fullName": "Nguyễn Văn A",
  "dob": "1990-01-15",
  "gender": "M",
  "phone": "0901234567",
  "address": "123 Lê Lợi, Quận 1",
  "createdAt": "2026-07-18T08:00:00+07:00",
  "updatedAt": "2026-07-18T08:00:00+07:00"
}
```

`gender` nhận một trong `M`, `F`, `O`.

## 3. Search/list patients

```http
GET /api/patients/?keyword={keyword}
Roles: RECEPTIONIST | DOCTOR | MANAGER
```

Query params:

| Param | Bắt buộc | Ý nghĩa |
|---|---:|---|
| `keyword` | Không | Tìm không phân biệt hoa/thường trong `patient_code`, `full_name`, `phone`. Bỏ trống để lấy danh sách. |

Success `200 OK`:

```json
{
  "success": true,
  "data": {
    "patients": [
      {
        "id": 15,
        "patientCode": "BN-20260718-001",
        "fullName": "Nguyễn Văn A",
        "dob": "1990-01-15",
        "gender": "M",
        "phone": "0901234567",
        "address": "123 Lê Lợi, Quận 1",
        "createdAt": "2026-07-18T08:00:00+07:00",
        "updatedAt": "2026-07-18T08:00:00+07:00"
      }
    ]
  },
  "message": "Lấy danh sách bệnh nhân thành công"
}
```

Business rules:

- Không có kết quả trả `patients: []`, không trả lỗi.
- Kết quả mặc định sắp xếp theo `full_name`, sau đó `id`.
- Không trả bệnh nhân bị vô hiệu hóa nếu sau này model có `is_active`, trừ khi contract được mở rộng bằng filter riêng.

Errors: `401 UNAUTHORIZED`, `403 FORBIDDEN`.

## 4. Create patient

```http
POST /api/patients/
Role: RECEPTIONIST
```

Request:

```json
{
  "fullName": "Nguyễn Văn A",
  "dob": "1990-01-15",
  "gender": "M",
  "phone": "0901234567",
  "address": "123 Lê Lợi, Quận 1"
}
```

Required: `fullName`, `dob`, `gender`, `phone`. `address` là optional và mặc định `""`.

Success `201 Created`:

```json
{
  "success": true,
  "data": {
    "patient": {
      "id": 15,
      "patientCode": "BN-20260718-001",
      "fullName": "Nguyễn Văn A",
      "dob": "1990-01-15",
      "gender": "M",
      "phone": "0901234567",
      "address": "123 Lê Lợi, Quận 1",
      "createdAt": "2026-07-18T08:00:00+07:00",
      "updatedAt": "2026-07-18T08:00:00+07:00"
    }
  },
  "message": "Tạo hồ sơ bệnh nhân thành công"
}
```

Business rules:

- Backend tự sinh `patient_code` theo format `BN-{YYYYMMDD}-{SEQ}` và bảo đảm không trùng khi có request đồng thời.
- `phone` được chuẩn hóa và validate theo quy tắc số điện thoại của hệ thống.
- Số điện thoại đã tồn tại bị chặn để tránh tạo hồ sơ trùng. Người dùng phải tìm và dùng hồ sơ hiện có.

Errors:

- `400 VALIDATION_ERROR`, `details` theo từng field.
- `409 DUPLICATE_PHONE`, `details: { "existingPatientId": 15 }` nếu được phép tiết lộ theo role hiện tại.
- `401 UNAUTHORIZED`, `403 FORBIDDEN`.

## 5. Get patient detail

```http
GET /api/patients/{patientId}/
Roles: RECEPTIONIST | DOCTOR | MANAGER
```

Success `200 OK`: trả `data.patient` theo Patient resource ở mục 2.

Errors: `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 PATIENT_NOT_FOUND`.

## 6. Update patient

```http
PATCH /api/patients/{patientId}/
Role: RECEPTIONIST
```

Request chỉ chứa field cần sửa:

```json
{
  "fullName": "Nguyễn Văn B",
  "phone": "0912345678",
  "address": "456 Nguyễn Huệ, Quận 1"
}
```

Success `200 OK`: trả `data.patient` sau cập nhật.

Business rules:

- Chỉ cho phép sửa `fullName`, `phone`, `address`.
- Không cho sửa `id`, `patientCode`, `dob`, `gender`, `createdAt`.
- Payload có field không được phép bị từ chối; backend không âm thầm bỏ qua.
- `phone` mới vẫn phải qua validation và kiểm tra trùng.

Errors:

- `400 VALIDATION_ERROR`.
- `400 IMMUTABLE_FIELD`, `details.fields` liệt kê field không được sửa.
- `409 DUPLICATE_PHONE`.
- `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 PATIENT_NOT_FOUND`.

## 7. Get finalized medical history

```http
GET /api/patients/{patientId}/medical-records/
Role: DOCTOR
```

Success `200 OK`:

```json
{
  "success": true,
  "data": {
    "medicalRecords": [
      {
        "id": 30,
        "appointmentId": 81,
        "visitStartTime": "2026-07-18T09:00:00+07:00",
        "completedAt": "2026-07-18T09:35:00+07:00",
        "doctor": {
          "id": 7,
          "fullName": "BS. Trần Thị B"
        },
        "symptoms": "Sốt, đau họng",
        "diagnosis": "Viêm họng cấp",
        "icdCode": "J02.9",
        "treatmentPlan": "Điều trị ngoại trú",
        "notes": "Tái khám nếu sốt kéo dài",
        "vitalSigns": {
          "pulse": 82,
          "systolicBloodPressure": 120,
          "diastolicBloodPressure": 80,
          "temperature": "38.2",
          "spo2": 98,
          "weightKg": "60.50",
          "heightCm": "168.0"
        },
        "prescriptionItems": [
          {
            "id": 101,
            "medicationName": "Paracetamol",
            "dosage": "500 mg",
            "quantity": 10,
            "unit": "viên",
            "instructions": "Uống khi sốt, tối đa 3 lần/ngày",
            "sortOrder": 0
          }
        ],
        "medicalOrders": [
          {
            "id": 55,
            "orderType": "LAB_TEST",
            "name": "Công thức máu",
            "purpose": "Đánh giá nhiễm trùng",
            "instructions": ""
          }
        ],
        "finalizedAt": "2026-07-18T09:35:00+07:00"
      }
    ]
  },
  "message": "Lấy lịch sử bệnh án thành công"
}
```

Business rules:

- Chỉ trả MedicalRecord có `is_finalized = true` và appointment `COMPLETED`.
- Kiểm tra nhất quán `medical_record.patient_id = appointment.patient_id` và `medical_record.doctor_id = appointment.doctor_id` trong service/model, không suy đoán lại ở client.
- Sắp xếp theo `appointment.start_time` giảm dần, sau đó `id` giảm dần.
- Không có lịch sử trả `medicalRecords: []`.
- Draft của một bác sĩ không xuất hiện trong lịch sử bệnh án chung.

Errors: `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 PATIENT_NOT_FOUND`.

## 8. Error code summary

| HTTP | Code | Khi dùng |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Payload/query không hợp lệ. |
| 400 | `IMMUTABLE_FIELD` | Cố sửa field bất biến. |
| 401 | `UNAUTHORIZED` | Thiếu hoặc token không hợp lệ. |
| 403 | `FORBIDDEN` | Role không được phép. |
| 404 | `PATIENT_NOT_FOUND` | Không tồn tại bệnh nhân. |
| 409 | `DUPLICATE_PHONE` | Số điện thoại đã thuộc hồ sơ khác. |

## 9. Endpoint ownership

Các API cũ kiểu `POST /api/medical-records/` không còn là contract MVP 1.0 vì vừa tạo bệnh án vừa đổi thẳng appointment sang `COMPLETED`. Luồng đúng là:

```text
WAITING
→ POST /api/appointments/{id}/start-consultation/
→ GET/PUT /api/appointments/{id}/medical-record/
→ POST /api/appointments/{id}/complete/
```

Chi tiết payload và transaction nằm trong [appointment-api-1.0.md](appointment-api-1.0.md).
