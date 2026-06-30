# Appointment API Contract

## 1. List / Filter Appointments

```
GET /api/appointments/?date={YYYY-MM-DD}&doctorId={userId}&status={status}
Auth: Bearer <token> (receptionist | doctor | manager)
```
Query params (all optional):
- `date` – lọc theo ngày `appointment_time`.
- `doctorId` – lọc theo bác sĩ. Doctor tự động chỉ xem của mình (query string có thể bỏ qua, backend ép theo token).
- `status` – PENDING | CONFIRMED | COMPLETED | CANCELLED.

Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "string (uuid)",
        "patient": {
          "id": "string",
          "patientCode": "string",
          "fullName": "string",
          "phone": "string"
        },
        "doctor": {
          "id": "string",
          "fullName": "string"
        },
        "appointmentTime": "string (ISO datetime)",
        "reason": "string",
        "status": "string (PENDING|CONFIRMED|COMPLETED|CANCELLED)",
        "createdAt": "string (ISO datetime)",
        "updatedAt": "string (ISO datetime)"
      }
    ]
  },
  "message": "Lấy danh sách lịch hẹn thành công"
}
```
Errors:
- `401` – `code: "UNAUTHORIZED"`
- `403` – `code: "FORBIDDEN"`

Business rules:
- Nếu role = `doctor` → tự động filter `doctorId = token.sub`.
- Nếu không có param `date` → mặc định là ngày hiện tại.
- Sắp xếp theo `appointment_time` ASC.

---

## 2. Create Appointment

```
POST /api/appointments/
Auth: Bearer <token> (role=receptionist)
```
Request body:
```json
{
  "patientId": "string (required)",
  "doctorId": "string (required)",
  "appointmentTime": "string (required, ISO datetime, must be future)",
  "reason": "string (optional)"
}
```
Success `201 Created`:
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "string",
      "patient": {
        "id": "string",
        "fullName": "string"
      },
      "doctor": {
        "id": "string",
        "fullName": "string"
      },
      "appointmentTime": "string",
      "reason": "string",
      "status": "PENDING",
      "createdAt": "string"
    }
  },
  "message": "Tạo lịch hẹn thành công"
}
```
Errors:
- `400` – `code: "VALIDATION_ERROR"`, `details: {patientId, doctorId, appointmentTime}`
- `400` – `code: "PAST_TIME"`, `message: "Thời gian hẹn phải trong tương lai"`
- `403` – `code: "FORBIDDEN"`
- `404` – `code: "PATIENT_NOT_FOUND"` | `code: "DOCTOR_NOT_FOUND"`

Business rules:
- `creatorId` = `token.sub`.
- `status` mặc định = `PENDING`.
- Validate `appointmentTime` > now.
- Lưu record vào `Appointment`.

---

## 3. Update Appointment

```
PUT /api/appointments/{appointmentId}/
Auth: Bearer <token> (role=receptionist)
```
Request body (chỉ gửi field cần update):
```json
{
  "appointmentTime": "string (optional, ISO datetime)",
  "doctorId": "string (optional)",
  "reason": "string (optional)"
}
```
Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "string",
      "patient": { "id": "string", "fullName": "string" },
      "doctor": { "id": "string", "fullName": "string" },
      "appointmentTime": "string",
      "reason": "string",
      "status": "string",
      "updatedAt": "string"
    }
  },
  "message": "Cập nhật lịch hẹn thành công"
}
```
Errors:
- `400` – `code: "VALIDATION_ERROR"`
- `400` – `code: "ALREADY_COMPLETED"`, `message: "Không thể sửa lịch hẹn đã hoàn thành"`
- `403` – `code: "FORBIDDEN"`
- `404` – `code: "APPOINTMENT_NOT_FOUND"`

Business rules:
- Chỉ update nếu `status != COMPLETED`.
- Cập nhật `updated_at`.
- Chỉ update field có trong body.

---

## 4. Cancel Appointment

```
PATCH /api/appointments/{appointmentId}/cancel/
Auth: Bearer <token> (role=receptionist)
```
Request body: *(none)*

Success `200 OK`:
```json
{
  "success": true,
  "message": "Huỷ lịch hẹn thành công"
}
```
Errors:
- `400` – `code: "ALREADY_COMPLETED"`, `message: "Không thể huỷ lịch hẹn đã hoàn thành"`
- `404` – `code: "APPOINTMENT_NOT_FOUND"`

Business rules:
- Chỉ huỷ nếu `status != COMPLETED`.
- Set `status = "CANCELLED"`, cập nhật `updated_at`.

---

## 5. Dashboard (Today Summary + Upcoming)

```
GET /api/dashboard/today/
Auth: Bearer <token>
```
Success `200 OK`:
```json
{
  "success": true,
  "data": {
    "todayStats": {
      "total": 12,
      "pending": 3,
      "confirmed": 5,
      "inProgress": 2,
      "completed": 1,
      "cancelled": 1
    },
    "upcomingAppointments": [
      {
        "id": "string",
        "patientName": "string",
        "patientCode": "string",
        "doctorName": "string",
        "appointmentTime": "string (ISO datetime)",
        "status": "string"
      }
    ]
  },
  "message": "Lấy dữ liệu dashboard thành công"
}
```
Business rules:
- `todayStats`: COUNT group by `status` cho ngày hiện tại.
- `upcomingAppointments`: 5 appointment sắp tới nhất trong ngày, `appointmentTime` >= now, sắp xếp ASC.
- Nếu role = `doctor` → chỉ tính appointment của doctor đó.
- Join `Patient`, `User(doctor)`.

---

## 6. Statistics (Manager only)

```
GET /api/appointments/stats/?startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}&groupBy={status|doctor|day}
Auth: Bearer <token> (role=manager)
```
Query params:
- `startDate` (required)
- `endDate` (required)
- `groupBy` (required): `status` | `doctor` | `day`

Success `200 OK` – groupBy=status:
```json
{
  "success": true,
  "data": {
    "stats": [
      { "label": "PENDING", "count": 15 },
      { "label": "COMPLETED", "count": 42 },
      { "label": "CANCELLED", "count": 3 }
    ]
  },
  "message": "Lấy thống kê thành công"
}
```
Success `200 OK` – groupBy=doctor:
```json
{
  "success": true,
  "data": {
    "stats": [
      { "doctorId": "string", "doctorName": "string", "count": 25 },
      { "doctorId": "string", "doctorName": "string", "count": 18 }
    ]
  }
}
```
Success `200 OK` – groupBy=day:
```json
{
  "success": true,
  "data": {
    "stats": [
      { "date": "2026-01-10", "count": 8 },
      { "date": "2026-01-11", "count": 12 }
    ]
  }
}
```
Errors:
- `400` – `code: "INVALID_DATE_RANGE"`, `message: "Ngày kết thúc không được trước ngày bắt đầu"`
- `400` – `code: "VALIDATION_ERROR"` nếu thiếu param.
- `403` – `code: "FORBIDDEN"`

Business rules:
- `endDate` >= `startDate`.
- Aggregation: COUNT appointments trong khoảng thời gian, GROUP BY theo param.

---

## Common Error Format

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