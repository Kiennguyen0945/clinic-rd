# Reporting Service API

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
