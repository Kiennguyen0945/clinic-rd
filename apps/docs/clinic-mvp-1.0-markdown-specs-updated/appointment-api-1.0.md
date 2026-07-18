# Appointment API Contract — MVP 1.0

## 1. Phạm vi và quy ước

Contract này là transport contract mục tiêu cho scheduled appointment, walk-in, calendar, check-in, waiting queue, consultation và completion.

- Base path: `/api`.
- Tất cả endpoint yêu cầu `Authorization: Bearer <token>`.
- JSON public dùng `camelCase`; tên field Django/Python dùng `snake_case` ở nội bộ.
- ID là số nguyên dương; datetime dùng ISO 8601 có timezone.
- Status hợp lệ: `CONFIRMED`, `WAITING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. `PENDING` không thuộc MVP 1.0.
- Appointment type: `SCHEDULED`, `WALK_IN`.
- Status không được cập nhật qua create/update serializer hoặc generic `PATCH`; chỉ business-action endpoint được đổi trạng thái.
- Backend không kiểm tra ca làm, ngày nghỉ hoặc khả năng làm việc của bác sĩ. Lễ tân xác nhận thủ công; “khung giờ trống” chỉ có nghĩa không có appointment xung đột đã lưu.
- Mọi transition dùng transaction, khóa dữ liệu cần thiết và tạo đúng một `AppointmentStatusHistory`.

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

## 2. Appointment resource

```json
{
  "id": 81,
  "appointmentType": "SCHEDULED",
  "patient": {
    "id": 15,
    "patientCode": "BN-20260718-001",
    "fullName": "Nguyễn Văn A",
    "phone": "0901234567"
  },
  "doctor": {
    "id": 7,
    "fullName": "BS. Trần Thị B"
  },
  "creatorId": 3,
  "startTime": "2026-07-18T09:00:00+07:00",
  "endTime": "2026-07-18T09:30:00+07:00",
  "reason": "Đau họng",
  "note": "",
  "status": "CONFIRMED",
  "checkedInAt": null,
  "checkedInById": null,
  "consultationStartedAt": null,
  "consultationStartedById": null,
  "completedAt": null,
  "completedById": null,
  "cancelledAt": null,
  "cancelledById": null,
  "cancellationReason": "",
  "createdAt": "2026-07-17T08:00:00+07:00",
  "updatedAt": "2026-07-17T08:00:00+07:00"
}
```

Các timestamp vận hành có thể `null` cho tới khi action tương ứng thành công. `startTime` và `endTime` không thay đổi theo thời lượng khám thực tế.

## 3. List/filter appointments

```http
GET /api/appointments/?date={YYYY-MM-DD}&doctorIds={id1,id2}&status={status}&appointmentType={type}
Roles: RECEPTIONIST | DOCTOR | MANAGER
```

Query params:

| Param | Bắt buộc | Quy tắc |
|---|---:|---|
| `date` | Không | Ngày theo timezone phòng khám; mặc định ngày hiện tại. |
| `doctorIds` | Không | Danh sách ID phân tách bằng dấu phẩy; dùng cho calendar một hoặc nhiều bác sĩ. |
| `status` | Không | Một trong 5 status hợp lệ. |
| `appointmentType` | Không | `SCHEDULED` hoặc `WALK_IN`. |

Success `200 OK`: `data.appointments` là mảng Appointment resource, sắp xếp `startTime ASC, id ASC`.

Business rules:

- Doctor luôn bị scope theo chính doctor từ token; backend bỏ qua/mâu thuẫn `doctorIds` để tránh xem queue của bác sĩ khác.
- `CANCELLED` vẫn được trả nếu không filter status để calendar có thể hiển thị lịch sử; nó không chiếm khung giờ.
- Multi-doctor view chỉ render tập bác sĩ được chọn, không yêu cầu một cột cố định cho toàn bộ bác sĩ.

Errors: `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403 FORBIDDEN`.

## 4. Create scheduled appointment

```http
POST /api/appointments/
Role: RECEPTIONIST
```

Request:

```json
{
  "patientId": 15,
  "doctorId": 7,
  "startTime": "2026-07-18T09:00:00+07:00",
  "endTime": "2026-07-18T09:30:00+07:00",
  "reason": "Đau họng",
  "note": ""
}
```

`endTime` optional; nếu không gửi, backend đặt `endTime = startTime + 30 phút`. Các field bắt buộc: `patientId`, `doctorId`, `startTime`, `reason`.

Success `201 Created`: trả `data.appointment` với `appointmentType = SCHEDULED`, `status = CONFIRMED`, `creatorId` lấy từ token.

Business rules:

- Phải có `endTime > startTime`.
- Backend kiểm tra overlap ngay trước khi ghi trong transaction.
- Xung đột nếu cùng doctor, cả hai appointment có type `SCHEDULED`, và `existing.start_time < new.end_time` và `existing.end_time > new.start_time`, với status `CONFIRMED|WAITING|IN_PROGRESS|COMPLETED`.
- `CANCELLED` không gây xung đột.
- Request đồng thời cho cùng doctor được serialize/khóa sao cho nhiều nhất một request thành công.
- Calendar selection chỉ prefill form; endpoint này chỉ được gọi khi lễ tân submit.
- Backend không tự sinh slot và không xác nhận lịch làm việc của bác sĩ.

Errors:

- `400 VALIDATION_ERROR`, `details` theo field; gồm trường hợp `endTime <= startTime`.
- `400 PAST_TIME` nếu `startTime` đã ở quá khứ theo chính sách tạo lịch hiện tại.
- `404 PATIENT_NOT_FOUND`, `404 DOCTOR_NOT_FOUND`.
- `409 SCHEDULE_CONFLICT`, `details: { "conflictingAppointmentId": 80 }`.
- `401 UNAUTHORIZED`, `403 FORBIDDEN`.

## 5. Create walk-in appointment

```http
POST /api/appointments/walk-in/
Role: RECEPTIONIST
```

Request:

```json
{
  "patientId": 15,
  "doctorId": 7,
  "reason": "Sốt cao",
  "note": "Khách vãng lai"
}
```

Success `201 Created`: trả `data.appointment` với:

```text
appointmentType = WALK_IN
status = WAITING
checkedInAt = thời điểm tạo
checkedInById = current receptionist
startTime = checkedInAt
endTime = startTime + 30 phút
```

Business rules:

- Walk-in xuất hiện ngay trong waiting queue của doctor đã chọn.
- Không tạo bản ghi queue riêng; queue được suy ra từ `status = WAITING`.
- Planned period của walk-in chỉ phục vụ nhất quán dữ liệu/báo cáo, không chiếm calendar slot và không tham gia overlap check. Vì vậy nhiều walk-in có thể cùng chờ một doctor.
- Hệ thống không tự dịch appointment khác khi tạo walk-in.
- Backend không kiểm tra doctor shift/leave; lễ tân chịu trách nhiệm xác nhận thủ công.

Errors: `400 VALIDATION_ERROR`, `404 PATIENT_NOT_FOUND`, `404 DOCTOR_NOT_FOUND`, `401 UNAUTHORIZED`, `403 FORBIDDEN`. Walk-in không trả `SCHEDULE_CONFLICT`.

## 6. Update confirmed appointment

```http
PATCH /api/appointments/{appointmentId}/
Role: RECEPTIONIST
```

Request chỉ chứa field cần sửa:

```json
{
  "doctorId": 8,
  "startTime": "2026-07-18T10:00:00+07:00",
  "endTime": "2026-07-18T10:30:00+07:00",
  "reason": "Tái khám",
  "note": ""
}
```

Success `200 OK`: trả `data.appointment` sau cập nhật.

Business rules:

- Chỉ appointment `CONFIRMED` được sửa doctor hoặc planned period.
- Nếu chỉ gửi một đầu mút thời gian, validate period cuối cùng sau khi merge với dữ liệu hiện tại.
- Khi đổi doctor/time phải chạy lại overlap check và bỏ qua chính appointment đang sửa.
- Không cho sửa `patientId`, `appointmentType`, các timestamp actor, hoặc metadata tạo.
- Payload chứa `status` bị từ chối bằng `STATUS_MUTATION_NOT_ALLOWED`.

Errors:

- `400 VALIDATION_ERROR`, `400 IMMUTABLE_FIELD`, `400 STATUS_MUTATION_NOT_ALLOWED`.
- `404 APPOINTMENT_NOT_FOUND`, `404 DOCTOR_NOT_FOUND`.
- `409 APPOINTMENT_NOT_EDITABLE` nếu status khác `CONFIRMED`.
- `409 SCHEDULE_CONFLICT`.
- `401 UNAUTHORIZED`, `403 FORBIDDEN`.

## 7. Check in scheduled patient

```http
POST /api/appointments/{appointmentId}/check-in/
Role: RECEPTIONIST
Body: none
```

Success `200 OK`: trả `data.appointment` sau transition `CONFIRMED → WAITING`.

On first success:

- Set `checkedInAt = now`, `checkedInById = current user`.
- Tạo đúng một history `CONFIRMED → WAITING`.
- Appointment xuất hiện trong waiting queue.

Idempotency decision cho AC-10:

- Nếu appointment đã `WAITING`, trả `200 OK` với appointment hiện tại và `data.idempotent = true`.
- Không thay `checkedInAt/checkedInById`, không tạo history hoặc queue entry mới.
- Ngoài ngoại lệ `WAITING`, mọi status khác `CONFIRMED` bị từ chối.

Errors: `404 APPOINTMENT_NOT_FOUND`, `409 INVALID_APPOINTMENT_STATUS`, `401 UNAUTHORIZED`, `403 FORBIDDEN`.

## 8. Cancel appointment

```http
POST /api/appointments/{appointmentId}/cancel/
Role: RECEPTIONIST
```

Request:

```json
{
  "reason": "Bệnh nhân báo không đến"
}
```

Success `200 OK`: trả `data.appointment` sau transition `CONFIRMED|WAITING → CANCELLED`.

Business rules:

- `reason` sau trim là bắt buộc.
- Set `cancelledAt`, `cancelledById`, `cancellationReason` và tạo đúng một status history có reason.
- Cancel từ `WAITING` làm appointment biến mất khỏi waiting queue do queue suy từ status.
- Planned period được giải phóng cho overlap check mới, nhưng dữ liệu `startTime/endTime` lịch sử không bị xóa.
- Không cancel `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.

