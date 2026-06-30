# PatientService

## UC_PAT_01: Search for a Patient

### Goal
Search patient records by keyword.

### Actors
- Receptionist
- Doctor

### Permission
Receptionist or Doctor role

### Preconditions
- Actor is logged in.

### Inputs
- `keyword` (string, required) – can be `patientCode`, `fullName`, or `phone`.

### Validation Rules
- *(None specified)*

### Business Rules
- Search performs a query on `Patients` table matching the keyword against the relevant fields.

### Main Flow
1. Actor enters a search keyword.
2. System queries `Patients` for matching records.
3. System returns a list of matching patients with basic information.

### Alternative Flows
- **No matches**: Display "Patient record not found."

### Error Cases
- *(None specified)*

### Database Changes
- None (read-only)

### Events
- *(None specified)*

### Response
- List of patients (each with `patientId`, `patientCode`, `fullName`, `phone`, etc.).

### Postconditions
- *(None)*

---

## UC_PAT_02: Create a New Patient Record

### Goal
Create a patient record for a first-time visitor.

### Actor
Receptionist

### Permission
Receptionist role

### Preconditions
- Receptionist is logged in.

### Inputs
- `fullName` (string, required)
- `dob` (date, required)
- `gender` (string, required)
- `phone` (string, required)
- `address` (string, optional)

### Validation Rules
- Phone number must match expected format.
- Required fields must be present.

### Business Rules
- System auto-generates a unique `patientCode`.
- Duplicate phone number triggers a warning (see Exception Flow).

### Main Flow
1. Receptionist enters required information.
2. System validates input data (e.g., phone format).
3. System auto-generates unique `patientCode`.
4. System saves new record in `Patients` table.
5. System returns success notification with new ID and Patient Code.

### Alternative Flows
- **Duplicate phone**: System warns: "This phone number may belong to an existing patient. Please verify."

### Error Cases
- *(None specified)*

### Database Changes
- Insert new record into `Patients`:
  - `id` (auto-generated), `patientCode`, `fullName`, `dob`, `gender`, `phone`, `address`, `createdAt`, `updatedAt`.

### Events
- *(None specified)*

### Response
- Success notification with `patientId` and `patientCode`.

### Postconditions
- A new patient record is created in the system.

---

## UC_PAT_03: Update Administrative Information

### Goal
Modify patient's personal information.

### Actor
Receptionist

### Permission
Receptionist role

### Preconditions
- Receptionist is logged in.
- Patient exists (`Patients.id`).

### Inputs
- `patientId` (string, required)
- Updated fields: `fullName` (string, optional), `phone` (string, optional), `address` (string, optional), etc.

### Validation Rules
- Basic format validation (e.g., phone).

### Business Rules
- Only provided fields are updated.
- `updatedAt` timestamp is refreshed.

### Main Flow
1. Receptionist searches and opens patient profile update screen.
2. Receptionist edits fields and clicks Save.
3. System validates input.
4. System updates record in `Patients` table and sets `updatedAt`.
5. System displays success notification.

### Alternative Flows
- *(None specified)*

### Error Cases
- *(None specified)*

### Database Changes
- Update specified columns in `Patients` for the given `patientId`.

### Events
- *(None specified)*

### Response
- Success notification.

### Postconditions
- Patient record is updated with new information.

---

## UC_PAT_04: View Medical History / Medical Records

### Goal
Doctor reviews previous visits and medical records for a patient.

### Actor
Doctor

### Permission
Doctor role

### Preconditions
- Doctor is logged in.
- Patient exists.

### Inputs
- `patientId` (string, required)

### Validation Rules
- *(None)*

### Business Rules
- Records are retrieved via `MedicalRecords` table linked through `appointmentId` to `Appointments`.
- Results are ordered by date descending (newest first).
- Displayed fields: `symptoms`, `diagnosis`, `notes`.

### Main Flow
1. Doctor opens a patient's profile (after search).
2. System retrieves all previous visits by patient ID (joining through `Appointments`).
3. System returns history list in reverse chronological order.

### Alternative Flows
- **No history**: Display "No medical history available."

### Error Cases
- *(None specified)*

### Database Changes
- None (read-only)

### Events
- *(None specified)*

### Response
- List of medical records (each with `visitDate`, `symptoms`, `diagnosis`, `notes`).

### Postconditions
- *(None)*

---

## UC_PAT_05: Record Medical Examination (Diagnosis)

### Goal
Doctor enters symptoms, diagnosis, and treatment notes after an examination.

### Actor
Doctor

### Permission
Doctor role

### Preconditions
- Doctor is logged in.
- Appointment (`Appointments.id`) exists and is valid.

### Inputs
- `appointmentId` (string, required)
- `symptoms` (string, required)
- `diagnosis` (string, required)
- `notes` (string, optional)

### Validation Rules
- Required fields must be present.
- Medical record must not already exist for this appointment.

### Business Rules
- A new record is created in `MedicalRecords` linked by `appointmentId`.
- Optionally, an event is sent to Appointment Service to change appointment status to `"Completed"`.

### Main Flow
1. Doctor selects an ongoing appointment.
2. Doctor enters examination details.
3. Doctor clicks Save.
4. System validates data and checks for duplicate record.
5. System creates new record in `MedicalRecords`.
6. (Optional) Event triggers appointment status update to `"Completed"`.
7. System displays success notification.

### Alternative Flows
- **Medical record already exists**: Display error or redirect to update screen instead of creating new.

### Error Cases
- *(None specified)*

### Database Changes
- Insert new record into `MedicalRecords`:
  - `id` (auto-generated), `appointmentId`, `symptoms`, `diagnosis`, `notes`, `createdAt`.

### Events
- (Optional) Event: `appointment.completed` (if implemented).

### Response
- Success notification.

### Postconditions
- A medical record is created for the appointment.
- (Optional) The appointment status is changed to `"Completed"`.