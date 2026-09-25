# DisasterLens

## Structure

```text
frontend/                 React + TypeScript + Vite, Leaflet maps and assets
backend/app/              FastAPI endpoints, adapters and calculations
backend/tests/            Original 41 algorithm/adapter tests
backend/requirements.txt  Backend dependency ranges
backend/.venv/            Local Python environment (ignored)
data/                     Reference tables, sample GeoJSON and CSV templates
database/migrations/      Original PostGIS schema (not used by in-memory API)
docs/                     API, data, shelter methodology and migration notes
scripts/                  Repeatable local API smoke verification
docker-compose.yml        Separate disasterlens Compose project and DB volume
.env.example              Blank configuration names; no secrets
```

## Run locally

Use Node.js 22.12+ (verified with 24.19.0), pnpm 11.19.0 and Python 3.12. No API keys, database or `.env` file are required for the original demo baseline.

Open two terminals from the DisasterLens directory.

Backend (PowerShell):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --no-cache-dir -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 5173 --strictPort
```

Open **http://localhost:5173**. API docs: **http://localhost:8000/docs**. Health: **http://localhost:8000/health**. Stop each service with Ctrl+C. On macOS/Linux the Python executable is `.venv/bin/python`.

If Python or pnpm is absent from PATH in this Codex session, the verified bundled executables are:

```text
C:\Users\manju\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
C:\Users\manju\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd
```

These paths are convenience information only; no application code depends on them. Invoke quoted executable paths with `&` in PowerShell.

Do not run the original app on the same ports at the same time. For different frontend/backend ports set `VITE_API_URL` in `frontend/.env` and `CORS_ORIGINS` in the backend process environment. Browser state and drafts use a separate `disasterlens-` namespace.

## Environment configuration

Examples contain blank variable names only. Keep actual values in ignored `.env` files or process environment variables. `VITE_*` values are public browser configuration and must never contain secrets.

| Variables | Requirement and behavior |
| --- | --- |
| `VITE_API_URL` | Optional frontend API URL; unset/blank defaults to `http://localhost:8000`. Vite reads `frontend/.env`, not the root `.env`. Docker defaults to the same-origin `/backend` proxy. |
| `CORS_ORIGINS` | Optional comma-separated frontend origins. Local default is `http://localhost:5173`; include `http://127.0.0.1:5173` if using that browser URL. Blank uses the default. |
| `GOOGLE_MAPS_ROUTES_API_KEY` | Optional, server-only Google Routes key. Without it the endpoint returns 503 and the UI uses its labelled demo fallback. Leaflet/OSM maps need no key. |
| `NDMA_CAP_FEED_URL`, `USGS_FEED_URL` | Optional overrides of the original public feed endpoints. Unset/blank uses the source defaults. |
| `HAZARD_FETCH_TIMEOUT_SECONDS`, `HAZARD_CACHE_TTL_SECONDS` | Optional; defaults 5 and 120 seconds. |
| `NDMA_MAX_CAP_ITEMS`, `USGS_QUERY_RADIUS_KM` | Optional; defaults 16 items and 500 km. |
| `POSTGRES_PASSWORD` | Required only for Docker Compose. Choose a private password in root `.env`; do not commit it. |
| `POSTGRES_DB`, `POSTGRES_USER` | Optional Docker database identifiers; both default to `disasterlens`. |
| `DATABASE_URL` | Retained for the inherited PostGIS scaffold; the current demonstration API does not use database persistence. |
| `DEMO_AUTH_ENABLED`, `DATA_RETENTION_DAYS`, `IMD_API_KEY`, `NDEM_API_KEY` | Retained source template names, not consumed by the current backend. They do not enable production authentication, retention or connectors. |

For local backend overrides, set process environment variables before starting Uvicorn, or pass `--env-file ..\.env` explicitly. Do not assume FastAPI automatically loads root `.env`.

## Docker scaffold

Docker is optional and was unavailable on the migration machine; the container stack has not been runtime verified.

```powershell
Copy-Item .env.example .env
# Edit .env: set POSTGRES_PASSWORD to a private value.
docker compose up --build
```

Open http://localhost:8080. Nginx forwards `/backend/` to the API container. Compose uses project name `disasterlens` and a separate database volume. The original SQL migrations run on first database creation; the original API still uses demo/in-memory data. The Docker Nginx COPY path was corrected, API build configuration is explicit, and secrets/dependencies are excluded from build contexts.

## Verify

```powershell
cd frontend
pnpm build
cd ../backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m pip check
```

See [baseline verification](docs/BASELINE_VERIFICATION.md) for checked flows, runtime versions and limitations. See [migration provenance](docs/MIGRATION.md) for the exact scope of changes. [Original source README](docs/SOURCE_README.md) is retained as a historical reference; setup instructions in this README take precedence.

## Preserved source limitations

The source is a prototype. Dashboard hazards, habitation records, route fallback and shelter measurements are synthetic. Nationwide population references are dated Census 2011 baselines. Priority review actions use component state; import/export/template buttons include preview-only behavior; the GPS button supplies demonstration coordinates. Survey acceptance and administrator weights are not durable database writes. Demo role headers are not production authentication. Offline drafts remain browser-local. These behaviors were preserved rather than expanded during migration.

Live NDMA/USGS feed availability depends on the upstream services and network access; source failures remain isolated and labelled. Real Google route results require the optional key. Static Bhuvan layers depend on available source layers. Existing official-verification notices remain intact.

Git history is local only. No remote is configured and nothing has been pushed. Stop here before adding new DisasterLens features.
