# Prompt Plan triển khai Clinic Appointment & Consultation MVP 1.0

## 1. Kết luận nhanh

Khuyến nghị dùng **16 prompt tuần tự**:

- Prompt 01–09: backend, database, service, API và contract/integration test.
- Prompt 10–16: frontend từ lớp API/type đến calendar, tiếp nhận, hàng chờ, khám bệnh và nghiệm thu end-to-end.

16 prompt là mức tách phù hợp cho repo hiện tại: mỗi prompt có một mục tiêu kiểm chứng được, hạn chế việc model/migration/API/UI cùng thay đổi trong một lượt quá lớn. Không nên bắt đầu frontend trước khi Prompt 09 đạt vì API 1.0 thay đổi không tương thích với code hiện tại (`PENDING`, `appointment_time`, generic completion).

Luồng phụ thuộc:

```text
01 Schema/migration
  → 02 Scheduling services
  → 03 Lifecycle services
  → 04 Clinical services
  → 05 Patient API
  → 06 Scheduling API
  → 07 Operational API
  → 08 Clinical/dashboard API
  → 09 Backend contract gate
  → 10 Frontend API foundation
  → 11 Patient UI
  → 12 Scheduled calendar UI
  → 13 Walk-in/reception UI
  → 14 Doctor queue UI
  → 15 Consultation UI
  → 16 End-to-end release gate
```

## 2. Nguồn chuẩn và thứ tự ưu tiên

Mỗi prompt phải được cung cấp đúng các file được liệt kê ở mục “Context bắt buộc”. Khi có mâu thuẫn, dùng thứ tự ưu tiên sau:

1. [acceptance-criteria.md](acceptance-criteria.md) — hành vi phải nghiệm thu.
2. [appointment-lifecycle-spec.md](appointment-lifecycle-spec.md), [calendar-scheduling-spec.md](calendar-scheduling-spec.md), [consultation-workflow-spec.md](consultation-workflow-spec.md).
3. [django-data-model-spec.md](django-data-model-spec.md) — model/constraint/transaction mục tiêu.
4. [patient-api-1.0.md](patient-api-1.0.md), [appointment-api-1.0.md](appointment-api-1.0.md) — quyết định transport, payload, HTTP/code.
5. [appointment-flow.puml](../flows/appointment-flow.puml) — tài liệu tham khảo luồng cũ, không được ghi đè các spec mới.
6. Code hiện tại — baseline cần migrate, không phải nguồn hành vi mục tiêu.

## 3. Các quyết định đã khóa trước khi triển khai

| Vấn đề baseline | Quyết định MVP 1.0 |
|---|---|
| Code/API cũ có `PENDING` | Loại bỏ; scheduled khởi tạo `CONFIRMED`, walk-in khởi tạo `WAITING`. |
| Code cũ có `appointment_time` | Thay bằng `start_time` và `end_time`; API dùng `startTime`, `endTime`. |
| Flow PUML kiểm tra lịch làm việc | Không triển khai DoctorSchedule/leave/shift; lễ tân xác nhận thủ công. |
| Flow PUML bỏ qua Start consultation | Bắt buộc `WAITING → IN_PROGRESS → COMPLETED`. |
| `POST /medical-records/` vừa tạo record vừa complete | Loại khỏi 1.0; dùng start → draft → complete. |
| Generic update đổi status | Từ chối; chỉ action endpoint đổi status. |
| Check-in lại appointment `WAITING` | Idempotent `200`, giữ timestamp/history; các status không hợp lệ khác trả `409`. Đây là ngoại lệ cụ thể của AC-10 so với AC-11. |
| Walk-in có planned period 30 phút | Chỉ dùng cho dữ liệu/báo cáo, không chiếm slot; chỉ `SCHEDULED` tham gia overlap. Quyết định này dựa trên calendar scope và cho phép nhiều walk-in cùng vào queue. |
| API hiện tại dùng lẫn snake/camel và ID string | Public JSON 1.0 dùng `camelCase`, ID integer; Python/model vẫn `snake_case`. |
| Cancel hiện tại dùng `PATCH` không reason | Canonical 1.0 là `POST .../cancel/` với `reason` bắt buộc. |
| Dashboard suy `inProgress` từ thời gian | Chỉ suy từ status thật `IN_PROGRESS`. |
| `transaction.atomic()` + `.exists()` cho concurrent booking | Chưa đủ; phải serialize theo doctor (khóa doctor row/advisory lock) hoặc constraint PostgreSQL tương đương. |

Nếu team thay đổi một quyết định trong bảng này, phải sửa đồng thời API contract, test mapping và các prompt còn lại trước khi triển khai tiếp.

## 4. Context chung cho mọi prompt

Ngoài context riêng, luôn cung cấp:

- Nội dung prompt hiện tại và kết quả bàn giao của prompt ngay trước đó.
- `git status --short` và diff của các file liên quan để bảo toàn thay đổi đang có.
- Cấu trúc file liên quan (`rg --files`), không giả định đường dẫn hoặc framework.
- Quy ước response trong hai API contract 1.0.
- Role codes backend: `RECEPTIONIST`, `DOCTOR`, `MANAGER`; frontend phải map rõ với role hiện có trong auth store.
- Lệnh chuẩn:

