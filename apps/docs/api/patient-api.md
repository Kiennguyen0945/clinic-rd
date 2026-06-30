# Patient API Contract

## 1. Search Patients

```
GET /api/patients/?keyword={keyword}
Auth: Bearer <token> (receptionist, doctor, manager)
```

Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "patients": [
      {
        "id": "string (uuid)",
        "patientCode": "string",
        "fullName": "string",
        "dob": "string (YYYY-MM-DD)",
        "gender": "string (M|F|O)",
        "phone": "string",
        "address": "string"
      }
    ]
  },
  "message": "Tìm kiếm bệnh nhân thành công"
}
```

Errors:
- `401` – `code: "UNAUTHORIZED"`
- `403` – `code: "FORBIDDEN"`

Business rules:
- Query `Patient` where `patient_code` OR `full_name` OR `phone` contains `keyword` (case‑insensitive).
- If no results, return empty array (not error).

---

## 2. Create Patient

```
POST /api/patients/
Auth: Bearer <token> (receptionist only)
```

Request body:
```json
{
  "fullName": "string (required)",
  "dob": "string (required, YYYY-MM-DD)",
  "gender": "string (required, M|F|O)",
  "phone": "string (required)",
  "address": "string (optional)"
}
```

Success `201 Created`:
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": "string",
      "patientCode": "string (auto-generated)",
      "fullName": "string",
      "dob": "string",
      "gender": "string",
      "phone": "string",
      "address": "string"
    }
  },
  "message": "Tạo hồ sơ bệnh nhân thành công"
}
```

Errors:
- `400` – `code: "VALIDATION_ERROR"`, `details: {fullName, dob, gender, phone}`
- `400` – `code: "DUPLICATE_PHONE"`, `message: "Số điện thoại này có thể đã tồn tại. Vui lòng kiểm tra lại."`
- `403` – `code: "FORBIDDEN"`

Business rules:
- Tự sinh `patient_code` (ví dụ: `BN-{YYYYMMDD}-{SEQ}`).
- Nếu `phone` đã tồn tại trong DB → trả 400 warning (vẫn cho phép phía frontend confirm tạo tiếp hay không; nếu cần block hẳn thì có thể đổi logic).
- Lưu record vào `Patient`.

---

## 3. Update Patient

```
PUT /api/patients/{patientId}/
Auth: Bearer <token> (receptionist only)
```

Request body (chỉ gửi các trường cần update):
```json
{
  "fullName": "string (optional)",
  "phone": "string (optional)",
  "address": "string (optional)"
}
```

Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": "string",
      "patientCode": "string",
      "fullName": "string",
      "dob": "string",
      "gender": "string",
      "phone": "string",
      "address": "string"
    }
  },
  "message": "Cập nhật thông tin thành công"
}
```

Errors:
- `400` – `code: "VALIDATION_ERROR"`
- `403` – `code: "FORBIDDEN"`
- `404` – `code: "PATIENT_NOT_FOUND"`

Business rules:
- Chỉ cập nhật các trường có trong request body.
- Cập nhật `updated_at`.
- Không cho sửa `patientCode`, `dob`, `gender` (nếu cần sửa thì tạo endpoint riêng).

---

## 4. Get Patient Detail

```
GET /api/patients/{patientId}/
Auth: Bearer <token> (receptionist, doctor, manager)
```

Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": "string",
      "patientCode": "string",
      "fullName": "string",
      "dob": "string",
      "gender": "string",
      "phone": "string",
      "address": "string",
      "createdAt": "string (ISO datetime)",
      "updatedAt": "string (ISO datetime)"
    }
  },
  "message": "Lấy thông tin bệnh nhân thành công"
}
```

Errors:
- `404` – `code: "PATIENT_NOT_FOUND"`

---

## 5. Get Patient Medical History

```
GET /api/patients/{patientId}/medical-records/
Auth: Bearer <token> (doctor only)
```

Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "medicalRecords": [
      {
        "id": "string",
        "appointmentId": "string",
        "visitDate": "string (YYYY-MM-DD HH:mm)",
        "doctorName": "string",
        "symptoms": "string",
        "diagnosis": "string",
        "notes": "string"
      }
    ]
  },
  "message": "Lấy lịch sử bệnh án thành công"
}
```

Errors:
- `404` – `code: "PATIENT_NOT_FOUND"`
- `403` – `code: "FORBIDDEN"`
- Nếu không có bản ghi → trả mảng rỗng.

Business rules:
- Join `MedicalRecord` → `Appointment` → `User (doctor)`.
- Sắp xếp theo `appointment_time` giảm dần (mới nhất trước).
- Trả về `symptoms`, `diagnosis`, `notes`.

---

## 6. Create Medical Record (Doctor)

```
POST /api/medical-records/
Auth: Bearer <token> (doctor only)
```

Request body:
```json
{
  "appointmentId": "string (required)",
  "symptoms": "string (required)",
  "diagnosis": "string (required)",
  "notes": "string (optional)"
}
```

Success `201 Created`:
```json
{
  "success": true,
  "data": {
    "medicalRecord": {
      "id": "string",
      "appointmentId": "string",
      "symptoms": "string",
      "diagnosis": "string",
      "notes": "string",
      "createdAt": "string"
    }
  },
  "message": "Lưu bệnh án thành công"
}
```

Errors:
- `400` – `code: "VALIDATION_ERROR"`, `details: {appointmentId, symptoms, diagnosis}`
- `409` – `code: "RECORD_EXISTS"`, `message: "Bệnh án cho lịch hẹn này đã tồn tại"`
- `403` – `code: "FORBIDDEN"`, `message: "Chỉ bác sĩ được ghi bệnh án"`
- `404` – `code: "APPOINTMENT_NOT_FOUND"`

Business rules:
- Kiểm tra `Appointment` tồn tại.
- Kiểm tra `MedicalRecord` chưa tồn tại cho `appointmentId` (OneToOne).
- Khi tạo thành công → cập nhật `Appointment.status` thành `"COMPLETED"`.
- Lưu record vào `MedicalRecord`.

---

## Common Error Format

Tất cả response lỗi theo định dạng:
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