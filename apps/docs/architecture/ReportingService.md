# Reporting Service: Phase 1 Boundary

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