```bash
cd apps/backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test

cd ../frontend
npm run test
npm run lint
npm run build
```

Riêng test concurrency/constraint phải chạy trên PostgreSQL. SQLite chỉ được dùng cho test nhanh không phụ thuộc row locking/partial constraint.

Mỗi prompt yêu cầu agent:

1. Đọc context trước khi sửa.
2. Chỉ sửa scope của prompt, không xóa thay đổi ngoài scope.
3. Viết/cập nhật test cùng implementation.
4. Không dùng generic status mutation.
5. Chạy các lệnh nghiệm thu liên quan.
6. Bàn giao: file đã đổi, migration mới, test đã chạy/kết quả, rủi ro hoặc contract deviation còn lại.

## 5. Ma trận coverage

| Nhóm hành vi | Backend prompt | Frontend prompt | AC chính |
|---|---|---|---|
| Model/status/time/history | 01, 03 | 10 | AC-01, AC-25, AC-34 |
| Scheduled/calendar/overlap | 02, 06, 09 | 12 | AC-02, AC-04–08, AC-28–32 |
| Walk-in | 02, 06 | 13 | AC-03, AC-33 |
| Check-in/cancel | 03, 07 | 12, 13 | AC-09–11, AC-20–24 |
| Queue/start/single active | 03, 07, 09 | 14 | AC-12–15 |
| Draft/complete clinical record | 04, 08, 09 | 15 | AC-16–19, AC-25–27, AC-36 |
| Contract/regression/release | 05–09 | 10, 16 | Toàn bộ AC-01–36 |

# Giai đoạn A — Backend

## Prompt 01 — Migrate data model và dữ liệu cũ

### Mục tiêu

Đưa schema hiện tại từ `PENDING + appointment_time + MedicalRecord tối giản` lên model MVP 1.0, bằng migration có thể kiểm tra và rollback theo quy trình deploy.

### Context bắt buộc

- `django-data-model-spec.md` (toàn bộ, đặc biệt mục 3–5, 8–13, 17–18).
- `appointment-lifecycle-spec.md` mục 2–10.
- `acceptance-criteria.md`: AC-01, AC-25, AC-34–36.
- `apps/backend/appointment_service/models.py`, `admin.py`, migrations hiện có.
- `apps/backend/patient_service/models.py`, `apps/backend/auth_service/models.py`.
- Settings database và dữ liệu mẫu/fixture nếu có.

### Prompt triển khai

```text
Hãy migrate Django models lên Clinic MVP 1.0 theo context. Tạo Appointment enums/fields/indexes/check constraint/partial unique constraint; AppointmentStatusHistory; MedicalRecord mở rộng; PrescriptionItem; MedicalOrder; và đúng on_delete. Tạo migration theo từng pha schema → RunPython backfill → constraint, không sửa migration đã apply.

Backfill legacy phải deterministic và được test: appointment_time → start_time; end_time = start + 30 phút; PENDING → CONFIRMED; appointment_type mặc định SCHEDULED. Với legacy COMPLETED/CANCELLED, dùng updated_at và actor có quan hệ hợp lệ theo mapping được ghi chú rõ để thỏa schema; cancellation reason legacy phải có marker dễ audit. Không bịa lịch sử transition chi tiết không tồn tại. Kiểm tra dữ liệu trước khi thêm non-null/constraint.

Chỉ SCHEDULED chiếm calendar slot. Giữ operational timestamps tách khỏi planned time. Thêm model tests cho choices, clean(), relationship consistency, finalization, constraints và deletion protection. Đăng ký model mới vào admin nếu repo đang dùng admin.
```

### Tiêu chí nghiệm thu

- [ ] Model có đúng 5 status, 2 appointment types; không còn runtime reference `PENDING`/`appointment_time`.
- [ ] Có check `end_time > start_time` và unique conditional một `IN_PROGRESS`/doctor.
- [ ] MedicalRecord one-to-one và direct patient/doctor consistency; prescription/order relationship đúng.
- [ ] `PROTECT`/`CASCADE` đúng data-model spec.
- [ ] Migration chạy được từ database legacy có record `PENDING`, `COMPLETED`, `CANCELLED`; dữ liệu mẫu giữ được planned time.
- [ ] `migrate` forward trên bản sao test thành công; rollback procedure được ghi trong bàn giao.
- [ ] `python manage.py check`, model tests và `makemigrations --check --dry-run` pass.

### Bàn giao sang Prompt 02

Model API thực tế, tên migration, bảng mapping dữ liệu cũ và kết quả test PostgreSQL.

## Prompt 02 — Scheduling services và bảo vệ concurrent booking

### Mục tiêu

Xây domain service cho create scheduled, create walk-in, update confirmed và overlap validation; chưa expose HTTP.

### Context bắt buộc

- Output Prompt 01.
- `calendar-scheduling-spec.md`.
- `django-data-model-spec.md` mục 4, 6, 7, 14–15.
- `appointment-api-1.0.md` mục 4–6, 17.
- AC-02–08, AC-25–33.
- `auth_service/models.py` để khóa doctor row đúng cách.

