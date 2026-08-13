# Reporting Service

Independent Django/DRF service for clinic reporting read models and dashboard
queries. It owns its database schema and never imports Clinic Core domain
models. Snapshot synchronization and report APIs are implemented in later
phases on top of these read models.

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

After the Docker stack starts:

```bash
curl http://localhost:8001/health/
```
