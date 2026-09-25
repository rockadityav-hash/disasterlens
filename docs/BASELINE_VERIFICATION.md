# Baseline verification — 2026-09-25

Source revision: `7b34532bd052de8152cda9a96729e77d412c7b94`.

## Results

| Check | Result |
| --- | --- |
| Source completeness | All 79 source files retained. Styles, map-rendering component, algorithms, adapters, original tests, assets, data and SQL migrations unchanged. |
| Frontend install | Original pnpm lockfile installed with `--frozen-lockfile`. |
| Frontend build/type checking | `pnpm build` passes. The inherited large-chunk warning remains; no redesign/code splitting was introduced. |
| Backend install | Fresh local virtual environment; `pip check` reports no broken requirements. |
| Backend startup | Uvicorn starts successfully at `127.0.0.1:8000`; frontend displays API connected. |
| Original tests | All 41 unittest tests pass. |
| HTTP contracts | 39 assertions/requests pass via `scripts/verify_api.py`, including expected validation/permission failures. |
| Risk outputs | Static risk 69.0, immediate priority 63.0, red-zone risk 71.7, confidence 81.0 for the script's fixed inputs. |
| Capacity | Limiting health capacity 300; available capacity 150 after population and allocations. |
| Shelter recommendations | All six existing disaster types return eligible results for verified safe fixtures; unsafe route rejects a shelter and absent satellite evidence requires verification. |
| Assets | HTML, SVG logo and PNG preview return HTTP 200. Browser-rendered logo and OSM tiles load. |
| Git exclusions | Environment files, keys, credentials, dependencies, virtual environment, caches and build output are ignored. Both blank `.env.example` files remain eligible for tracking. |

The HTTP harness exercises health/OpenAPI, dashboard, villages, alerts, data sources, 36 states/UTs, connector status, import jobs, all score endpoints, capacity, shelter recommendations, administrator weights, survey acceptance, CORS, hazard snapshots and shelter-boundary screening. It also checks 404, 403 and 422 behavior and the expected missing-Google-key 503 response.

## Browser checks

- Uttarakhand pilot and Karnataka state change render the correct distinct records; state selection survives reload.
- All seven navigation views open: Overview, Risk map, Habitations, Priority queue, Shelter Capacity, Field survey and Data sources.
- Leaflet/OpenStreetMap map tiles render; demo risk-layer toggle works; the route fallback is clearly labelled.
- Searching Phata filters the register to one record; its drawer exposes component scores, confidence, provenance and vulnerable-group information.
- Assigning a demo survey updates assignment count; marking a demo case reviewed reduces the active queue from six to five and re-ranks it.
- Shelter selection changes with disaster/group size. Changing to landslide and 1,000 people rejects insufficient-capacity candidates with a readable blocker.
- Survey preview changes from 8 to 46 with active flooding, blocked access and two elderly residents. Saving an offline draft updates the count. A synthetic completed survey submits through the frontend with the API's 202 acceptance and shows pending official verification.
- English/Hindi language switching works; the remaining five language resources are preserved unchanged except the storage namespace.
- Desktop viewport 1440×1000 and mobile viewport 390×844 checked. Mobile menu opens and navigates to Risk map; the overview has no horizontal overflow (375px content width and scroll width including browser scrollbar behavior).

## Runtime versions verified

- Node.js 24.19.0, pnpm 11.19.0.
- React/React DOM 19.2.8, Vite 8.2.2, TypeScript 7.0.2, Leaflet 1.9.4 (source lockfile).
- Python 3.12.14, FastAPI 0.141.1, Uvicorn 0.53.0, Pydantic 2.13.5, psycopg 3.3.6, python-multipart 0.0.32 (within original requirement ranges).

## External-service and runtime limits

- USGS responded successfully during the live snapshot check.
- NDMA SACHET was temporarily unreachable. Snapshot returns `partial`, source status remains labelled, and shelter screening requires verification; live NDMA alert geometry could not be verified.
- No Google Routes key was supplied. The original missing-key error and labelled UI demo fallback were verified; a real Google route was not computed.
- Bhuvan has no verified historical WMS layer configured for Uttarakhand; IMD authorised integration is not configured. No credentials or additional feeds were invented.
- Docker/PostGIS execution could not be verified because Docker is unavailable here. Compose YAML, build paths and proxy configuration were checked by inspection and parsing; this is not a container runtime test.
- Existing prototype limitations remain: synthetic datasets, demo GPS, preview-only import/export actions, browser/component-local state and no durable API database persistence. No existing code or feature was omitted from the copy.

## Repeat checks

From `frontend`, run `pnpm build`. From `backend`, run `.\.venv\Scripts\python.exe -m unittest discover -s tests -v` and `.\.venv\Scripts\python.exe -m pip check`.

With a local demo API running on port 8000 and no Google Routes key, run `.\.venv\Scripts\python.exe ..\scripts\verify_api.py` from `backend`. The script submits a synthetic survey and saves the current weights back unchanged. Use it only with this local demo baseline. Public-source status may differ on later runs; healthy source availability is not fabricated by the test.
