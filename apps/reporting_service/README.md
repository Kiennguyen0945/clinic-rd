# Reporting Service

Independent Django/DRF service for clinic reporting read models and dashboard
queries. It owns its database schema and never imports Clinic Core domain
models. Managers can synchronize privacy-safe aggregates from Clinic Core and
query dashboard projections without accessing Clinic Core's database.

## Ownership

- Compose service: `reporting-service`
- Database service: `reporting-db`
- Database volume: `reporting_data`
- HTTP port: `8001`
- Health endpoint: `GET /health/`

The service uses only `REPORTING_DB_*` credentials. It must not import Clinic
Core domain models or connect to the Clinic Core database.

## Database schema

| Model | Purpose | Natural uniqueness |
| --- | --- | --- |
| `SynchronizationRun` | Audit synchronization attempts and failures | Generated ID |
| `DailyAppointmentStatistic` | Appointment status totals for one date | `date` |
| `DailyDoctorStatistic` | Outcome totals for one doctor and date | `date`, `doctor_id` |
| `SystemSummary` | Employee and organization totals | `snapshot_date` |

`DailyDoctorStatistic.doctor_id` is an ordinary numeric identifier copied from
Clinic Core, not a foreign key. Reporting therefore has no cross-database ORM
relationship.

## Local test

From the repository root, using the existing development virtual environment:

```bash
cd apps/reporting_service
REPORTING_DB_ENGINE=sqlite ../../.venv/bin/python manage.py test
```

The CI job runs Ruff, Django checks, migration-drift detection, migrations, and
the complete Reporting test suite against an independent PostgreSQL service. On
pushes to `main`, it publishes `my-clinic-app-reporting:<commit-sha>` and updates
the `CURRENT_REPORTING_TAG` repository variable.

## Synchronization

Managers can trigger a synchronous snapshot refresh through nginx:

```http
POST /api/reports/synchronize/
Authorization: Bearer <clinic-core-access-token>
Content-Type: application/json

{
  "dateFrom": "2026-08-01",
  "dateTo": "2026-08-13"
}
```

Both dates are optional; the default is the latest 30-day inclusive period.
Clinic Core access tokens carry a signed `role` claim. Reporting verifies the
signature, expiry, access-token type, and `MANAGER` role locally using
`CORE_JWT_SIGNING_KEY`, without accessing Clinic Core's database.

The same workflow is available as a command:

```bash
python manage.py sync_reports --days 30
```

From the Docker development stack, invoke the image's virtual environment:

```bash
docker compose -f docker-compose.dev.yaml exec reporting-service \
  /opt/venv/bin/python manage.py sync_reports --days 30
```

Synchronization is idempotent, atomically upserts read models, deletes stale
statistics in the requested range, and records every attempt as `SUCCESS` or
`FAILED` in `SynchronizationRun`.

## Read APIs

All report endpoints require a valid Clinic Core manager access token:

```text
GET /api/reports/dashboard/manager/
GET /api/reports/appointments/
GET /api/reports/doctors/
GET /api/reports/synchronizations/latest/
```

The first three accept optional `dateFrom` and `dateTo` query parameters and
default to the latest 30-day inclusive period. An empty reporting database
returns empty lists and zero totals, allowing the manager dashboard to render
before its first synchronization.

After the Docker stack starts:

```bash
curl http://localhost:8001/health/
```