### Prompt triển khai

```text
Tạo service layer scheduling, tách khỏi DRF views: create_scheduled_appointment, create_walk_in_appointment, update_confirmed_appointment và reusable conflict query. Mọi create/update chạy transactionally.

Scheduled: default 30 phút nếu thiếu end, validate end > start, initial CONFIRMED, creator từ actor, conflict chỉ giữa SCHEDULED cùng doctor với status không CANCELLED. Để chống phantom race, khóa doctor row trước conflict check; khi đổi doctor khóa các doctor liên quan theo thứ tự ID cố định để tránh deadlock.

Walk-in: server lấy một timestamp now duy nhất cho checked_in_at/start_time, end = +30 phút, initial WAITING và checked_in_by actor; không chạy calendar overlap và cho phép nhiều walk-in của cùng doctor vào queue. Không kiểm tra shift/leave. Không cho caller truyền status/actor timestamps.

Viết unit/integration tests, gồm hai transaction concurrent tạo scheduled overlap trên PostgreSQL và boundary tiếp giáp end == next start không conflict.
```

### Tiêu chí nghiệm thu

- [ ] AC-02–08, AC-28, AC-30–33 có automated test ở service layer.
- [ ] Default duration và invalid period đúng; planned time không đổi bởi dữ liệu actual.
- [ ] Overlap formula đúng và bỏ qua cancelled/self khi update.
- [ ] Hai request scheduled overlap đồng thời: đúng một success, một domain conflict.
- [ ] Hai walk-in gần đồng thời cho cùng doctor đều có thể tạo và vào `WAITING`.
- [ ] Không có query/model DoctorSchedule hoặc logic “doctor đang làm việc”.
- [ ] Service không import DRF Response/serializer.

### Bàn giao sang Prompt 03

Public service signatures, domain exception list, lock strategy và kết quả concurrency test PostgreSQL.

## Prompt 03 — Lifecycle services: check-in, start, cancel, history

### Mục tiêu

Cài state machine và transition transactionally, gồm single active consultation và status history.

### Context bắt buộc

- Output Prompt 01–02.
- `appointment-lifecycle-spec.md` toàn bộ.
- `consultation-workflow-spec.md` mục 5–8, 12–14.
- `appointment-api-1.0.md` mục 7–11, 17.
- AC-09–15, AC-20–24, AC-34–36.

### Prompt triển khai

```text
Tạo lifecycle service check_in_appointment, start_consultation và cancel_appointment. Dùng một transition validator; khóa appointment trong transaction; set timestamps/actor từ server; tạo đúng một AppointmentStatusHistory sau mutation thành công.

Check-in CONFIRMED → WAITING. Nếu đã WAITING thì idempotent: giữ nguyên checked_in metadata, không history mới. Các status khác lỗi.

Start chỉ WAITING, assigned doctor, doctor chưa có IN_PROGRESS. Khóa doctor/appointment và dựa cả service validation + partial unique constraint; khi conflict trả active appointment ID. Khởi tạo/resume MedicalRecord draft có patient/doctor khớp.

Cancel chỉ CONFIRMED/WAITING, reason sau trim bắt buộc; không cancel IN_PROGRESS/terminal. Không xóa planned period. Không tạo queue table: queue là query status.

Viết test ma trận mọi allowed/forbidden transition, actor permission ở service boundary, rollback khi history write lỗi và hai request start đồng thời.
```

### Tiêu chí nghiệm thu

- [ ] AC-09–15, AC-20–24, AC-34–36 pass bằng automated tests.
- [ ] Check-in lặp không đổi timestamp và history count.
- [ ] Start appointment doctor khác bị từ chối, state không đổi.
- [ ] Một doctor không thể có hai `IN_PROGRESS`, kể cả concurrent request.
- [ ] Cancel reason được lưu ở appointment và history.
- [ ] Mọi failure rollback cả appointment, metadata, draft và history.
- [ ] Terminal status không có đường transition tiếp.

### Bàn giao sang Prompt 04

Transition service signatures, exceptions kèm metadata (`active_appointment_id`) và test matrix.

## Prompt 04 — Clinical draft và atomic completion services

### Mục tiêu

Hoàn thiện save/resume draft, prescription items, medical orders, validation và completion atomic.

### Context bắt buộc

- Output Prompt 01–03.
- `consultation-workflow-spec.md` mục 7–11, 14–15.
- `django-data-model-spec.md` mục 9–11, 14–16.
- `appointment-api-1.0.md` mục 12–14.
- AC-16–19, AC-25–27, AC-36.

### Prompt triển khai

```text
Tạo get_or_create_medical_record_draft, save_medical_record_draft và complete_consultation service. Chỉ assigned doctor được ghi khi appointment IN_PROGRESS. Server tự gán appointment/patient/doctor; không nhận identity/finalization metadata từ client.

Draft cho phép symptoms/diagnosis rỗng. Với prescriptionItems/medicalOrders: collection được gửi là snapshot replace atomically; omit thì giữ nguyên. Validate numeric/vital/order fields và record đã finalized là read-only.

Completion nhận snapshot cuối, bắt buộc symptoms và diagnosis sau trim. Trong một transaction và row lock: validate owner/status, save record/items/orders, finalize metadata, appointment COMPLETED metadata, một history. Failure injection ở từng nhóm write phải rollback. WAITING trả consultation-not-started; COMPLETED lặp lại không đổi timestamp/record/history.
```