Errors: `400 CANCELLATION_REASON_REQUIRED`, `404 APPOINTMENT_NOT_FOUND`, `409 INVALID_APPOINTMENT_STATUS`, `401 UNAUTHORIZED`, `403 FORBIDDEN`.

## 9. Doctor waiting queue

```http
GET /api/appointments/waiting-queue/
Role: DOCTOR
```

Success `200 OK`:

```json
{
  "success": true,
  "data": {
    "appointments": [],
    "activeAppointmentId": 81
  },
  "message": "Lấy danh sách chờ thành công"
}
```

Business rules:

- Chỉ trả appointment `WAITING` gán cho current doctor.
- Sắp xếp `checkedInAt ASC, id ASC`.
- Mỗi item là Appointment resource và có đủ patient identity, reason, appointment type, doctor.
- `activeAppointmentId` là appointment `IN_PROGRESS` của current doctor hoặc `null`.

Errors: `401 UNAUTHORIZED`, `403 FORBIDDEN`.

## 10. Start consultation

```http
POST /api/appointments/{appointmentId}/start-consultation/
Role: DOCTOR
Body: none
```

Success `200 OK`: trả `data.appointment` sau transition `WAITING → IN_PROGRESS`.

Business rules:

- Appointment phải được gán cho current doctor.
- Current doctor chưa có appointment `IN_PROGRESS` khác.
- Transaction khóa appointment và phạm vi active consultation của doctor.
- Set `consultationStartedAt`, `consultationStartedById`; tạo đúng một history.
- Appointment rời waiting queue và trở thành active consultation.
- Service tạo hoặc resume MedicalRecord draft one-to-one, bảo đảm patient/doctor khớp appointment.

