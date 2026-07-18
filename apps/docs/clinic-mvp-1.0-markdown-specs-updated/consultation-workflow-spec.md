# Consultation Workflow Specification

## 1. Scope

This specification defines patient check-in, waiting queue behavior, doctor consultation start, medical record handling, and consultation completion for Clinic Management System MVP 1.0.

## 2. Actors

| Actor | Responsibilities |
|---|---|
| Receptionist | Check in scheduled patients, create walk-in visits, cancel waiting appointments |
| Doctor | View assigned queue, start consultation, maintain medical record, complete consultation |
| System | Validate transitions, persist timestamps, enforce single active consultation per doctor |

## 3. Scheduled Patient Workflow

```text
Create scheduled appointment
→ CONFIRMED
→ Receptionist checks patient in
→ WAITING
→ Doctor starts consultation
→ IN_PROGRESS
→ Doctor completes consultation
→ COMPLETED
```

## 4. Walk-in Patient Workflow

```text
Receptionist creates walk-in appointment
→ start_time = checked_in_at
→ end_time = start_time + 30 minutes
→ WAITING
→ Doctor starts consultation
→ IN_PROGRESS
→ Doctor completes consultation
→ COMPLETED
```

## 5. Check-in Workflow

Preconditions:

```text
appointment.status = CONFIRMED
patient is present
actor has receptionist permission
```

On success:

```text
status = WAITING
checked_in_at = current timestamp
checked_in_by = current user
```

The appointment must appear in the assigned doctor's waiting queue.

Repeated check-in must not create duplicate queue entries or replace the original check-in timestamp.

## 6. Waiting Queue

The waiting queue contains appointments with:

```text
status = WAITING
```

Default ordering:

```text
checked_in_at ascending
```

Each queue item must expose at least:

```text
appointment_id
patient identity
checked_in_at
reason
appointment type
assigned doctor
```

An appointment must leave the waiting queue when its status becomes:

```text
IN_PROGRESS
CANCELLED
```

## 7. Start Consultation Workflow

Preconditions:

```text
appointment.status = WAITING
appointment.doctor_id = current doctor id
current doctor has no other IN_PROGRESS appointment
```

On success:

```text
status = IN_PROGRESS
consultation_started_at = current timestamp
consultation_started_by = current doctor
```

The system must:

1. Remove the appointment from the waiting queue.
2. Expose it as the doctor's active consultation.
3. Open or resume the associated medical record.
4. Write status history.

## 8. Single Active Consultation Rule

A doctor may have only one `IN_PROGRESS` appointment.

If a doctor attempts to start another appointment:

- The requested appointment remains `WAITING`.
- The current active consultation remains unchanged.
- The system returns the current active appointment identifier.
- The UI provides an action to return to the active consultation.

## 9. Medical Record Lifecycle

A medical record is associated one-to-one with an appointment.

The medical record also stores direct `patient` and `doctor` references.

Required consistency rules:

```text
medical_record.patient_id = appointment.patient_id
medical_record.doctor_id = appointment.doctor_id
```

The record may be created or updated while:

```text
appointment.status = IN_PROGRESS
```

The system may support draft saving.

Completing a consultation requires all mandatory medical record fields to be valid.

Minimum required completion fields for MVP 1.0:

```text
symptoms
diagnosis
```

Additional fields may remain optional unless separately configured.

## 10. Complete Consultation Workflow

Preconditions:

```text
appointment.status = IN_PROGRESS
appointment.doctor_id = current doctor id
medical record is valid
```

On success:

```text
appointment.status = COMPLETED
appointment.completed_at = current timestamp
medical record finalized = true
medical record finalized_at = current timestamp
medical record finalized_by = current doctor
```

The operation must atomically:

1. Save the medical record.
2. Save prescription items.
3. Save medical orders.
4. Finalize the medical record.
5. Mark the appointment `COMPLETED`.
6. Write status history.

## 11. Completion Validation Failure

When mandatory medical record data is missing:

- Appointment remains `IN_PROGRESS`.
- Medical record is not finalized.
- `completed_at` is not set.
- Validation errors identify the missing fields.
- The doctor remains on the consultation screen.

## 12. Cancellation Before Consultation

The receptionist may cancel an appointment in:

```text
CONFIRMED
WAITING
```

For a `WAITING` appointment:

- The appointment is removed from the waiting queue.
- Cancellation reason is mandatory.
- Cancellation metadata is persisted.

## 13. Cancellation During Consultation

MVP 1.0 does not support cancellation or rollback from:

```text
IN_PROGRESS
```

No transition from `IN_PROGRESS` to `WAITING` or `CANCELLED` shall be exposed.

## 14. Operational Time Handling

The system records:

```text
checked_in_at
consultation_started_at
completed_at
```

These timestamps are used for audit and reporting only.

They must not:

- Modify the planned appointment period.
- Shift later appointments.
- Reopen unused scheduled time.
- Extend calendar blocks automatically.

## 15. UI State Requirements

### 15.1 Doctor Waiting Queue

Required action:

```text
Start consultation
```

The action is enabled only for `WAITING` appointments assigned to the current doctor.

### 15.2 Active Consultation

The doctor interface must expose:

```text
active patient
consultation started time
medical record form
save draft action
complete consultation action
```

### 15.3 Receptionist Overview

For each doctor, the receptionist interface may expose:

```text
current IN_PROGRESS patient
count of WAITING patients
```

The UI must derive these values from appointment statuses, not from calendar block duration.


## 16. Doctor Availability Boundary

The consultation workflow does not validate doctor shifts, leave, or working schedules.

MVP 1.0 does not contain:

```text
DoctorSchedule
DoctorScheduleException
```

Before creating or assigning an appointment, the receptionist manually confirms that the doctor can receive the patient.

Consultation state transitions remain controlled by appointment status and assigned-doctor validation.