### Tiêu chí nghiệm thu

- [ ] Draft resume đúng one-to-one, không record trùng.
- [ ] Patient/doctor luôn khớp appointment.
- [ ] Missing `symptoms`/`diagnosis` trả danh sách field, appointment vẫn `IN_PROGRESS`, record chưa finalized.
- [ ] Completion thành công lưu đồng thời record, items, orders, finalized và status history.
- [ ] Failure injection chứng minh rollback AC-36.
- [ ] Repeated completion không đổi `completed_at`/`finalized_at`, không duplicate.
- [ ] Early/late completion không sửa `start_time/end_time`.

### Bàn giao sang Prompt 05

Clinical service DTO/schema, collection replacement semantics, validation exceptions và atomicity tests.

## Prompt 05 — Patient API 1.0 và finalized medical history

### Mục tiêu

Đưa Patient API về đúng contract camelCase, permission và history mới; loại ownership sai của endpoint tạo MedicalRecord.

### Context bắt buộc

- Output Prompt 01 và 04.
- `patient-api-1.0.md` toàn bộ.
- `apps/backend/patient_service/{models,serializers,views,urls,tests}.py`.
- `apps/backend/appointment_service/serializers.py` phần history hiện tại.
- `backend/response_utils.py`, authentication/permissions.

### Prompt triển khai

```text
Implement Patient API đúng patient-api-1.0.md. Public payload camelCase nhưng model snake_case. GET list/search cho ba role, POST/PATCH chỉ receptionist, GET detail theo contract. Patient code generation và duplicate phone phải transaction-safe; duplicate trả 409 theo contract. Unknown/immutable fields không được âm thầm bỏ qua.

History endpoint chỉ doctor, chỉ finalized record của COMPLETED appointment, newest first, serialize vital signs/prescriptions/orders. Không expose draft. Xóa/deprecate ownership của POST /medical-records/ khỏi patient contract; không để endpoint đó complete appointment.

Viết request/response contract tests cho status code, envelope, casing, ID type, permission và empty arrays.
```

### Tiêu chí nghiệm thu

- [ ] Tất cả endpoint/role/error trong patient contract có API test.
- [ ] Response không trộn `patient_code/full_name` với public camelCase.
- [ ] Duplicate phone trả `409 DUPLICATE_PHONE`; code generation không trùng khi concurrent.
- [ ] PATCH từ chối field immutable/unknown.
- [ ] History không trả draft và có nested clinical data đúng thứ tự.
- [ ] Không endpoint Patient API nào đổi Appointment.status.
- [ ] Patient test suite và Django check pass.

### Bàn giao sang Prompt 06

Serializer/resource shape chính xác, URL patterns, contract test helpers và breaking changes cho frontend.

## Prompt 06 — Appointment scheduling/query HTTP API

### Mục tiêu

Expose list/filter, scheduled create, walk-in create và confirmed update bằng services Prompt 02.

### Context bắt buộc

- Output Prompt 02 và 05.
- `appointment-api-1.0.md` mục 1–6, 18–19.
- `apps/backend/appointment_service/{serializers,views,urls,tests}.py` hiện tại.
- `apps/backend/auth_service` user/role endpoint dùng để chọn doctor.
- AC-02–08, AC-28–33.

### Prompt triển khai

```text
Implement canonical scheduling/query endpoints theo contract. Serializer chỉ map/validate transport và gọi domain services; không lặp business logic trong view. Public JSON camelCase, integer IDs, ISO datetimes.

GET list hỗ trợ date, doctorIds, status, appointmentType; doctor luôn scope về mình. POST scheduled và POST walk-in dùng hai service riêng. PATCH detail chỉ update field được phép, từ chối status/identity/timestamps. Map domain exceptions sang chính xác HTTP/error code, đặc biệt 409 SCHEDULE_CONFLICT.

Cập nhật urls theo canonical list và viết API tests gồm default end, calendar prefill không gọi create, multi-doctor filter, malformed query, role scope và concurrent conflict đã được chứng minh ở service test.
```

### Tiêu chí nghiệm thu

- [ ] List trả đúng resource, filters và sort; doctor không xem appointment doctor khác.
- [ ] Scheduled create `CONFIRMED`; walk-in create `WAITING` với server timestamps.
- [ ] Default 30 phút và invalid period đúng contract.
- [ ] Update chỉ `CONFIRMED`, rerun conflict; status mutation bị từ chối.
- [ ] Không có `appointmentTime`/`PENDING` trong response/runtime.
- [ ] URL names không va chạm static route với `<int:pk>`.
- [ ] API tests map AC-02–08, AC-28–33 pass.

### Bàn giao sang Prompt 07

OpenAPI-like endpoint table thực tế, serializer fields và sample response từ tests.

