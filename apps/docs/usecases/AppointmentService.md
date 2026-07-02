# AppointmentService

## UC_APPT_01: Create a New Appointment

### Goal
Create a medical appointment for a patient.

### Actor
Receptionist

### Permission
Receptionist role

### Preconditions
- The receptionist is logged in.
- The patient record exists (valid `patientId`).

### Inputs
- `patientId` (string, required)
- `doctorId` (strin
---

Sau đây là toàn bộ contract cho **Bước 1.1, 1.2, 1.3**.

---

## BƯỚC 1.1 – AUTH

---

### ENDPOINT 01: Đăng nhập (Login)

### Tổng quan
- **Mục đích**: Xác thực danh tính, cấp JWT token + thông tin user + role
- **Actor**: Guest (chưa đăng nhập)
- **Use-case**: UC_AUTH_01

### Request
- **Method**: `POST`
- **URL**: `/api/auth/login/`
- **Auth**: Không
- **Headers**:g, required)
- `appointmentTime` (datetime, required)
- `reason` (string, optional)

### Validation Rules
- `patientId` and `doctorId` must be provided.
- `appointmentTime` must be in the future (not past).

### Business Rules
- New appointment status defaults to `"Pending"`.
- `creatorId` is set to the receptionist's user ID.
- Timestamps (`createdAt`, `updatedAt`) are recorded.

### Main Flow
1. Receptionist enters/selects: `patientId`, `doctorId`, `appointmentTime`, `reason`.
2. System validates inputs.
3. System creates a new record in the `Appointments` table.
4. System returns success message and appointment information.

### Alternative Flows
- *(None specified)*

### Error Cases
- **Missing required fields**: Display "Request complete information" error.
- **Past appointment time**: Display "Invalid time" error.

### Database Changes
- Insert new record into `Appointments`:
  - `id` (auto-generated), `patientId`, `doctorId`, `appointmentTime`, `reason`, `status` = `"Pending"`, `creatorId`, `createdAt`, `updatedAt`.

### Events
- *(None specified)*

### Response
- Success message with appointment details (e.g., `appointmentId`, status).

### Postconditions
- A new record is added to the `Appointments` table.

---

## UC_APPT_02: Update / Cancel an Appointment

### Goal
Modify appointment time, reassign doctor, or cancel an appointment.

### Actor
Receptionist

### Permission
Receptionist role

### Preconditions
- Receptionist is logged in.
- The appointment (`Appointments.id`) exists.

### Inputs
- `appointmentId` (string, required)
- For update: `appointmentTime` (datetime, optional), `doctorId` (string, optional), `reason` (string, optional)
- For cancel: action flag (`cancel`)

### Validation Rules
- Appointment status must not be `"Completed"`.

### Business Rules
- Update case: Only provided fields are modified.
- Cancel case: Status is changed to `"Cancelled"`.
- `updatedAt` timestamp is always updated.

### Main Flow
1. Receptionist searches for and selects the appointment.
2. **Update case**: Edits fields and clicks Save.
3. **Cancel case**: Selects "Cancel Appointment" → system displays confirmation warning.
4. Receptionist confirms.
5. System updates the record (modifies fields or sets status to `"Cancelled"`).
6. System displays success notification.

### Alternative Flows
- *(None specified)*

### Error Cases
- **Appointment already `"Completed"`**: Display error "Updates and cancellations are not allowed."

### Database Changes
- Update existing `Appointments` record:
  - If update: set `appointmentTime`, `doctorId`, `reason`, `updatedAt`.
  - If cancel: set `status = "Cancelled"`, `updatedAt`.

### Events
- *(None specified)*

### Response
- Success notification.

### Postconditions
- The appointment record is updated or its status is changed.

---

## UC_APPT_03: View Today's Appointments

### Goal
Display all patients with appointments scheduled for the current day.

### Actors
- Receptionist
- Doctor

### Permission
Receptionist or Doctor role

### Preconditions
- The actor is logged in.

### Inputs
- None (system uses current date)

### Validation Rules
- *(None)*

### Business Rules
- Query uses current system date.
- Appointment time must fall within the current day.

### Main Flow
1. Actor opens the "Today's Appointments" screen.
2. System retrieves current date and queries `Appointments` where `appointmentTime` is within today.
3. System returns the list along with corresponding statuses.

### Alternative Flows
- **No data found**: Display "No appointments scheduled for today."

### Error Cases
- *(None specified)*

### Database Changes
- None (read-only)

### Events
- *(None specified)*

### Response
- List of appointments (each with `patientId`, `doctorId`, `appointmentTime`, `reason`, `status`).

### Postconditions
- *(None)*

---

## UC_APPT_04: Filter Appointments by Doctor

### Goal
View appointments assigned to a specific doctor.

### Actors
- Doctor
- Receptionist
- Manager

### Permission
- Doctor: own role
- Receptionist/Manager: appropriate role

### Preconditions
- The actor is logged in.

### Inputs
- For doctor: none (uses own ID from token)
- For receptionist/manager: `doctorId` (selected from dropdown)

### Validation Rules
- `doctorId` must correspond to an existing doctor.

### Business Rules
- Doctors automatically filter by their own ID (from Auth token).
- Receptionists and managers select a specific `doctorId` from a dropdown.

### Main Flow
1. Actor opens the appointment list.
2. Actor selects "My Appointments" filter (doctor) or chooses a doctor from dropdown (receptionist/manager).
3. System sets `doctorId` as the query condition.
4. System returns all appointments matching the `doctorId`.

### Alternative Flows
- Receptionist/Manager uses dropdown to pick a `doctorId` instead of auto.

### Error Cases
- Invalid or non‑existent `doctorId`: *(not specified in original, but validation could apply)*

### Database Changes
- None (read-only)

### Events
- *(None specified)*

### Response
- List of appointments matching the filter.

### Postconditions
- *(None)*

---

## UC_APPT_05: View Appointment Statistics

### Goal
View reports on appointment counts by status, doctor, or time period.

### Actor
Manager (Admin)

### Permission
Manager role

### Preconditions
- The logged-in account has Manager privileges.

### Inputs
- `startDate` (date, required)
- `endDate` (date, required)
- `groupBy` (enum: `status`, `doctorId`, or time‑based grouping)

### Validation Rules
- `endDate` must not be earlier than `startDate`.

### Business Rules
- Data is aggregated from the `Appointments` table using `COUNT` and `GROUP BY`.
- Aggregation respects the time range (`appointmentTime` between `startDate` and `endDate`).

### Main Flow
1. Manager selects a reporting period (e.g., this month) → system sets `startDate` and `endDate`.
2. System aggregates appointment counts grouped by the chosen dimension.
3. System displays results as statistics and charts.

### Alternative Flows
- *(None specified)*

### Error Cases
- **Invalid date range** (`endDate < startDate`): Display "Invalid date range" error.

### Database Changes
- None (read-only aggregate query)

### Events
- *(None specified)*

### Response
- Aggregated statistics (counts per group) and optional chart data.

### Postconditions
- *(None)*