Errors:

- `403 APPOINTMENT_NOT_ASSIGNED` nếu appointment thuộc doctor khác.
- `404 APPOINTMENT_NOT_FOUND`.
- `409 INVALID_APPOINTMENT_STATUS` nếu không ở `WAITING`.
- `409 DOCTOR_HAS_ACTIVE_CONSULTATION`, `details: { "activeAppointmentId": 80 }`.

## 11. Get active consultation

```http
GET /api/appointments/active-consultation/
Role: DOCTOR
```

Success `200 OK`:

```json
{
  "success": true,
  "data": {
    "appointment": null,
    "medicalRecord": null
  },
  "message": "Lấy ca khám đang thực hiện thành công"
}
```

Nếu có active consultation, `appointment` là Appointment resource và `medicalRecord` là draft resource ở mục 12. Không có active consultation là trạng thái hợp lệ, không phải 404.

## 12. Medical record draft resource

```json
{
  "id": 30,
  "appointmentId": 81,
  "patientId": 15,
  "doctorId": 7,
  "symptoms": "Sốt, đau họng",
  "diagnosis": "",
  "icdCode": "",
  "treatmentPlan": "",
  "notes": "",
  "vitalSigns": {
    "pulse": 82,
    "systolicBloodPressure": 120,
    "diastolicBloodPressure": 80,
    "temperature": "38.2",
    "spo2": 98,
    "weightKg": "60.50",
    "heightCm": "168.0"
  },
  "prescriptionItems": [],
  "medicalOrders": [],
  "isFinalized": false,
  "finalizedAt": null,
  "createdAt": "2026-07-18T09:10:00+07:00",
  "updatedAt": "2026-07-18T09:20:00+07:00"
}
```