## Prompt 07 — Lifecycle/operational HTTP API

### Mục tiêu

Expose check-in, cancel, waiting queue, start consultation và active consultation.

### Context bắt buộc

- Output Prompt 03 và 06.
- `appointment-api-1.0.md` mục 7–11, 17–19.
- `consultation-workflow-spec.md` mục 5–8, 12–15.
- Current appointment URLs/views/serializers/tests.
- AC-09–15, AC-20–24, AC-34–36.

### Prompt triển khai

```text
Expose lifecycle services qua canonical POST action endpoints và GET queue/active endpoints. Views không nhận actor timestamp/status từ body. Cancel bắt buộc reason. Check-in WAITING trả idempotent=true. Queue chỉ current doctor WAITING, checkedInAt ascending. Start conflict trả 409 DOCTOR_HAS_ACTIVE_CONSULTATION với activeAppointmentId. Active GET trả null/null khi không có ca.

Thay route cancel PATCH cũ bằng POST canonical; không giữ behavior không reason. Viết API permission/ownership/status matrix tests và assert history count/state sau mỗi request.
```

### Tiêu chí nghiệm thu

- [ ] Năm operational endpoint đúng method/path/role/response.
- [ ] Queue chỉ đúng doctor/status/order; không có duplicate queue model/entry.
- [ ] Check-in idempotent đúng AC-10.
- [ ] Start doctor khác và second-active trả đúng 403/409 + details.
- [ ] Cancel `IN_PROGRESS`/terminal bị chặn; reason rỗng bị chặn.
- [ ] API failure không tạo timestamp/history dở dang.
- [ ] AC-09–15, AC-20–24, AC-34–36 pass ở API layer.

### Bàn giao sang Prompt 08

Action error matrix và fixtures tạo từng lifecycle state.

## Prompt 08 — Clinical, dashboard và statistics HTTP API

### Mục tiêu

Expose draft/complete và cập nhật dashboard/statistics theo status thật.

### Context bắt buộc

- Output Prompt 04, 06, 07.
- `appointment-api-1.0.md` mục 12–16.
- `patient-api-1.0.md` mục 7, 9.
- Current `MedicalRecordCreateView`, dashboard/stats views, URLs, serializers/tests.
- AC-12–19, AC-25–27, AC-36.

### Prompt triển khai

```text
Implement GET/PUT appointment medical-record và POST complete bằng clinical services, đúng snapshot semantics và error codes. Loại generic POST /medical-records/ khỏi canonical routes để không bypass IN_PROGRESS.

Sửa dashboard: đủ confirmed/waiting/inProgress/completed/cancelled, total là tổng, upcoming chỉ CONFIRMED tương lai, doctorOperations suy từ status. Không suy inProgress từ start_time <= now. Sửa stats dùng start_time và 5 status, range theo clinic timezone.

Viết API contract tests cho draft permissions, validation errors, nested collections, repeated completion, dashboard role scope và stats groupings.
```

### Tiêu chí nghiệm thu

- [ ] GET/PUT draft và POST complete đúng resource/casing/role.
- [ ] Không thể complete từ `WAITING` hoặc endpoint legacy.
- [ ] Missing clinical fields trả đúng details và giữ màn hình/state có thể tiếp tục.
- [ ] Dashboard count status thật, upcoming/doctorOperations đúng.
- [ ] Stats không còn label `PENDING` và dùng `start_time`.
- [ ] Contract tests và AC-12–19, AC-25–27, AC-36 pass.

### Bàn giao sang Prompt 09

Full backend route table, legacy routes đã gỡ, contract test report.

## Prompt 09 — Backend contract gate, PostgreSQL concurrency và regression

### Mục tiêu

Đóng backend trước khi frontend bắt đầu; kiểm tra toàn bộ AC-01–36 và migration trên PostgreSQL.

### Context bắt buộc

- Output/diff Prompt 01–08.
- Toàn bộ 5 spec/AC files và 2 API contracts 1.0.
- `appointment-flow.puml` để lập danh sách sai lệch đã chủ động loại bỏ.
- Toàn bộ backend tests, settings, URLs và migrations.

### Prompt triển khai

```text
Thực hiện backend audit chỉ theo MVP 1.0. Lập traceability test → AC-01..36, bổ sung test còn thiếu, chạy trên PostgreSQL thật. Kiểm tra migration từ legacy fixture, query count/index hợp lý cho calendar/queue/history, row locking concurrent booking/start, permissions, error envelope và canonical URL methods.

Tìm toàn repo backend các token cũ PENDING, appointment_time, direct status assignment ngoài migration/service, POST /medical-records/, cancel PATCH. Sửa mọi runtime path làm bypass lifecycle. Không thêm DoctorSchedule/availability automation.

Xuất báo cáo pass/fail ngắn; không cho frontend bắt đầu nếu còn AC đỏ hoặc contract deviation chưa được chấp thuận.
```

### Tiêu chí nghiệm thu

