# Appointments domain

The Python package is named `appointments`. Its Django app label remains
`appointment_service` so existing migration dependencies and database table
names stay compatible.

## Where changes belong

- `api/`: HTTP routing, request validation, and response serialization.
- `models/`: database schema and model-local invariants.
- `services/`: write use cases and transaction boundaries.
- `selectors/`: reusable read queries and projections.
- `tasks.py`: scheduled/background jobs.
- `tests/`: tests organized by use case.

API views may call services and selectors. Services/selectors may use models,
but they must not import API views or serializers.

Run this domain's tests with:

```bash
python manage.py test appointments --settings=config.settings.test
```
