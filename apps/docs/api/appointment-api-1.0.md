# Appointment API 1.0

Tất cả endpoint dưới đây dùng tiền tố `/api` và yêu cầu header:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Response thành công có dạng `{ "success": true, "data": ..., "message": "..." }`. Response lỗi có dạng:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mô tả lỗi",
    "details": {}
  }
}
```

## 1. Danh sách lịch hẹn

```http
GET /api/appointments/?date={YYYY-MM-DD}&doctorId={id}&status={status}
```

Quyền: `receptionist`, `doctor`, `manager`.

- `date` không bắt buộc, mặc định là ngày hiện tại.
- `doctorId` không bắt buộc; bác sĩ luôn chỉ xem lịch của mình.
- `status` không bắt buộc: `PENDING`, `CONFIRMED`, `WAITING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- Kết quả sắp xếp theo `appointment_time` tăng dần.

```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": 12,
        "patient": {
          "id": "7",
          "patientCode": "BN-20260722-001",
          "fullName": "Nguyễn Văn A",
          "phone": "0901234567"
        },
        "doctor": { "id": "3", "fullName": "BS. Trần B" },
        "slot_id": 5,
        "appointment_code": "LH20260722D3-001",
        "department_id": 2,
        "sequence_number": 1,
        "booking_type": "SCHEDULE",
        "patient_type": "SERVICE",
        "bhyt_number": null,
        "appointment_time": "2026-07-22T08:00:00Z",
        "reason": "Đau đầu",
        "status": "CONFIRMED",
        "cancellation_reason": "",
        "created_at": "2026-07-21T10:00:00Z",
        "updated_at": "2026-07-21T10:00:00Z"
      }
    ]
  },
  "message": "Lấy danh sách lịch hẹn thành công"
}
```

## 2. Tạo lịch khám

```http
POST /api/appointments/
```

Quyền: `receptionist`.

Request:

```json
{
  "patientId": 7,
  "doctorId": 3,
  "slotId": 5,
  "departmentId": 2,
  "bookingType": "SCHEDULE",
  "patientType": "SERVICE",
  "bhytNumber": null,
  "reason": "Đau đầu"
}
```

Các quy tắc:

- `patientId`, `doctorId`, `slotId` là bắt buộc.
- `bookingType`: `SCHEDULE` hoặc `WALK_IN`, mặc định `SCHEDULE`.
- Giờ hẹn luôn lấy từ `slot.start_time`; không gửi giờ tự do. Nếu gửi `appointmentTime`, giá trị phải trùng giờ bắt đầu slot.
- Slot phải `OPEN`, còn chỗ và thỏa lead time 30 phút cho `SCHEDULE`.
- `WALK_IN` chỉ được tạo trong slot đang diễn ra, còn chỗ và chưa kết thúc.
- Hệ thống ngừng tạo appointment mới trong ngày hiện tại từ 16:00.
- `patientType`: `BHYT` hoặc `SERVICE`, mặc định `SERVICE`. `BHYT` bắt buộc `bhytNumber`.
- Hệ thống sinh `appointment_code` theo dạng `LHYYYYMMDDD{doctorId}-{sequence}` và `sequence_number` tăng xuyên suốt theo bác sĩ/ngày, không tái sử dụng khi lịch bị hủy.
- `SCHEDULE` tạo với trạng thái `CONFIRMED`; `WALK_IN` tạo với trạng thái `WAITING`.

Response `201 Created` trả về object `appointment` giống endpoint danh sách.

Các lỗi thường gặp:

- `VALIDATION_ERROR`: thiếu hoặc sai dữ liệu.
- `PAST_TIME`: thời gian lịch đặt đã ở quá khứ.
- `PATIENT_NOT_FOUND`, `DOCTOR_NOT_FOUND`, `SLOT_NOT_FOUND`, `DEPARTMENT_NOT_FOUND`.
- `SLOT_FULL`, `SLOT_CLOSED`, `SLOT_NOT_BOOKABLE`, `SLOT_NOT_CURRENT`.
- `SLOT_DOCTOR_MISMATCH`, `SLOT_TIME_MISMATCH`, `DOCTOR_DEPARTMENT_MISMATCH`, `RECEPTION_CLOSED`.
- `403 FORBIDDEN`: tài khoản không phải lễ tân.

