# Reporting Service API

Except for `GET /health/`, every endpoint requires a Clinic Core access token
with the signed `MANAGER` role:

```http
Authorization: Bearer <manager-access-token>
```

Reporting verifies this token locally using the shared verification secret.
This is infrastructure-level identity trust between Clinic Core and Reporting;
Reporting does not query Clinic Core's user database.

## Health

```http
GET /health/
```

This endpoint is public and reports only service availability.

## Synchronize reporting data

```http
POST /api/reports/synchronize/
Authorization: Bearer <manager-access-token>
Content-Type: application/json
```

Optional body (defaults to the latest 30 inclusive days):

```json
{
  "dateFrom": "2026-08-01",
  "dateTo": "2026-08-13"
}
```

The inclusive range cannot exceed 366 days.

Successful response:

```json
{
  "success": true,
  "data": {
    "runId": "15",
    "status": "SUCCESS",
    "dateFrom": "2026-08-01",
    "dateTo": "2026-08-13",
    "finishedAt": "2026-08-13T10:31:00+00:00"
  }
}
```

Errors:

- `400 VALIDATION_ERROR`: malformed JSON or invalid date range;
- `401 UNAUTHORIZED`: missing, expired, invalid, or non-access token;
- `403 FORBIDDEN`: valid access token without the `MANAGER` role;
- `502 SYNCHRONIZATION_FAILED`: Clinic Core or snapshot application failed.

## Manager dashboard

```http
GET /api/reports/dashboard/manager/?dateFrom=2026-08-01&dateTo=2026-08-13
```

Dates are optional, inclusive, and default to the latest 30 days. The maximum
range is 366 days.

```json
{
  "success": true,
  "data": {
    "period": {"dateFrom": "2026-08-01", "dateTo": "2026-08-13"},
    "appointments": {"total": 240, "completed": 190, "cancelled": 12},
    "employees": {"total": 16, "active": 14, "locked": 2},
    "organization": {"departments": 5, "rooms": 12},
    "dailyAppointments": [],
    "lastSynchronizedAt": "2026-08-13T10:30:00Z"
  }
}
```

## Daily appointments

```http
GET /api/reports/appointments/?dateFrom=2026-08-01&dateTo=2026-08-13
```

Returns `data.period` and date-ordered `data.items`. Each item contains all
appointment status totals and `synchronizedAt`.

## Daily doctor statistics

```http
GET /api/reports/doctors/?dateFrom=2026-08-01&dateTo=2026-08-13
```

Returns `data.period` and items ordered by date then `doctorId`. Doctor IDs are
opaque Clinic Core identifiers; no doctor or patient personal data is stored or
returned.

## Latest synchronization

```http
GET /api/reports/synchronizations/latest/
```

Returns the latest synchronization attempt with its status, period, timestamps,
and error message. `data` is `null` before the first attempt. This endpoint can
return a failed run, while dashboard `lastSynchronizedAt` always refers to the
latest successful run.

All manager read endpoints return:

- `400 VALIDATION_ERROR` for an invalid date range;
- `401 UNAUTHORIZED` for a missing, expired, invalid, or non-access token;
- `403 FORBIDDEN` for a valid non-manager access token.
