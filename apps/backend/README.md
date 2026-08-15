# Clinic Core Backend

Django REST Framework Clinic Core service for clinic staff, patients,
organization data, appointments, doctor slots, and medical records. Its source
remains in `apps/backend`; `clinic-core` is its development Compose service
name and `clinic-core-db` is its PostgreSQL network hostname.

## Contents

- [Architecture](#architecture)
- [Current state](#current-state)
- [Domain state](#domain-state)
- [API](#api)
- [Local development](#local-development)
- [Testing and quality gates](#testing-and-quality-gates)
- [Developing a feature](#developing-a-feature)

## Architecture

The backend is a modular Django application. Each domain service follows the
same layered layout:

```text
service_name/
├── api/
│   ├── urls.py          # Routes owned by the service
│   ├── views.py         # HTTP/DRF request and response coordination
│   └── serializers.py   # Input validation and response serialization
├── models/              # Django models, split by domain entity
├── services/            # Business workflows and database state changes
├── selectors/           # Read-only database queries
├── management/commands/ # Service-specific Django commands
├── migrations/          # Django schema and data migrations
├── tests/               # Factories and focused test modules
└── tasks.py              # Background/scheduled task entrypoints
```

Request flow:

```text
HTTP request
    -> config/urls.py
    -> service/api/urls.py
    -> service/api/views.py
         -> serializer (validate/transform data)
         -> selector (read data)
         -> service (enforce rules and change state)
    -> shared response envelope
    -> HTTP response
```

### Layer responsibilities

| Layer | Owns | Must avoid |
| --- | --- | --- |
| `api/views.py` | HTTP methods, authentication, query/path parameters, coordinating calls, response status | Long transactions and domain rules |
| `api/serializers.py` | Input validation and representation | Workflow orchestration |
| `selectors/` | Optimized, reusable, read-only queries | State changes |
| `services/` | Business rules, transactions, state transitions | DRF `Request` and `Response` objects |
| `models/` | Entities, relations, database constraints, small entity invariants | Request-specific behavior |
| `tasks.py` | Background execution entrypoints | Duplicating service logic |

Root `views.py`, `urls.py`, and `serializers.py` files inside refactored
services are compatibility façades. They keep historical imports working while
the implementation lives under `api/`. New code should import from `api/`
directly. Stable model imports such as `from auth_service.models import User`
remain supported through `models/__init__.py`.

### Project infrastructure

```text
config/
├── settings/
│   ├── base.py          # Settings shared by all environments
│   ├── development.py   # Local development
│   ├── test.py          # Automated tests and CI
│   └── production.py    # Deployed WSGI/ASGI application
├── urls.py
├── asgi.py
└── wsgi.py

core/
├── api/
│   ├── authentication.py
│   ├── permissions.py
│   ├── responses.py
│   └── exceptions.py
├── management/commands/
└── tests/
```

`config` contains Django project configuration only. `core` contains shared
application infrastructure and must not become a home for domain-specific
business rules.

## Current state

| Service | Responsibility | Layered state |
| --- | --- | --- |
| `auth_service` | Roles, users, JWT login/refresh, password and staff management | Refactored |
| `patient_service` | Patient CRUD and patient medical-history access | Refactored |
| `organization_service` | Departments, rooms, doctor-department assignments | Refactored |
| `appointment_service` | Booking, rescheduling, slots, queue, check-in, cancellation | Refactored |
| `medical_records` | Draft records, clinical updates, prescriptions, signing | Refactored |
| `custom_commands` | Cross-domain seed and operational commands | Existing infrastructure |

The installed Django app is `appointment_service`. The top-level
`appointments/` directory is currently an unused empty scaffold and should not
receive feature code.

Authentication uses the project-specific `auth_service.User` model through
`core.api.authentication.CustomJWTAuthentication`. API responses generally use
the shared envelopes:

```json
{
  "success": true,
  "data": {},
  "message": "Thành công"
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": {}
  }
}
```

## Domain state

### Appointment lifecycle

```text
Scheduled booking -> CONFIRMED -> WAITING -> IN_PROGRESS -> COMPLETED
Walk-in booking ---------------> WAITING -> IN_PROGRESS -> COMPLETED
PENDING / CONFIRMED / WAITING / IN_PROGRESS --------------> CANCELLED
```

Defined appointment states are `PENDING`, `CONFIRMED`, `WAITING`,
`IN_PROGRESS`, `COMPLETED`, and `CANCELLED`. Services enforce which
transitions are allowed; API views should not modify these fields directly.

- Booking types: `SCHEDULE`, `WALK_IN`
- Patient types: `SERVICE`, `BHYT`
- Slot states: `OPEN`, `CLOSED`
- User states: `ACTIVE`, `INACTIVE`, `LOCKED`
- Medical-record states: `DRAFT`, `SIGNED`

Signing a medical record also completes its appointment in one transaction.
A signed medical record cannot be edited and its prescription cannot be
replaced.

Doctor slots are one hour long, start on a whole hour, have positive capacity,
and cannot overlap for the same doctor. These invariants are enforced by the
model and database constraints.

## API

All service routes use the `/api/` prefix. Django administration is available
at `/admin/`.

### Service health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health/` | Confirm that the Clinic Core HTTP process is available |

The health endpoint does not query the database. Database readiness is handled
separately by the PostgreSQL health check in Docker Compose.

### Internal Reporting integration

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/internal/reporting/snapshot/` | Return privacy-safe aggregates to Reporting Service |

The snapshot endpoint requires `X-Service-Token`, accepts inclusive
`dateFrom` and `dateTo` query parameters in `YYYY-MM-DD` format, and limits a
request to 366 days. It returns appointment counts by date and doctor plus
employee and organization summaries. It never returns names, contact details,
clinical data, or appointment free text.

nginx blocks `/api/internal/`; Reporting calls Clinic Core directly through
`http://clinic-core:8000` on the private Compose network.

### Authentication and staff

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/auth/roles/` | List or create roles |
| `GET`, `POST` | `/api/auth/users/` | List or create users |
| `POST` | `/api/auth/login/` | Issue access and refresh tokens |
| `POST` | `/api/auth/refresh/` | Refresh a session |
| `POST` | `/api/auth/change-password/` | Change the authenticated user's password |
| `GET`, `POST` | `/api/auth/staff/` | List employees or create receptionist/doctor staff (manager only) |
| `GET`, `PATCH`, `DELETE` | `/api/auth/staff/<id>/` | View, update, or delete an employee when no clinical activity exists (manager only) |
| `PATCH` | `/api/auth/staff/<id>/lock/` | Lock or unlock a staff account |

Creating a doctor requires `departmentId`; `roomId` is optional. When `roomId` is
omitted, the account is created with `scheduleStatus: UNASSIGNED` and cannot
receive appointments because it has no slots. When supplied, the workflow creates
the next day's standard clinic slots in that room.

Managers can schedule an unscheduled doctor with `POST
/api/auth/staff/<id>/room-allocations/`, supplying `roomId`, `date`, `startTime`,
and `endTime`. Allocations must be future, whole-hour ranges. Conflicting doctor or
room allocations return `DOCTOR_UNAVAILABLE` or `ROOM_UNAVAILABLE`.

Use the access token with protected endpoints:

```http
Authorization: Bearer <access-token>
```

### Patients

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/patients/` | Search/list or create patients |
| `GET`, `PUT` | `/api/patients/<id>/` | Retrieve or update a patient |
| `GET` | `/api/patients/<id>/medical-records/` | Retrieve medical history |

### Organization

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/departments/` | List or create departments |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/departments/<id>/` | Department detail |
| `GET`, `POST` | `/api/rooms/` | List or create rooms |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/rooms/<id>/` | Room detail |
| `GET`, `POST` | `/api/doctor-departments/` | List or create doctor assignments |
| `GET`, `DELETE` | `/api/doctor-departments/<id>/` | Assignment detail |

`GET /api/doctor-departments/?doctor_id=<id>` filters assignments by doctor.
Authenticated staff may read organization data; only managers may create, update,
or delete it. New rooms require `room_number` and `department_id`, and accept an
optional `description`. Departments or rooms referenced by operational data return
`RESOURCE_IN_USE` instead of being deleted. Existing rooms may temporarily have no
department after migration; newly scheduled doctors cannot use a room assigned to
a different department.

### Appointments and slots

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/appointments/` | List or book appointments |
| `GET` | `/api/appointments/queue/` | Reception queue |
| `GET` | `/api/appointments/reception-context/` | Reception dashboard context |
| `GET` | `/api/doctor-slots/` | List available doctor slots |
| `GET` | `/api/doctor-slots/<id>/` | Retrieve a slot and its appointments |
| `PUT` | `/api/appointments/<id>/` | Update or reschedule an appointment |
| `PATCH` | `/api/appointments/<id>/cancel/` | Cancel an appointment |
| `POST` | `/api/appointments/<id>/check-in/` | Check in an appointment |
| `POST` | `/api/appointments/<id>/start/` | Start the consultation |
| `GET` | `/api/dashboard/today/` | Today's dashboard |
| `GET` | `/api/appointments/stats/` | Appointment statistics |

The appointment API also retains `POST /api/medical-records/` for its legacy
appointment-completion flow. New draft/update/prescription/sign workflows are
owned by `medical_records` below.

### Medical records

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/appointments/<id>/medical-record/` | Get or create a draft for an in-progress appointment |
| `PATCH` | `/api/medical-records/<id>/` | Update draft clinical data |
| `PUT` | `/api/medical-records/<id>/prescription/` | Replace prescription items |
| `POST` | `/api/medical-records/<id>/sign/` | Sign the record and complete the appointment |

The URL tables document routing and intent. Serializer fields and validation
rules in each service's `api/serializers.py` are the source of truth for request
and response payloads.

## Local development

### Docker Compose

From the repository root:

```bash
docker compose -f docker-compose.dev.yaml up --build
```

The `clinic-core` service listens on port `8000` and connects to
`clinic-core-db` over the Compose network. Its entrypoint runs migrations,
attempts idempotent superuser creation, starts cron, and then starts Django's
development server. The existing `postgres_clinic_db` volume name is retained
so this service rename does not delete or recreate persisted database files.

Copy `.env.example` to `.env` for a fresh environment and replace every
placeholder secret. Existing environments should keep their current `.env`:
changing `POSTGRES_DB` does not rename a database already stored in a Docker
volume.

When upgrading a running checkout that used the old `backend` and `database`
service names, remove only the orphaned containers during the first startup:

```bash
docker compose -f docker-compose.dev.yaml up --build --remove-orphans
```

This keeps the `postgres_clinic_db` volume. Do not add `--volumes` or run
`docker compose down --volumes` when preserving local database data.

Once the stack is running, check Clinic Core through nginx:

```bash
curl http://localhost/api/health/
```

### Local virtual environment

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r apps/backend/requirements.txt
python -m pip install -r apps/backend/requirements_dev.txt
cd apps/backend
```

For a local SQLite run:

```bash
DJANGO_DB_ENGINE=sqlite python manage.py migrate
DJANGO_DB_ENGINE=sqlite python manage.py runserver
```

For PostgreSQL, configure these environment variables:

```text
DJANGO_DB_ENGINE=postgres
POSTGRES_DB=clinic_core_db
POSTGRES_USER=clinic_core_user
POSTGRES_PASSWORD=...
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

`manage.py` defaults to `config.settings.development`. CI uses
`config.settings.test`; WSGI and ASGI default to `config.settings.production`.

## Testing and quality gates

Run commands from `apps/backend` with the virtual environment activated.

Fast local checks with SQLite:

```bash
python -m ruff check --no-cache .
DJANGO_DB_ENGINE=sqlite DJANGO_SETTINGS_MODULE=config.settings.test python manage.py check
DJANGO_DB_ENGINE=sqlite DJANGO_SETTINGS_MODULE=config.settings.test python manage.py makemigrations --check --dry-run
DJANGO_DB_ENGINE=sqlite DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test
```

Run one service or one test module while developing:

```bash
DJANGO_DB_ENGINE=sqlite DJANGO_SETTINGS_MODULE=config.settings.test \
  python manage.py test appointment_service

DJANGO_DB_ENGINE=sqlite DJANGO_SETTINGS_MODULE=config.settings.test \
  python manage.py test medical_records.tests.test_sign_medical_record
```

CI uses Python 3.12, installs the pinned production and development
requirements, runs the same Ruff command with caching disabled, and runs Django
integration tests against PostgreSQL. Before opening a PR, run the full SQLite
suite locally; database-sensitive changes should also be checked against
PostgreSQL.

Tests should be placed according to the behavior they protect:

- `tests/factories.py`: reusable domain setup without assertions
- `test_<workflow>.py`: service behavior and state transitions
- `test_<entity>_queries.py`: selector behavior and query filtering
- `test_api.py` or `test_<flow>.py`: routing, permissions, payload, and response contract

Do not edit old migration files after they have been shared. Change models,
create a new migration, and verify that `makemigrations --check --dry-run`
reports no uncommitted model drift.

## Developing a feature

1. Identify the owning domain. Avoid implementing the same workflow in two
   services.
2. Add or update model constraints only when the domain requires persisted
   invariants. Generate a migration for schema changes.
3. Add selectors for reusable reads. Keep them free of writes and request
   objects.
4. Add a service for workflows, transactions, and state changes. Raise the
   service's domain error with stable error codes for expected failures.
5. Add serializer validation for the external payload contract.
6. Keep the API view thin: check HTTP-level access, call selectors/services,
   and translate results or domain errors into shared responses.
7. Register the route in the service's `api/urls.py`. Keep `config/urls.py`
   limited to including service URL configurations.
8. Add focused service/selector tests and API coverage for permissions and
   response contracts.
9. Run Ruff, Django checks, migration-drift checks, and the full test suite.

### Example boundary

```python
# api/views.py
class ExampleView(APIView):
    def post(self, request):
        serializer = ExampleInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = perform_example(
                actor=request.user,
                data=serializer.validated_data,
            )
        except ExampleServiceError as exc:
            return error_response(
                exc.code,
                exc.message,
                status=exc.status,
                details=exc.details,
            )
        return success_response(ExampleOutputSerializer(result).data, status=201)
```

The corresponding service receives ordinary domain values, owns its
transaction, and does not import DRF request or response classes.

### Review checklist

- Existing URL and response contracts remain compatible, or the API change is documented.
- Permissions are explicit for protected operations.
- Services own business rules and atomic state transitions.
- Selectors do not mutate state.
- Models retain the same Django app label and model names during file moves.
- New failure cases use stable machine-readable error codes.
- Tests cover success, validation, authorization, and invalid state transitions.
- Ruff, Django checks, migrations, and tests pass locally.