## 3. Cập nhật lịch khám

```http
PUT /api/appointments/{appointmentId}/
```

Quyền: `receptionist`.

Request chỉ cần gửi các trường muốn thay đổi:

```json
{
  "appointmentTime": "2026-07-22T09:00:00+07:00",
  "doctorId": 4,
  "reason": "Tái khám"
}
```

Không được sửa lịch có trạng thái `COMPLETED`. Lịch đã gắn `slotId` chỉ được sửa lý do khám; không được đổi giờ hoặc bác sĩ.

Lỗi: `APPOINTMENT_NOT_FOUND`, `ALREADY_COMPLETED`, `PAST_TIME`, `VALIDATION_ERROR`, `DOCTOR_NOT_FOUND`, `403 FORBIDDEN`.

## 4. Bệnh nhân đến khám (check-in)

```http
POST /api/appointments/{appointmentId}/check-in/
```

Quyền: `receptionist`.

Chỉ lịch `CONFIRMED` mới được chuyển sang `WAITING`. Response trả về object `appointment` đã cập nhật.

Lỗi: `APPOINTMENT_NOT_FOUND`, `INVALID_STATUS_TRANSITION`, `403 FORBIDDEN`.

## 5. Bắt đầu lượt khám

```http
POST /api/appointments/{appointmentId}/start/
```

Quyền: `doctor` được phân công cho lịch đó.

Chỉ lịch `WAITING` mới được chuyển sang `IN_PROGRESS`. Bác sĩ không được bắt đầu lịch của bác sĩ khác.

Lỗi: `APPOINTMENT_NOT_FOUND`, `INVALID_STATUS_TRANSITION`, `403 FORBIDDEN`.

## 6. Hủy lịch / hủy lượt khám

```http
PATCH /api/appointments/{appointmentId}/cancel/
```

Quyền và điều kiện:

- `receptionist` được hủy `PENDING`, `CONFIRMED` hoặc `WAITING`.
- `doctor` chỉ được hủy lịch của mình khi đang `IN_PROGRESS`.
- Khi bác sĩ hủy, request bắt buộc có lý do:

```json
{ "cancellationReason": "Bệnh nhân bỏ về giữa chừng" }
```

Lịch bị hủy chuyển sang `CANCELLED`, slot được giải phóng công suất và response trả về object `appointment`.

Không thể hủy `COMPLETED`. Lỗi: `APPOINTMENT_NOT_FOUND`, `ALREADY_COMPLETED`, `INVALID_STATUS_TRANSITION`, `VALIDATION_ERROR`, `403 FORBIDDEN`.

## 7. Tạo bệnh án và hoàn thành lượt khám

```http
POST /api/medical-records/
```

Quyền: `doctor` được phân công cho lịch.

Request:

```json
{
  "appointmentId": 12,
  "symptoms": "Đau đầu từ ba ngày nay",
  "diagnosis": "Đau đầu do căng thẳng",
  "notes": "Nghỉ ngơi và uống đủ nước"
}
```

Chỉ lịch `IN_PROGRESS` mới được tạo bệnh án. Khi lưu thành công, hệ thống tạo bản ghi `MedicalRecord` và chuyển lịch sang `COMPLETED`.

Lỗi: `APPOINTMENT_NOT_FOUND`, `RECORD_EXISTS`, `INVALID_STATUS_TRANSITION`, `VALIDATION_ERROR`, `403 FORBIDDEN`.

## 8. Dashboard trong ngày

```http
GET /api/dashboard/today/
```

Quyền: người dùng đã đăng nhập. Bác sĩ chỉ thấy dữ liệu các lịch do mình phụ trách.

