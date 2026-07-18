# Acceptance Criteria — Appointment and Consultation MVP 1.0

## AC-01 — Valid Appointment Statuses

**Given** an appointment exists  
**Then** its status must be one of:

```text
CONFIRMED
WAITING
IN_PROGRESS
COMPLETED
CANCELLED
```

## AC-02 — Scheduled Appointment Creation

**Given** the receptionist entered all required appointment data  
**And** the receptionist has manually confirmed that the doctor can receive the appointment  
**And** the requested period does not overlap another active appointment  
**When** the receptionist submits the form  
**Then** the system creates the appointment with status `CONFIRMED`  
**And** persists `start_time` and `end_time`  
**And** persists the creator and creation timestamp.

## AC-03 — Walk-in Appointment Creation

**Given** a walk-in patient is present  
**And** required patient and consultation data is complete  
**And** a doctor is selected  
**When** the receptionist selects the walk-in intake action  
**Then** the system creates an appointment with status `WAITING`  
**And** sets `checked_in_at` to the creation timestamp  
**And** sets `checked_in_by` to the receptionist  
**And** adds the appointment to the selected doctor's waiting queue.

## AC-04 — Default Scheduled Duration

**Given** the receptionist creates a scheduled appointment  
**And** no custom duration is selected  
**When** the form initializes the planned period  
**Then** `end_time` must equal `start_time + 30 minutes`.

## AC-05 — Invalid Planned Period

**Given** an appointment form contains `end_time <= start_time`  
**When** the receptionist submits the form  
**Then** the system rejects the request  
**And** no appointment is created.

## AC-06 — Overlapping Appointment

**Given** an existing non-cancelled appointment for the same doctor overlaps the requested period  
**When** the receptionist submits the new appointment  
**Then** the system rejects the request  
**And** returns a schedule conflict error  
**And** no appointment is created.

## AC-07 — Concurrent Booking

**Given** two users submit overlapping appointments for the same doctor concurrently  
**When** both requests are processed  
**Then** at most one appointment is created successfully  
**And** the other request returns a schedule conflict error.

## AC-08 — Calendar Selection

**Given** the receptionist selects an empty period in the calendar  
**When** the selection is processed  
**Then** the system opens the appointment form  
**And** pre-fills the doctor, date, start time, and default end time  
**And** does not create an appointment before form submission.

## AC-09 — Check-in Success

**Given** an appointment is `CONFIRMED`  
**And** the patient is present  
**When** the receptionist selects `Check in`  
**Then** the system changes the status to `WAITING`  
**And** persists `checked_in_at`  
**And** persists `checked_in_by`  
**And** adds the appointment to the assigned doctor's waiting queue.

## AC-10 — Repeated Check-in

**Given** an appointment is already `WAITING`  
**When** the receptionist selects `Check in` again  
**Then** the status remains `WAITING`  
**And** the original `checked_in_at` value remains unchanged  
**And** no duplicate waiting queue entry is created.

## AC-11 — Invalid Check-in Status

**Given** an appointment is not `CONFIRMED`  
**When** a check-in request is submitted  
**Then** the system rejects the request  
**And** the appointment remains unchanged.

## AC-12 — Waiting Queue Content

**Given** a doctor opens the waiting queue  
**Then** the system returns only appointments assigned to that doctor with status `WAITING`  
**And** orders them by `checked_in_at` ascending.

## AC-13 — Start Consultation Success

**Given** an appointment is `WAITING`  
**And** it is assigned to the current doctor  
**And** the doctor has no other `IN_PROGRESS` appointment  
**When** the doctor selects `Start consultation`  
**Then** the system changes the status to `IN_PROGRESS`  
**And** persists `consultation_started_at`  
**And** persists `consultation_started_by`  
**And** removes the appointment from the waiting queue  
**And** exposes it as the doctor's active consultation.

## AC-14 — Doctor Already Has Active Consultation

**Given** the doctor has an `IN_PROGRESS` appointment  
**When** the doctor attempts to start another `WAITING` appointment  
**Then** the system rejects the request  
**And** the requested appointment remains `WAITING`  
**And** the active appointment remains `IN_PROGRESS`  
**And** the response identifies the existing active appointment.

## AC-15 — Start Consultation for Another Doctor's Appointment

**Given** an appointment is assigned to a different doctor  
**When** the current doctor attempts to start it  
**Then** the system rejects the request  
**And** the appointment remains unchanged.

## AC-16 — Direct Completion from Waiting

**Given** an appointment is `WAITING`  
**When** a completion request is submitted  
**Then** the system rejects the request  
**And** instructs the caller to start the consultation first  
**And** the appointment remains `WAITING`.

## AC-17 — Complete Consultation Success

**Given** an appointment is `IN_PROGRESS`  
**And** it is assigned to the current doctor  
**And** the medical record contains all mandatory fields  
**When** the doctor selects `Complete consultation`  
**Then** the system atomically saves the medical record and related data  
**And** finalizes the medical record  
**And** changes the appointment status to `COMPLETED`  
**And** persists `completed_at`  
**And** removes the appointment from the doctor's active consultation state.

