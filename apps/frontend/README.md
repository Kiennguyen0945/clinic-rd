# Clinic frontend

React 19 and TypeScript frontend for the clinic reception, patient, appointment,
dashboard, and medical-record workflows.

## Commands

```bash
npm run dev             # Vite development server
npm run lint            # type-aware ESLint and dependency boundaries
npm run type-check      # strict TypeScript build check
npm run check:cycles    # static import-cycle check
npm run test            # characterization and unit tests
npm run build           # production build
npm run report:bundle   # report and enforce JS/CSS bundle budgets
npm run ci              # complete local/CI quality gate
```

## Directory responsibilities

```text
src/
├── app/       providers, router, layouts, and application assembly
├── features/  user workflows and route-level pages
├── entities/  reusable domain types, mappers, APIs, and domain UI
├── shared/    generic API, authentication, utilities, and styles
├── pages/     temporary compatibility exports; do not add new pages
└── test/      cross-feature characterization tests and MSW fixtures
```

Dependency direction is `app → features → entities → shared`. Shared code must
not import entities or features. Entities may import shared code and other
entities, but never features or app code. ESLint enforces the lower-layer rules,
and `npm run check:cycles` rejects circular imports.

Use the `@/` alias for imports crossing architectural layers, for example
`@/shared/api` or `@/features/patients`. Relative imports are preferred within
the same feature or entity.

## State ownership

- React Query owns remote/server state, polling, caching, and invalidation.
- React Hook Form owns non-trivial form drafts and validation state.
- Component state owns short-lived presentation state such as open modals.
- Zustand's session store owns authentication state only.
- URL search parameters own filters that should survive navigation or refresh.
- Do not mirror query data into component state unless optimistic workflow edits
  require it; isolate and document the synchronization boundary when necessary.

## Query keys

Each feature declares a key factory in its query module:

```ts
export const patientQueryKeys = {
  all: ['patients'] as const,
  list: (filters: PatientFilters) => [...patientQueryKeys.all, 'list', filters] as const,
}
```

Begin keys with the domain collection, include every input that changes the
response, and invalidate the narrowest stable parent key after mutations.

## API errors

The shared HTTP client normalizes failed responses into `ApiError` with:

```ts
interface ApiErrorShape {
  message: string
  code?: string
  status?: number
  details?: Record<string, unknown>
}
```

Entity and feature APIs return typed data or throw `ApiError`. Components should
not parse response envelopes or silently replace failed clinical requests with
mock data. The current medical-record demo fallback is isolated under
`features/medical-records/demo` pending its explicit demo-flag migration.

## Testing strategy

- `src/test/*workflow.test.tsx` protects complete authentication, reception,
  patient, and doctor journeys during refactors.
- MSW handlers describe HTTP contracts at feature boundaries.
- Mapper, schema, hook, and query-key behavior should use focused unit tests.
- Add a characterization test before intentionally changing an untested flow.
- Visual CSS extraction requires desktop and mobile screenshot baselines.

## Adding a feature

1. Create `features/<feature>/{api,components,model,pages}` as needed.
2. Put reusable business representations in `entities`, not the feature.
3. Add query-key factories, queries, mutations, and validation schemas.
4. Compose the route page from workflow hooks and focused view components.
5. Export the supported surface from `features/<feature>/index.ts`.
6. Lazy-load the public page export from `app/router.tsx`.
7. Add workflow tests and run `npm run ci`.

## Public feature APIs

Other layers must import a feature through its `index.ts`, not a deep internal
path. Export only stable pages, reusable workflow components, hooks, and types.
Keep implementation-only modals and helper functions private. A feature may use
relative imports internally; app routing uses public feature exports.

## Styling

`shared/styles/legacy.css` is the single ordered CSS entry point. Its two legacy
imports preserve the current cascade. Do not reorder or extract selectors until
desktop/mobile visual regression coverage exists for all primary routes.