- [ ] Có traceability matrix automated/manual cho đủ AC-01–36; các AC backend đều xanh.
- [ ] `python manage.py check`, migration check và full tests pass trên PostgreSQL.
- [ ] Concurrent scheduled booking và concurrent start được chạy thực, không mock locking.
- [ ] `rg` không còn runtime legacy token/field/route trái contract.
- [ ] Response examples thực tế khớp hai contract: casing, ID, status, code.
- [ ] Không có uncommitted generated artifacts/database/cache do test.
- [ ] Backend route table được khóa làm context đầu vào Prompt 10.

# Giai đoạn B — Frontend

## Prompt 10 — Frontend domain types, API client và contract test foundation

### Mục tiêu

Tạo lớp chống lan truyền breaking change: type/DTO, API client, query keys, error mapping và test fixtures theo contract 1.0.

### Context bắt buộc

- Output Prompt 09 và hai API contracts 1.0.
- `apps/frontend/package.json`, `src/store.ts`, `src/lib/authFetch.ts`, `src/App.tsx`.
- Các page hiện tại và kết quả `rg` cho `PENDING|appointment_time|appointmentTime|/medical-records`.
- Backend route table/sample response đã khóa.

### Prompt triển khai

```text
Refactor frontend để mọi page dùng một domain/API layer typed theo contract 1.0. Tạo types Appointment/Patient/MedicalRecord/status/type và endpoint functions; chuẩn hóa ApiSuccess/ApiError; map role backend/frontend ở một chỗ; parse/display ISO datetime theo clinic timezone mà không đổi giá trị gửi lên.

Loại khai báo DTO trùng trong pages và token cũ PENDING/appointment_time. Tạo query key/invalidation strategy cho appointments, queue, active, patients, history, dashboard. Thêm unit tests cho resource parsing, error mapping, date range và action invalidation. Chưa xây UI mới trong prompt này.
```

### Tiêu chí nghiệm thu

- [ ] Không page nào tự hardcode URL/action mới; gọi qua API layer.
- [ ] TypeScript union chỉ có 5 status và 2 appointment types.
- [ ] Không còn type/runtime frontend dùng `PENDING` hoặc `appointment_time`.
- [ ] Error code quan trọng có message/action mapping, vẫn hiển thị server fallback.
- [ ] Auth role mapping rõ, route guard dùng cùng nguồn.
- [ ] Unit tests, lint và build pass.

### Bàn giao sang Prompt 11

Public hooks/functions, query keys, types và mock fixtures chuẩn.

## Prompt 11 — Patient UI và medical history read-only

### Mục tiêu

Nâng Patients page theo Patient API 1.0 và tạo patient selector tái sử dụng cho hai luồng intake.

### Context bắt buộc

- Output Prompt 05, 10.
- `patient-api-1.0.md`.
- `src/pages/Patients.tsx`, `MedicalRecords.tsx`, CSS liên quan.
- Existing layout/form/toast patterns.

### Prompt triển khai

```text
Refactor Patients page dùng typed API: list/search, create, detail, PATCH update, duplicate-phone conflict và role-based actions. Tạo PatientSelector reusable có debounce, keyboard navigation, loading/empty/error state để Prompt 12/13 dùng.

Doctor xem finalized history read-only theo nested clinical resource; draft không xuất hiện. Không giữ chức năng tạo bệnh án trực tiếp từ danh sách appointment cũ. Bảo toàn visual language hiện tại và bổ sung accessible labels/focus/modal behavior.
```

### Tiêu chí nghiệm thu

- [ ] Search empty/result/error và create/update/detail hoạt động đúng contract.
- [ ] UI không gửi field immutable; duplicate phone dẫn người dùng về hồ sơ hiện có.
- [ ] PatientSelector chọn đúng integer ID và không submit text chưa chọn.
- [ ] Doctor history đúng sort, nested items/orders, empty state; role khác bị guard.
- [ ] Không UI nào gọi `POST /api/medical-records/`.
- [ ] Tests cho reducer/form/API integration; lint/build pass.

### Bàn giao sang Prompt 12

PatientSelector API và patient/history routes hoàn chỉnh.

## Prompt 12 — Scheduled calendar, create/edit/cancel/check-in UI

### Mục tiêu

Xây receptionist calendar/list cho scheduled appointments, doctor filter và business actions trước consultation.

### Context bắt buộc

- Output Prompt 06, 07, 10, 11.
- `calendar-scheduling-spec.md` và `appointment-api-1.0.md` mục 2–8.
- AC-02, AC-04–08, AC-20, AC-22, AC-28–32.
- `src/pages/Appointments.tsx`, styles, doctor user endpoint/client.

### Prompt triển khai

```text
Refactor Appointments page thành scheduled calendar/list hỗ trợ date, single/multi doctor filter. Empty period click chỉ mở form và prefill doctor/start/end +30 phút; không gọi create trước submit. Form bắt buộc patient, doctor, reason, period hợp lệ và hiển thị xác nhận thủ công doctor availability với wording không cam kết availability.

Create trả CONFIRMED. Chỉ CONFIRMED hiện edit planned time/doctor và check-in/cancel. Edit rerender server result; cancel modal bắt buộc reason; check-in gọi action endpoint. SCHEDULE_CONFLICT giữ form, hiển thị conflict và cho điều chỉnh; không tự khẳng định/gợi ý slot là doctor available. Không drag resize, auto-shift, actual-duration resizing.
```

