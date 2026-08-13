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

## Deferred at the end of Phase 2

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

## Deferred at the end of Phase 3

- fetch the snapshot from Clinic Core over HTTP;
- atomically upsert Reporting read models;
- mark synchronization runs as successful or failed;
- retry and idempotency behavior;
- Manager dashboard report endpoints;
- public nginx routing for `/api/reports/`.

## Phase 4: Synchronous synchronization

The manual synchronization flow is now implemented:

```text
Manager
  -> POST /api/reports/synchronize/
  -> nginx routes to Reporting
  -> Reporting verifies Clinic Core JWT and MANAGER role
  -> Reporting calls Clinic Core snapshot API with X-Service-Token
  -> Clinic Core returns privacy-safe aggregates
  -> Reporting atomically upserts reporting_db
  -> SynchronizationRun becomes SUCCESS or FAILED
```

Clinic Core adds a signed `role` claim to access tokens. Both services share
only `CORE_JWT_SIGNING_KEY`; Reporting validates tokens locally and does not
query or import Clinic Core user data. Tokens remain valid until expiry, so a
role or lock change takes full effect in Reporting when the current access
token expires. Shorter access-token lifetime or token introspection is future
security hardening.

`DailyAppointmentStatistic`, `DailyDoctorStatistic`, and `SystemSummary` use
`update_or_create`, making repeated synchronization idempotent. Rows no longer
present in the authoritative snapshot are removed only inside the requested
date range. All read-model changes use one transaction; a malformed snapshot
rolls back data changes while the failed synchronization audit remains stored.

The `sync_reports --days 30` management command invokes the same service
function as the HTTP endpoint. No Celery, Redis, RabbitMQ, or Kafka dependency
is introduced.

## Deferred after Phase 4

- scheduled command execution;
- synchronization retry policy;
- manager dashboard query endpoints;
- production Compose deployment for Reporting;
- optional asymmetric JWT signing or token introspection.

## Phase 5: Manager reporting queries

Reporting now exposes manager-protected read endpoints for the manager
dashboard, daily appointment statistics, daily doctor statistics, and the most
recent synchronization attempt. Queries use only Reporting-owned tables; they
never call Clinic Core or join across databases.

The dashboard totals appointment values over the requested inclusive range.
Employee and organization totals come from the newest `SystemSummary` whose
snapshot date is not later than the requested `dateTo`. Its
`lastSynchronizedAt` value is the completion time of the latest successful
synchronization. The separate latest-synchronization endpoint returns the most
recent attempt, including a failure, so managers can distinguish stale data
from an operational synchronization problem.

Every read API uses the same infrastructure-level identity trust established
in Phase 4: Reporting verifies the signed Clinic Core access token and requires
the `MANAGER` role. Empty read models produce stable zero/empty responses, and
date ranges default to the latest 30 inclusive days with a 366-day maximum.

## Deferred after Phase 5

- scheduled synchronization and retry policy;
- production Compose deployment for Reporting;
- manager dashboard frontend integration;
- optional asymmetric JWT signing or token introspection.
