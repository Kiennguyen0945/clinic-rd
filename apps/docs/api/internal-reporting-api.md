# Clinic Core Internal Reporting API

This contract is private to backend services and is not routed through nginx.

## Get reporting snapshot

```http
GET /api/internal/reporting/snapshot/?dateFrom=2026-08-01&dateTo=2026-08-13
X-Service-Token: <service-token>
```

Both dates are required, inclusive, formatted as `YYYY-MM-DD`, and limited to
366 days.

Successful response:

```json
{
  "generatedAt": "2026-08-13T10:30:00Z",
  "period": {
    "dateFrom": "2026-08-01",
    "dateTo": "2026-08-13"
  },
  "appointmentsByDate": [
    {
      "date": "2026-08-13",
      "total": 3,
      "pending": 0,
      "confirmed": 1,
      "waiting": 0,
      "inProgress": 0,
      "completed": 1,
      "cancelled": 1
    }
  ],
  "appointmentsByDoctor": [
    {
      "date": "2026-08-13",
      "doctorId": 12,
      "total": 3,
      "completed": 1,
      "cancelled": 1
    }
  ],
  "employees": {
    "total": 16,
    "active": 14,
    "locked": 2,
    "doctors": 10,
    "receptionists": 4,
    "managers": 2
  },
  "organization": {
    "departments": 5,
    "rooms": 12
  }
}
```

The endpoint returns `401` for a missing or invalid service token and `400` for
an invalid date range. Its payload deliberately excludes personal and clinical
data.