### Tiêu chí nghiệm thu

- [ ] Calendar selection đạt AC-08; default duration đạt AC-04.
- [ ] Doctor filter không tạo một cột cố định cho mọi doctor.
- [ ] Create/edit conflict hiển thị đúng và không mất input.
- [ ] Chỉ `CONFIRMED` có edit; status khác UI không expose action sai.
- [ ] Cancel không submit reason trắng; cancelled slot không còn block sau refresh.
- [ ] Planned block không đổi do actual timestamps.
- [ ] UI tests cho action visibility/form/error; lint/build pass.

### Bàn giao sang Prompt 13

Calendar state/actions, reusable appointment card/status badge và invalidation behavior.

## Prompt 13 — Walk-in intake, check-in và receptionist operations

### Mục tiêu

Hoàn thiện luồng khách vãng lai và tổng quan vận hành theo status thật.

### Context bắt buộc

- Output Prompt 07, 08, 10–12.
- `consultation-workflow-spec.md` mục 2–6, 12, 15.3, 16.
- `appointment-api-1.0.md` mục 5, 7–9, 15.
- AC-03, AC-09–12, AC-20–22, AC-30, AC-33.
- Current dashboard/receptionist pages và shared components.

### Prompt triển khai

```text
Thêm Walk-in intake cho receptionist: tìm/chọn hoặc chuyển sang tạo patient, chọn doctor, reason, manual availability confirmation, submit canonical walk-in endpoint. Không cho nhập start/end; server result phải WAITING với planned period 30 phút. Nhiều walk-in cùng doctor phải hiển thị được trong queue.

Tạo receptionist operational overview từ dashboard doctorOperations: current IN_PROGRESS patient và WAITING count theo doctor. Scheduled check-in và cancel waiting dùng action API; repeated check-in xử lý idempotent không toast lỗi. Không tính trạng thái từ thời gian calendar.
```

### Tiêu chí nghiệm thu

- [ ] Walk-in success đạt AC-03/33, xuất hiện queue sau refresh.
- [ ] Không UI check doctor shift/leave hoặc gọi availability API không tồn tại.
- [ ] Hai walk-in cùng doctor không bị client-side slot blocking.
- [ ] Repeated check-in không làm UX báo failure/duplicate.
- [ ] Overview dùng `IN_PROGRESS` và `WAITING`, không dùng `startTime <= now`.
- [ ] Cancel waiting yêu cầu reason và item rời queue/overview.
- [ ] Tests, lint, build pass.

### Bàn giao sang Prompt 14

Reception flow, operational badges/cards và queue invalidation events.

## Prompt 14 — Doctor waiting queue và single-active navigation

### Mục tiêu

Cho doctor xem đúng queue, start consultation và luôn quay lại active consultation hiện có.

### Context bắt buộc

- Output Prompt 07, 10, 13.
- `consultation-workflow-spec.md` mục 6–8, 15.1–15.2.
- `appointment-api-1.0.md` mục 9–11.
- AC-12–15.
- `src/App.tsx`, Sidebar/MainLayout, doctor page hiện tại.

### Prompt triển khai

```text
Tạo DoctorQueue page từ waiting-queue endpoint, checkedInAt ascending, đủ patient/reason/type. Start consultation chỉ cho item WAITING thuộc current doctor. Sau success điều hướng consultation workspace.

Khi API trả DOCTOR_HAS_ACTIVE_CONSULTATION, không mất queue state; hiển thị action “Quay lại ca đang khám” dùng activeAppointmentId. App/route guard phải gọi active endpoint khi doctor vào khu vực khám hoặc refresh để resume đúng ca. Không cho doctor nhập appointment ID tùy ý để khám người khác.
```

### Tiêu chí nghiệm thu

- [ ] Queue chỉ current doctor, order đúng AC-12.
- [ ] Start success item rời queue và active route mở đúng appointment.
- [ ] Second start hiển thị active appointment và giữ cả hai state đúng AC-14.
- [ ] Appointment doctor khác không có action và API 403 được xử lý an toàn.
- [ ] Refresh/deep link resume active consultation; không active có empty state.
- [ ] Role guard chặn receptionist/manager.
- [ ] Tests cho queue/order/start/conflict/route; lint/build pass.

### Bàn giao sang Prompt 15

Active-consultation route contract và selected appointment context.

## Prompt 15 — Consultation workspace, draft và completion

### Mục tiêu

Xây màn hình ca khám đang thực hiện: patient context, history, vital signs, clinical fields, thuốc, chỉ định, save draft và complete.

### Context bắt buộc

- Output Prompt 04, 08, 10, 11, 14.
- `consultation-workflow-spec.md` mục 7–11, 14–15.
- `django-data-model-spec.md` mục 9–11, 15.1.
- Hai API contracts: clinical draft/complete và patient history.
- AC-16–19, AC-25–27, AC-36.

### Prompt triển khai