`orderType` trong `medicalOrders`: `LAB_TEST`, `IMAGING`, `PROCEDURE`, `OTHER`.

## 13. Get/save medical record draft

```http
GET /api/appointments/{appointmentId}/medical-record/
PUT /api/appointments/{appointmentId}/medical-record/
Role: assigned DOCTOR
```

PUT request:

```json
{
  "symptoms": "Sốt, đau họng",
  "diagnosis": "Viêm họng cấp",
  "icdCode": "J02.9",
  "treatmentPlan": "Điều trị ngoại trú",
  "notes": "",
  "vitalSigns": {
    "pulse": 82,
    "temperature": "38.2",
    "spo2": 98
  },
  "prescriptionItems": [
    {
      "medicationName": "Paracetamol",
      "dosage": "500 mg",
      "quantity": 10,
      "unit": "viên",
      "instructions": "Uống khi sốt",
      "sortOrder": 0
    }
  ],
  "medicalOrders": [
    {
      "orderType": "LAB_TEST",
      "name": "Công thức máu",
      "purpose": "Đánh giá nhiễm trùng",
      "instructions": ""
    }
  ]
}
```

Success `200 OK`: trả `data.medicalRecord`.

Business rules:

- Chỉ assigned doctor và chỉ khi appointment `IN_PROGRESS` mới được ghi draft.
- `patientId`, `doctorId`, `appointmentId`, finalization fields không nhận từ client.
- Draft cho phép `symptoms`/`diagnosis` rỗng; completion thì không.
- Với collection được gửi, payload là snapshot thay thế toàn bộ collection đó; collection bị omit được giữ nguyên. Cập nhật chạy atomically.
- Record đã finalized là read-only.

Errors: `400 VALIDATION_ERROR`, `403 APPOINTMENT_NOT_ASSIGNED`, `404 APPOINTMENT_NOT_FOUND`, `409 INVALID_APPOINTMENT_STATUS`, `409 MEDICAL_RECORD_FINALIZED`.