## AC-18 — Missing Medical Record Data

**Given** an appointment is `IN_PROGRESS`  
**And** at least one mandatory medical record field is missing  
**When** the doctor selects `Complete consultation`  
**Then** the system rejects completion  
**And** the appointment remains `IN_PROGRESS`  
**And** the medical record remains unfinalized  
**And** the response identifies each missing field.

## AC-19 — Repeated Completion

**Given** an appointment is `COMPLETED`  
**When** another completion request is submitted  
**Then** the system rejects the request  
**And** does not create a duplicate medical record  
**And** does not change the original completion timestamp.

## AC-20 — Cancel Confirmed Appointment

**Given** an appointment is `CONFIRMED`  
**And** a cancellation reason is provided  
**When** the receptionist confirms cancellation  
**Then** the system changes the status to `CANCELLED`  
**And** persists `cancelled_at`, `cancelled_by`, and `cancellation_reason`  
**And** releases the planned period for future booking.

## AC-21 — Cancel Waiting Appointment

**Given** an appointment is `WAITING`  
**And** a cancellation reason is provided  
**When** the receptionist confirms cancellation  
**Then** the system changes the status to `CANCELLED`  
**And** removes the appointment from the waiting queue  
**And** persists cancellation metadata.

## AC-22 — Cancellation Reason Required

**Given** an appointment is `CONFIRMED` or `WAITING`  
**When** cancellation is submitted without a reason  
**Then** the system rejects the request  
**And** the appointment remains unchanged.

## AC-23 — Cancel In-progress Appointment

**Given** an appointment is `IN_PROGRESS`  
**When** a cancellation request is submitted  
**Then** the system rejects the request  
**And** the appointment remains `IN_PROGRESS`.

## AC-24 — Terminal Status

**Given** an appointment is `COMPLETED` or `CANCELLED`  
**When** any status transition is requested  
**Then** the system rejects the request  
**And** the appointment remains unchanged.

## AC-25 — Planned Time Unchanged by Actual Duration

**Given** an appointment has planned `start_time` and `end_time`  
**When** actual consultation timestamps differ from the planned period  
**Then** the system keeps `start_time` and `end_time` unchanged.

## AC-26 — Early Completion

**Given** a consultation completes before the planned `end_time`  
**When** completion is recorded  
**Then** the system does not create a new available period from the unused time  
**And** does not move subsequent appointments.

## AC-27 — Late Completion

**Given** a consultation completes after the planned `end_time`  
**When** completion is recorded  
**Then** the system does not extend the calendar block automatically  
**And** does not move subsequent appointments.

## AC-28 — Edit Scheduled Appointment

**Given** an appointment is `CONFIRMED`  
**When** an authorized receptionist changes its doctor or planned period  
**Then** the system revalidates appointment overlap  
**And** saves the changes only when overlap validation succeeds.

## AC-29 — Edit Non-confirmed Appointment

**Given** an appointment is `WAITING`, `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`  
**When** a planned-time edit is submitted  
**Then** the system rejects the request  
**And** the appointment remains unchanged.

## AC-30 — Doctor Working Schedule Is Not System-Validated

**Given** the receptionist creates or edits a scheduled appointment  
**When** the request is processed  
**Then** the system does not validate doctor shifts, leave, or working days  
**And** the receptionist remains responsible for confirming that the doctor can receive the appointment.

## AC-31 — Empty Calendar Period Meaning

**Given** a calendar period contains no stored appointment for the selected doctor  
**When** the period is displayed as empty  
**Then** the UI may present it as a period without an appointment conflict  
**And** must not present it as guaranteed doctor availability.

## AC-32 — Empty-Period Suggestion

**Given** the UI suggests a period without an existing appointment conflict  
**When** the receptionist selects the suggestion  
**Then** the appointment form is pre-filled with the suggested period  
**And** the receptionist must still confirm doctor availability manually  
**And** the backend must re-run overlap validation at submission time.

## AC-33 — Walk-in Planned Time

**Given** a walk-in appointment is created  
**When** creation succeeds  
**Then** `start_time` equals `checked_in_at`  
**And** `end_time` equals `start_time + 30 minutes`  
**And** the appointment status is `WAITING`.

## AC-34 — Status History

**Given** a valid status transition succeeds  
**Then** the system creates one status history record containing:

```text
appointment_id
from_status
to_status
changed_by
changed_at
reason
```

`reason` is mandatory for transitions to `CANCELLED`.

## AC-35 — Generic Status Update Rejected

**Given** a caller submits a generic appointment update containing a direct `status` change  
**When** the request is processed  
**Then** the system rejects the direct status mutation  
**And** requires the corresponding business action endpoint.

## AC-36 — Transactional Transition

**Given** a status transition requires multiple database writes  
**When** any write fails  
**Then** all writes in the transition are rolled back  
**And** the appointment remains in its previous consistent state.
