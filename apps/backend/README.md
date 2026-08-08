# Backend

## Settings by environment

The project has one settings module per runtime:

- `config.settings.development`: local development; this is the `manage.py` default.
- `config.settings.test`: automated tests; defaults to an in-memory SQLite database.
- `config.settings.production`: WSGI/ASGI and production containers.

Common commands:

```bash
python manage.py runserver
python manage.py check --settings=config.settings.test
python manage.py test --settings=config.settings.test
python manage.py check --deploy --settings=config.settings.production
```

Set `DJANGO_SETTINGS_MODULE` explicitly for scripts that do not run through
`manage.py`:

```bash
export DJANGO_SETTINGS_MODULE=config.settings.development
```

## Shared API code

Domain-independent API helpers live under `core/api`:

- `authentication.py`: JWT authentication.
- `permissions.py`: reusable role permissions.
- `responses.py`: success and error response envelopes.
- `exceptions.py`: stable API exceptions.

Domain applications may import from `core.api`. Code in `core` must not import
views, serializers, or services from a domain application. The temporary
modules under `backend/` re-export the new modules for compatibility and should
not be used by new code.

## Infrastructure tests

Tests under `core/tests` verify settings, root routes, role permissions,
response envelopes, and shared exceptions:

```bash
python manage.py test core --settings=config.settings.test
```