## 14. Complete consultation

```http
POST /api/appointments/{appointmentId}/complete/
Role: assigned DOCTOR
```

Request là snapshot cuối cùng cùng shape với PUT draft ở mục 13. Client có thể gửi đầy đủ dữ liệu dù trước đó đã save draft.

Success `200 OK`:

```json
{
  "success": true,
  "data": {
    "appointment": {},
    "medicalRecord": {}
  },
  "message": "Hoàn thành ca khám thành công"
}
```

Business rules:

- Appointment phải `IN_PROGRESS`, thuộc current doctor.
- `symptoms` và `diagnosis` sau trim là bắt buộc.
- Một transaction phải: lưu record, prescription items, medical orders; finalize record; set appointment `COMPLETED`; set actor/timestamp; tạo history.
- Lỗi ở bất kỳ bước nào rollback toàn bộ.
- `startTime/endTime` giữ nguyên dù hoàn thành sớm hoặc muộn.
- Completion lặp lại bị từ chối, không đổi timestamp và không tạo record/history trùng.
- Completion trực tiếp từ `WAITING` bị từ chối và hướng caller thực hiện start-consultation trước.

Errors:

- `400 MEDICAL_RECORD_INCOMPLETE`, ví dụ `details.fields: { "symptoms": "Bắt buộc", "diagnosis": "Bắt buộc" }`.
- `403 APPOINTMENT_NOT_ASSIGNED`, `404 APPOINTMENT_NOT_FOUND`.
- `409 CONSULTATION_NOT_STARTED` khi còn `WAITING`.
- `409 INVALID_APPOINTMENT_STATUS` cho status không hợp lệ khác.
- `409 ALREADY_COMPLETED` khi đã `COMPLETED`.

## 15. Dashboard today

```http
GET /api/dashboard/today/
Roles: RECEPTIONIST | DOCTOR | MANAGER
```

Success `200 OK`:

```json
{
  "success": true,
  "data": {
    "todayStats": {
      "total": 12,
      "confirmed": 5,
      "waiting": 3,
      "inProgress": 1,
      "completed": 2,
      "cancelled": 1
    },
    "upcomingAppointments": [],
    "doctorOperations": [
      {
        "doctor": { "id": 7, "fullName": "BS. Trần Thị B" },
        "activeAppointment": null,
        "waitingCount": 2
      }
    ]
  },
  "message": "Lấy dữ liệu dashboard thành công"
}
```

Business rules:

- Stats lấy theo `startTime` thuộc ngày hiện tại của timezone phòng khám và status thật; không suy `IN_PROGRESS` từ việc quá giờ hẹn.
- `total` bằng tổng năm status.
- `upcomingAppointments`: tối đa 5 appointment `CONFIRMED` có `startTime >= now`, sắp xếp tăng dần.
- `doctorOperations` suy từ status: active là `IN_PROGRESS`, waiting count là `WAITING`.
- Doctor chỉ nhận dữ liệu của mình.

## 16. Appointment statistics

```http
GET /api/appointments/stats/?startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}&groupBy={status|doctor|day}
Role: MANAGER
```

Business rules giữ như API hiện tại nhưng dùng `startTime` và đủ năm status mới. `endDate >= startDate`; date range inclusive theo timezone phòng khám.

Success `200 OK`:

- `groupBy=status`: `data.stats = [{ "label": "WAITING", "count": 3 }]`.
- `groupBy=doctor`: `data.stats = [{ "doctorId": 7, "doctorName": "...", "count": 25 }]`.
- `groupBy=day`: `data.stats = [{ "date": "2026-07-18", "count": 8 }]`.

Errors: `400 VALIDATION_ERROR`, `400 INVALID_DATE_RANGE`, `401 UNAUTHORIZED`, `403 FORBIDDEN`.

## 17. Transition and concurrency guarantees

Allowed transitions:

```text
CONFIRMED → WAITING
CONFIRMED → CANCELLED
WAITING → IN_PROGRESS
WAITING → CANCELLED
IN_PROGRESS → COMPLETED
```

Guarantees:

1. `COMPLETED` và `CANCELLED` là terminal.
2. Một doctor có tối đa một appointment `IN_PROGRESS`.
3. Mỗi transition thành công tạo đúng một history với `fromStatus`, `toStatus`, `changedBy`, `changedAt`, `reason`.
4. `reason` bắt buộc khi transition sang `CANCELLED`.
5. Transition nhiều write là atomic; lỗi phải giữ state trước đó.
6. Overlap concurrent booking cho `SCHEDULED` được serialize theo doctor hoặc bảo vệ bằng cơ chế PostgreSQL tương đương; chỉ query `exists()` trong `transaction.atomic()` là chưa đủ.
7. `checkedInAt`, `consultationStartedAt`, `completedAt` không thay đổi planned period.

## 18. Error code summary

| HTTP | Code | Khi dùng |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Field/query sai format hoặc thiếu. |
| 400 | `PAST_TIME` | Tạo scheduled appointment trong quá khứ. |
| 400 | `IMMUTABLE_FIELD` | Sửa field không được phép. |
| 400 | `STATUS_MUTATION_NOT_ALLOWED` | Gửi `status` qua generic update. |
| 400 | `CANCELLATION_REASON_REQUIRED` | Hủy không có reason. |
| 400 | `MEDICAL_RECORD_INCOMPLETE` | Thiếu field bắt buộc để complete. |
| 401 | `UNAUTHORIZED` | Token thiếu/không hợp lệ. |
| 403 | `FORBIDDEN` | Role không được phép. |
| 403 | `APPOINTMENT_NOT_ASSIGNED` | Doctor thao tác appointment của doctor khác. |
| 404 | `PATIENT_NOT_FOUND` | Patient không tồn tại. |
| 404 | `DOCTOR_NOT_FOUND` | Doctor không tồn tại/không có role doctor. |
| 404 | `APPOINTMENT_NOT_FOUND` | Appointment không tồn tại. |
| 409 | `SCHEDULE_CONFLICT` | Planned period bị overlap. |
| 409 | `APPOINTMENT_NOT_EDITABLE` | Edit appointment không còn `CONFIRMED`. |
| 409 | `INVALID_APPOINTMENT_STATUS` | Action không hợp lệ với current status. |
| 409 | `DOCTOR_HAS_ACTIVE_CONSULTATION` | Doctor đã có ca `IN_PROGRESS`. |
| 409 | `CONSULTATION_NOT_STARTED` | Complete khi chưa start. |
| 409 | `ALREADY_COMPLETED` | Complete lặp lại. |
| 409 | `MEDICAL_RECORD_FINALIZED` | Cố sửa record đã finalize. |

## 19. Canonical endpoint list và URL migration

```text
GET    /api/appointments/
POST   /api/appointments/
POST   /api/appointments/walk-in/
PATCH  /api/appointments/{id}/
POST   /api/appointments/{id}/check-in/
POST   /api/appointments/{id}/cancel/
GET    /api/appointments/waiting-queue/
POST   /api/appointments/{id}/start-consultation/
GET    /api/appointments/active-consultation/
GET    /api/appointments/{id}/medical-record/
PUT    /api/appointments/{id}/medical-record/
POST   /api/appointments/{id}/complete/
GET    /api/dashboard/today/
GET    /api/appointments/stats/
```

Các route hiện tại trong `appointment_service/urls.py` mới chỉ là baseline cũ. Khi triển khai MVP 1.0:

- `PATCH /appointments/{id}/cancel/` cũ được thay bằng canonical `POST` có body `reason`.
- `POST /medical-records/` cũ bị loại khỏi contract; completion phải đi qua start → draft → complete.
- `PUT /appointments/{id}/` partial-update cũ được thay bằng `PATCH`.
- Không duy trì alias âm thầm nếu chưa có kế hoạch deprecation và contract test rõ ràng.