```text
Tạo Consultation workspace chỉ cho active appointment. Hiển thị patient identity, reason/type, consultationStartedAt và finalized history read-only. Form có symptoms, diagnosis, ICD, treatment plan, notes, optional vital signs, dynamic prescription items và medical orders.

Load/resume draft; Save draft cho phép thiếu symptoms/diagnosis và gửi snapshot collections theo contract. Complete gửi snapshot cuối, client validate tối thiểu symptoms/diagnosis nhưng vẫn render server details theo field. Chống double-submit. Success chỉ điều hướng sau response atomic, invalidate active/queue/dashboard/history. Failure giữ toàn bộ input và ở lại màn hình. Record finalized là read-only.
```

### Tiêu chí nghiệm thu

- [ ] Draft save/reload giữ đúng fields/items/orders.
- [ ] Optional vital fields nhận blank mà không ép `0`/NaN.
- [ ] Complete thiếu field focus/hiển thị từng lỗi, appointment vẫn active.
- [ ] Complete success rời active, history có record mới, planned period UI không đổi.
- [ ] Repeated click/request không tạo duplicate; `ALREADY_COMPLETED` chuyển sang read-only/result an toàn.
- [ ] Không expose cancel/back-to-WAITING từ active consultation.
- [ ] Component/API tests, lint, build pass.

### Bàn giao sang Prompt 16

Full consultation happy/error paths và cache invalidation list.

## Prompt 16 — Dashboard, end-to-end regression và release gate

### Mục tiêu

Hoàn thiện dashboard/status presentation và nghiệm thu xuyên suốt từ receptionist đến doctor.

### Context bắt buộc

- Toàn bộ output Prompt 01–15.
- `acceptance-criteria.md` toàn bộ.
- Hai API contracts 1.0 và current route table.
- `appointment-flow.puml` chỉ để xác nhận hai đoạn cũ đã bị thay: work-schedule validation và missing start.
- `src/pages/Dashboard.tsx`, route/sidebar/styles, full backend/frontend tests.

### Prompt triển khai

```text
Sửa dashboard và mọi status badge/filter để dùng 5 status thật, upcoming CONFIRMED và doctorOperations. Sau đó chạy release audit toàn hệ thống theo hai journey:

1) Scheduled: find/create patient → calendar prefill → CONFIRMED → edit/no-conflict → check-in → WAITING → doctor start → IN_PROGRESS → save draft → complete → COMPLETED/history.
2) Walk-in: find/create patient → create WALK_IN/WAITING → queue → start → complete; cùng doctor có thể có nhiều waiting nhưng chỉ một active.

Chạy cả cancel CONFIRMED/WAITING, overlap/concurrency, active conflict, missing clinical fields, terminal actions và permission matrix. Tạo traceability report AC-01..36 với automated test hoặc manual evidence. Sửa regression trong scope; không thêm out-of-scope schedule/leave/auto slot/auto shifting.
```

### Tiêu chí nghiệm thu

- [ ] Dashboard không còn pending hoặc in-progress suy theo thời gian.
- [ ] Hai journey E2E hoàn thành bằng API thật và UI build production.
- [ ] Cancel/check-in/start/complete action visibility nhất quán giữa UI và API permissions.
- [ ] Toàn bộ AC-01–36 có evidence pass; không có mục “assumed pass”.
- [ ] Backend check/migration/full test PostgreSQL pass.
- [ ] Frontend test/lint/build pass.
- [ ] `rg` toàn repo runtime không còn `PENDING`, `appointment_time`, endpoint completion cũ hoặc direct generic status mutation (ngoại trừ migration/docs lịch sử được ghi rõ).
- [ ] Không triển khai bất kỳ MVP exclusion nào.
- [ ] Release note liệt kê breaking routes/payload và thứ tự deploy backend trước frontend.

## 6. Definition of Done chung

MVP chỉ được coi là hoàn tất khi:

1. Backend và frontend cùng chạy contract 1.0; không có compatibility “nửa cũ nửa mới”.
2. Migration legacy được thử trên bản sao dữ liệu và có backup/rollback procedure.
3. Concurrency tests chạy trên PostgreSQL, không dùng SQLite để kết luận AC-07/AC-14.
4. Mọi status transition chỉ đi qua service + action endpoint, atomic và có history.
5. Calendar không hứa doctor availability và không điều chỉnh planned block theo actual duration.
6. `WALK_IN` không chiếm scheduled calendar slot nhưng vẫn có planned timestamps cho báo cáo.
7. UI xử lý loading, empty, validation, conflict, forbidden và retry an toàn; không chỉ có happy path.
8. Có traceability cuối cùng từ AC-01–36 đến test/evidence và file triển khai.

## 7. Các hạng mục ngoài scope cần từ chối trong mọi prompt

```text
DoctorSchedule / DoctorScheduleException
doctor shift/leave validation
automatic availability calculation hoặc slot generation
drag-to-resize và auto-reschedule
auto reopen thời gian khám xong sớm
auto extend block khi khám trễ
delay/wait-time prediction
online patient self-booking
inventory, billing, lab/imaging result workflow
cancel/rollback từ IN_PROGRESS
nhiều IN_PROGRESS đồng thời cho một doctor
```
