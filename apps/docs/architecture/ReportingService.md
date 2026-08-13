# Reporting Service Boundary and Core Snapshot API

## Implemented architecture

Phase 1 introduces Reporting as an independent backend deployment while
retaining the existing Django application as Clinic Core.

```text
Clinic Core (`apps/backend`)          Reporting (`apps/reporting_service`)
        |                                      |
        v                                      v
 clinic-core-db                         reporting-db
 postgres_clinic_db volume              reporting_data volume
```

Reporting owns its Python project, dependency manifest, Dockerfiles, process
entrypoints, URL configuration, migrations namespace, tests, database
credentials, and persistent volume. It does not import Clinic Core models or
connect to Clinic Core's database.

## Phase 1 API

```http
GET http://localhost:8001/health/
```

```json
{
  "status": "healthy",
  "service": "reporting-service"
}
```

The health response proves that the Reporting HTTP process is available. It is
deliberately independent of Clinic Core and does not query either database.

## Deferred to the next phase

- Clinic Core internal reporting snapshot API
- Service-token validation
- HTTP synchronization from Reporting to Clinic Core
- Reporting-owned read models and migrations
- Manager dashboard report endpoints
- nginx routing for `/api/reports/`

Deferring these behaviors keeps Phase 1 limited to establishing and testing
the deployment and data-ownership boundary.

## Phase 2: Clinic Core snapshot API

Clinic Core now exposes a private, read-only endpoint to the Reporting Service:

```http
GET /api/internal/reporting/snapshot/?dateFrom=2026-08-01&dateTo=2026-08-13
X-Service-Token: <shared-service-credential>
```

The request travels directly from `reporting-service` to
`http://clinic-core:8000` on the Compose network. nginx returns `404` for
`/api/internal/`, preventing browser and external gateway access.

Clinic Core authenticates the token with a constant-time comparison, validates
an inclusive ISO date range of at most 366 days, and calls read-only selectors.
The response contains only:

- appointment counts by date and status;
- appointment counts by date and doctor identifier;
- employee counts by role and account state;
- department and room counts;
- snapshot generation time and requested period.

Patient names, staff names, phone numbers, addresses, diagnoses, prescriptions,
appointment reasons, and other clinical or personal data are excluded.

## Deferred after Phase 2

- HTTP synchronization client inside Reporting Service
- Synchronization run history and retry behavior
- Manager dashboard report endpoints
- public nginx routing for `/api/reports/`

## Phase 3: Reporting-owned database

Reporting now owns four tables in `reporting_db`:

```text
SynchronizationRun
  id, status, started_at, finished_at,
  date_from, date_to, error_message

DailyAppointmentStatistic
  date, total, pending, confirmed, waiting,
  in_progress, completed, cancelled, synchronized_at

DailyDoctorStatistic
  date, doctor_id, total, completed, cancelled, synchronized_at

SystemSummary
  snapshot_date, employee_total, active_employees, locked_employees,
  doctor_total, receptionist_total, manager_total,
  department_total, room_total, synchronized_at
```

The schema enforces unique daily records, a unique `(date, doctor_id)` pair,
valid synchronization date ranges, reconciled appointment status totals, and
non-negative counters. `doctor_id` is stored as an ordinary positive integer;
it is deliberately not a foreign key because the doctor entity belongs to
Clinic Core.

An automated architecture test parses imports across the Reporting source tree
and fails if it finds `auth_service`, `appointment_service`, `patient_service`,
`organization_service`, or `medical_records`. This provides repeatable evidence
that Reporting is independent from Clinic Core's ORM and source modules.

## Deferred after Phase 3

- fetch the snapshot from Clinic Core over HTTP;
- atomically upsert Reporting read models;
- mark synchronization runs as successful or failed;
- retry and idempotency behavior;
- Manager dashboard report endpoints;
- public nginx routing for `/api/reports/`.