Response có `todayStats` gồm `total`, `pending`, `confirmed`, `inProgress`, `completed`, `cancelled` và `upcomingAppointments` gồm tối đa 5 lịch sắp tới.

```json
{
  "success": true,
  "data": {
    "todayStats": {
      "total": 12,
      "pending": 0,
      "confirmed": 5,
      "inProgress": 2,
      "completed": 4,
      "cancelled": 1
    },
    "upcomingAppointments": [
      {
        "id": "12",
        "patientName": "Nguyễn Văn A",
        "patientCode": "BN-20260722-001",
        "doctorName": "BS. Trần B",
        "appointmentTime": "2026-07-22T08:30:00+07:00",
        "status": "CONFIRMED"
      }
    ]
  },
  "message": "Lấy dữ liệu dashboard thành công"
}
```

## 9. Thống kê lịch hẹn

```http
GET /api/appointments/stats/?startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}&groupBy={status|doctor|day}
```

Quyền: `manager`.

- `startDate`, `endDate`, `groupBy` là bắt buộc.
- `endDate` không được trước `startDate`.
- `groupBy` nhận `status`, `doctor` hoặc `day`.
- Response có dạng `{ "data": { "stats": [...] } }`.

Lỗi: `VALIDATION_ERROR`, `INVALID_DATE_RANGE`, `403 FORBIDDEN`.

## 10. Chuyển trạng thái

| Trạng thái hiện tại | Trạng thái mới | Endpoint | Người thực hiện |
|---|---|---|---|
| (none) | `CONFIRMED` | `POST /api/appointments/` với `bookingType=SCHEDULE` | Lễ tân |
| (none) | `WAITING` | `POST /api/appointments/` với `bookingType=WALK_IN` | Lễ tân |
| `CONFIRMED` | `WAITING` | `POST /api/appointments/{id}/check-in/` | Lễ tân |
| `WAITING` | `IN_PROGRESS` | `POST /api/appointments/{id}/start/` | Bác sĩ phụ trách |
| `IN_PROGRESS` | `COMPLETED` | `POST /api/medical-records/` | Bác sĩ phụ trách |
| `CONFIRMED`, `WAITING` | `CANCELLED` | `PATCH /api/appointments/{id}/cancel/` | Lễ tân |
| `IN_PROGRESS` | `CANCELLED` | `PATCH /api/appointments/{id}/cancel/` + lý do | Bác sĩ phụ trách |

`PENDING` được giữ để tương thích với dữ liệu cũ; lịch mới không còn tạo ở trạng thái này.

## 11. Danh sách DoctorSlot

```http
GET /api/doctor-slots/?date={YYYY-MM-DD}&doctorId={id}&bookingType={SCHEDULE|WALK_IN}
GET /api/doctor-slots/{slotId}/
```

Quyền: `receptionist`, `doctor`, `manager`. Bác sĩ chỉ xem ca của mình.

Mỗi slot trả về `capacity`, `bookedCount`, `remainingCapacity`, `isFull`, `isBookable`, `isOngoing`, `isEnded`, `status` (`OPEN` hoặc `CLOSED`) và khoảng thời gian `startTime` - `endTime`. `bookedCount` tính các appointment không bị `CANCELLED`; `FULL` là giá trị suy ra, không lưu trong database.

Endpoint chi tiết trả thêm danh sách appointment thuộc slot, sắp theo `sequence_number`.

## 12. Danh sách chờ lễ tân

```http
GET /api/appointments/queue/?date={YYYY-MM-DD}&keyword={text}
```

Quyền: `receptionist`, `doctor`, `manager`.

Chỉ trả các lịch `WAITING` và `CONFIRMED`, sắp xếp `WAITING` trước `CONFIRMED`, sau đó theo `sequence_number` tăng dần. `keyword` hỗ trợ họ tên, mã bệnh nhân, số điện thoại, số khám và mã lịch hẹn.
