# Calendar Scheduling Specification

## 1. Scope

This specification defines scheduled appointment creation, slot validation, calendar behavior, and planned-time handling for Clinic Management System MVP 1.0.

## 2. Calendar Responsibility

The calendar represents planned appointments.

The calendar shall support:

- Viewing scheduled appointments by date.
- Viewing appointments by doctor.
- Viewing periods that do not contain another stored appointment.
- Creating scheduled appointments.
- Editing scheduled appointments before check-in.
- Cancelling scheduled appointments.
- Checking in a scheduled patient.

The calendar shall not model real-time consultation duration.

## 3. Planned Time Fields

Each scheduled appointment must contain:

```text
start_time
end_time
```

Validation rule:

```text
end_time > start_time
```

## 4. Default Duration

Default scheduled appointment duration:

```text
30 minutes
```

The default duration is used when the receptionist does not select another supported duration.

## 5. Planned Time vs Actual Time

Planned appointment time:

```text
start_time
end_time
```

Actual operational timestamps:

```text
checked_in_at
consultation_started_at
completed_at
```

Actual operational timestamps must not modify `start_time` or `end_time`.

## 6. Early Completion Rule

When a consultation finishes before `end_time`:

- The scheduled appointment block remains unchanged.
- The unused scheduled period is not reopened automatically.
- No new bookable slot is created automatically.
- Subsequent scheduled appointments are not moved.

## 7. Late Completion Rule

When a consultation finishes after `end_time`:

- The scheduled appointment block remains unchanged.
- The appointment block is not extended automatically.
- Subsequent scheduled appointments are not moved.
- Waiting patients remain in the operational queue.
- Staff handle operational delays manually.

## 8. Slot Conflict Rule

Two active scheduled appointments for the same doctor must not overlap.

Overlap condition:

```text
existing.start_time < new.end_time
AND
existing.end_time > new.start_time
```

Statuses that occupy a scheduled period:

```text
CONFIRMED
WAITING
IN_PROGRESS
COMPLETED
```

`CANCELLED` appointments do not occupy a scheduled period.

The overlap check must run immediately before persistence.

## 9. Concurrent Booking Rule

When two users attempt to reserve an overlapping period:

- At most one appointment may be created.
- The losing request must receive a conflict response.
- The appointment creation operation must execute transactionally.
- A visually empty period is not authoritative until the backend confirms that no overlapping appointment exists.

## 10. Appointment Creation Entry Points

### 10.1 Create Appointment Button

The receptionist opens the appointment form and selects:

```text
patient
doctor
date
start_time
duration or end_time
reason
```

### 10.2 Calendar Selection

Selecting an empty calendar period must:

1. Open the appointment form.
2. Pre-fill doctor, date, start time, and default end time.
3. Not create an appointment before form submission.
4. Run backend overlap validation on submission.

## 11. Calendar Interaction Rules

MVP 1.0 shall not include:

- Drag-to-resize appointment duration.
- Automatic calendar expansion based on actual consultation duration.
- Automatic shifting of later appointments.
- Automatic reopening of unused time.
- Real-time delay prediction.
- Automatic expected waiting-time calculation.

## 12. Doctor Display Strategy

The default calendar view must not require one permanent column per doctor.

The UI shall support doctor filtering.

Recommended views:

| View | Usage |
|---|---|
| Single doctor day view | Detailed schedule for one selected doctor |
| Multi-doctor filtered view | Small selected subset of doctors |
| Appointment list view | All appointments without horizontal doctor columns |

The system must allow the receptionist to select one or more doctors before rendering a multi-doctor view.

## 13. Appointment Edit Rules

Only `CONFIRMED` appointments may have planned time or assigned doctor changed.

Appointments in the following statuses must not be rescheduled through calendar drag or edit actions:

```text
WAITING
IN_PROGRESS
COMPLETED
CANCELLED
```

Every schedule edit must re-run overlap validation.

## 14. Appointment Cancellation

A `CONFIRMED` appointment may be cancelled from the calendar.

Cancellation must:

1. Require a cancellation reason.
2. Change status to `CANCELLED`.
3. Persist cancellation metadata.
4. Release the planned time for future bookings.
5. Write status history.

## 15. Doctor Availability Scope

MVP 1.0 does not persist or calculate doctor working availability.

The system does not contain:

```text
DoctorSchedule
DoctorScheduleException
doctor leave validation
doctor shift validation
automatic availability-based slot generation
```

The receptionist is responsible for confirming that the selected doctor can receive the appointment.

A visually empty calendar period means only:

```text
No overlapping appointment is currently stored for the selected doctor.
```

It does not guarantee that the doctor is working or available.

## 16. Empty-Period Suggestions

The UI may suggest periods that do not overlap existing appointments.

Such suggestions must be labeled and treated as:

```text
Periods without stored appointment conflicts
```

They must not be presented as confirmed doctor availability.

Suggested periods must still pass backend overlap validation when the receptionist submits the appointment.

## 17. Walk-in Planned Time

For a walk-in appointment:

```text
start_time = checked_in_at
end_time = start_time + 30 minutes
```

The planned period is stored for consistency and reporting.

It does not reserve or modify later appointments automatically.
