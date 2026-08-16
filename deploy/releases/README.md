# Release manifests

Each production Git tag `vX.Y.Z` must have a matching
`deploy/releases/vX.Y.Z.env` file in the tagged commit. The manifest records
the immutable Docker image tags that passed staging together.

Example:

```dotenv
FRONTEND_TAG=<40-character-git-sha>
BACKEND_TAG=<40-character-git-sha>
REPORTING_TAG=<40-character-git-sha>
```

Release procedure:

1. Read the three image tags from the healthy staging containers.
2. Add and review `deploy/releases/vX.Y.Z.env` on `main`.
3. Create an annotated tag on that exact commit:

   ```bash
   git switch main
   git pull --ff-only origin main
   git tag -a vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. The production workflow validates the manifest, waits for approval in the
   GitHub `production` environment, and deploys those images without rebuilding.

To roll back, run the `Rollback production` workflow and enter a previously
successful tag such as `v0.1.0`. The workflow checks out that tag and deploys
its recorded image set.

## Required GitHub setup

- Create a protected GitHub Environment named `production` and add at least
  one required reviewer.
- Store production-only secrets in that environment using the same names as
  the staging secrets.
- Register a separate self-hosted runner with the label `clinic-production`.
  Do not give the staging and production jobs the same Docker daemon: the
  Compose project uses fixed container names and the two deployments would
  overwrite each other.
- Protect release tags matching `v*` so only release maintainers can create or
  delete them.
