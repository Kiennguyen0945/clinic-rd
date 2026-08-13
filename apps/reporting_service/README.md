# Reporting Service

Independent Django/DRF service for clinic reporting read models and dashboard
queries. Phase 1 establishes the runtime and data boundary; synchronization and
report APIs are intentionally deferred to the next phase.

## Ownership

- Compose service: `reporting-service`
- Database service: `reporting-db`
- Database volume: `reporting_data`
- HTTP port: `8001`
- Health endpoint: `GET /health/`

The service uses only `REPORTING_DB_*` credentials. It must not import Clinic
Core domain models or connect to the Clinic Core database.

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
