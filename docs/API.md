# API quick reference

FastAPI serves interactive OpenAPI documentation at `/docs` and the schema at `/openapi.json`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Service health and synthetic-data flag. |
| GET | `/api/v1/dashboard` | Overview metrics and current unexpired alerts. |
| GET | `/api/v1/villages` | Aggregate village risk list. |
| GET | `/api/v1/villages/{lgd_code}` | Explainable village profile and source lineage. |
| GET | `/api/v1/alerts` | Active processed alerts; expired alerts excluded. |
| GET | `/api/v1/data-sources` | Provenance catalogue. |
| GET | `/api/v1/states` | Dated Census-based reference list for all 28 states and 8 union territories. |
| GET | `/api/v1/states/{state_name}` | One state/UT reference profile with source register and explicit null operational fields. |
| POST | `/api/v1/scoring/static-risk` | Four-factor static risk calculation. |
| POST | `/api/v1/scoring/immediate-priority` | Five-factor official-review priority calculation. |
| POST | `/api/v1/capacity` | Minimum-constraint effective and available capacity. |
| POST | `/api/v1/scoring/red-zone` | Human-safety-first five-factor red-zone review score. |
| POST | `/api/v1/scoring/confidence` | Evidence-based confidence score and contributions. |
| GET/PUT | `/api/v1/admin/risk-weights` | Read or update validated weights; PUT requires administrator role. |
| GET | `/api/v1/connectors/status` | Official/reference/demo connector readiness without implying a live feed. |
| GET | `/api/v1/import-jobs?state=...` | Pollable state-scoped import job status. |
| POST | `/api/v1/routes/compute` | Server-side Google Routes proxy with a restricted response field mask. |
| POST | `/api/v1/field-surveys` | Record a separate provenance-preserving ground-truth observation for authorised reconciliation. |

Demo role-based access uses `X-Demo-Role`: `public`, `field_surveyor`, `district_officer`, `data_manager`, or `administrator`. Production deployments should replace this with the state identity provider and signed tokens.

The Routes endpoint returns HTTP 503 until `GOOGLE_MAPS_ROUTES_API_KEY` is configured server-side. It never returns the key. Route results are provisional and require field verification.

Nationwide reference endpoints are non-operational. They return `risk_score: null` and `verified_shelter_occupancy: null` when local authorised evidence is not present; clients must not convert historical population totals into red-zone declarations.
