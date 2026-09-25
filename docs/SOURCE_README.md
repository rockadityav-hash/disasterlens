# SurakshaSetu

**Intelligent Hazard-Based Red-Zone Identification, Carrying-Capacity Assessment, and Relocation Prioritisation for Vulnerable Habitations**

SurakshaSetu is a working React + TypeScript and FastAPI MVP for district disaster-management officials. It combines explainable hazard risk, population exposure, candidate-site capacity, access context, official warnings and field observations in one responsive decision-support interface.

> **Safety boundary:** SurakshaSetu never issues evacuation, relocation, or land-acquisition orders. Every priority and route recommendation is provisional and displays **Official verification required**. Final action must be verified and authorised by DDMA, SDMA, or another competent authority.

The detailed pilot dataset is **Rudraprayag, Uttarakhand** because the synthetic demonstration focuses on landslide, rainfall, flood and road-isolation conditions. A searchable state gate also provides dated reference profiles for all 28 states and 8 union territories using Census 2011 population baselines and LGD administrative references. Non-pilot states never inherit Rudraprayag records; their generated map zones and shelters are explicitly labelled as hackathon-only demonstration data.

## What works

- React + TypeScript responsive government command dashboard with persistent state selection.
- Leaflet + OpenStreetMap interactive mapping with no API key, working layer controls, clearly coloured risk zones, shelter markers and habitation inspection. Every state and union territory includes deterministic, clearly labelled hackathon-only risk zones and demo shelters; they are not live alerts or official declarations.
- Seven-language interface: English, Hindi, Bengali, Marathi, Telugu, Tamil and Gujarati.
- Nationwide state/UT reference mode with an administrative map anchor, auditable source register, editable shelter-capacity scenario, data-readiness queue, privacy-aware field form and JSON export.
- Explainable village risk profiles with component scores, confidence and source lineage.
- Candidate-site comparison where effective capacity is the minimum essential constraint and land verification can force availability to zero.
- Re-ranking relocation-priority queue with rank, reason, affected people, confidence, timestamps and survey/review actions.
- Complete hazard-evidence review cards with case impact, score inputs, verification status, and hazard-specific official-source links for IMD, CWC, GSI, NCS, INCOIS, FSI, NDMA SACHET and LGD.
- Mobile field survey with dynamic score preview, consent, no Aadhaar field, device-local offline draft and later submission flow.
- Controlled data-upload preview for CSV, GeoJSON, Shapefile ZIP and GeoTIFF.
- FastAPI endpoints for static risk, immediate priority, capacity, villages, alerts and source metadata.
- PostGIS schema covering every requested core entity, provenance, audit and rollback metadata.
- Modular connector catalogue for NDMA SACHET, IMD, CWC, Bhuvan and INCOIS, labelled reference-only until credentials are configured.
- Pollable import jobs with imported/updated/failed counts, timestamps and readable errors.
- Synthetic GeoJSON and CSV import templates.
- Automated scoring and capacity tests.
- Docker Compose for React/Nginx, FastAPI and PostGIS.

## Repository layout

```text
frontend/                 React 19 + TypeScript + Vite UI
backend/app/              FastAPI app, scoring, capacity and adapters
backend/tests/            Calculation tests
database/migrations/      PostGIS schema
data/sample/              Clearly marked synthetic GeoJSON
data/reference/           Nationwide Census-derived reference table
data/templates/           Local-government import CSV templates
docs/                     API reference and data dictionary
docker-compose.yml        Full local deployment
.env.example              Configuration template without secrets
```

## Quick start

### Option A — Docker (complete stack)

1. Copy `.env.example` to `.env` and change the local database password.
2. From the repository root run:

```bash
docker compose up --build
```

Open:

- Application: `http://localhost:8080`
- API documentation: `http://localhost:8000/docs`
- API health: `http://localhost:8000/health`

The initial SQL migration is mounted into the PostGIS image and runs on the first database creation.

### Option B — frontend only

```bash
cd frontend
corepack enable
pnpm install
pnpm build
```

Deploy the generated `frontend/dist/` directory to Cloudflare Pages, Netlify, Vercel static hosting, S3/CloudFront, Nginx or any other static host. This mode uses the bundled synthetic demonstration records and all UI calculations remain functional.

### Option C — local development

Frontend:

```bash
cd frontend
pnpm install
pnpm dev
```

Backend:

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Demonstration workflow

First choose any state or union territory. Uttarakhand opens the detailed synthetic district pilot; every other jurisdiction opens the nationwide reference workflow. In reference mode, the app shows official public baselines and working planning tools while keeping live warnings, local red-zone scores and verified shelter occupancy explicitly unavailable.

1. Open **Overview** and inspect the Orange rainfall alert, exposed population, risk counts and data confidence.
2. Click **Phata** or **Ukhimath** on the map. Review the component score, vulnerable groups, shelter and source lineage.
3. Open **Risk map**, toggle layers and calculate the provisional safe route. Observe the field-verification warning.
4. Open **Site capacity**, compare sites and select **Kund Plateau A**. Water is the bottleneck even though housing capacity is higher. Select **Tilwara Expansion** to see unverified land yield zero available capacity.
5. Open **Priority queue** and filter Critical + Pending cases. Review the official-verification status.
6. Open **Field survey**, enter danger/access/vulnerability observations and watch the explainable priority preview change. Save an offline draft, then submit it for verification.
7. Open **Data management** and choose a supported file to see a validation-preview result; no data is committed by the demonstration UI.
8. Open `http://localhost:8000/docs` and run the score/capacity APIs with the default `district_officer` demo role.

## Methodology

The current red-zone review score is normalised to 0–100 and prioritises human safety:

```text
30% human exposure
25% evacuation vulnerability
25% hazard probability/intensity
12% critical infrastructure
8% economic and physical assets
```

Default display classes are Low 0–24, Moderate 25–49, High 50–74, Very High 75–100. District and hazard thresholds are designed to be configurable. Official classifications always take precedence.

Immediate review priority uses 25% active warning, 25% observed danger, 20% household vulnerability, 15% building weakness and 15% isolation. Each response includes its factor contributions and verification requirement.

Confidence is computed from source reliability (30%), recency (20%), completeness (20%), cross-source agreement (15%) and field verification (15%). Every habitation shows the component values, update time and last field-verification time instead of an unexplained percentage.

## Map configuration

- The frontend map uses Leaflet with OpenStreetMap tiles and needs no API key.
- Risk zones, habitation scores and shelters are drawn as interactive Leaflet layers over the basemap.
- The optional backend route calculation still supports a server-only `GOOGLE_MAPS_ROUTES_API_KEY`, restricted to the backend IP and Routes API.
- Set `VITE_API_URL` to the deployed FastAPI origin and add the frontend origin to `CORS_ORIGINS` when deploying the backend.
- With no Routes key, route requests return a clear unavailable response and the UI labels its bundled route fallback as demonstration data.

Candidate-site capacity is:

```text
Effective Receiving Capacity = minimum(housing, water, sanitation, health, school, road access)
Available Capacity = Effective Capacity − Current Population − Allocated Relocatees
```

If land availability is not legally verified, available capacity is zero regardless of infrastructure estimates.

## Data adapters

The adapter contract stores source organisation/URL, dataset version, collection/import dates, geographic resolution, update frequency, licence/restrictions, confidence and last verification date. `ImdWarningMockAdapter` demonstrates the live-alert schema without scraping or credentials.

Production adapters should use authorised APIs, downloads, WMS/WFS or documented manual imports for LGD, Census, Survey of India, Bhuvan, GSI, IMD, NDEM/CWC, INCOIS, NCS, FSI, PMGSY, UDISE+, IDRN, CGWB and authorised state/revenue sources. Credentials are intentionally absent. Never scrape protected websites.

## Security and ethics

- Demo roles: public aggregate, field surveyor, district officer, data manager and administrator.
- Replace the demo header with signed SSO/OIDC tokens before production.
- Keep household records encrypted at rest and in transit; apply row-level permissions and retention rules.
- Store opaque household references, not Aadhaar.
- Record consent and keep photographs in protected object storage rather than the database.
- Audit reads and writes of restricted records.
- Validate land ownership/legal availability with the Revenue Department before displaying availability.
- Treat route results as provisional until field verified.

## Limitations

- The Uttarakhand pilot's hazards, alerts, routes and sites are synthetic. Nationwide population/density fields are historical Census 2011 references; scenario hazard topics are demonstrations, not current warnings.
- State-capital coordinates are map anchors only. The nationwide mode intentionally does not generate red-zone scores or claim verified shelter occupancy without local evidence.
- The browser map is a framework-native interactive demonstration, not a replacement for authoritative MapLibre/PostGIS layers. The data model and import surface are ready for that integration.
- Live feeds require registrations, credentials and source-specific authorisation.
- Census 2011 must be supplemented with verified current aggregates from authorised local sources.
- Offline drafts use device storage in the MVP; production should use encrypted IndexedDB plus a conflict-aware sync queue.

## Tests

```bash
cd backend
python -m unittest discover -s tests -v
```

The test suite verifies score weights and class boundaries, limiting-constraint capacity, zero capacity for legally unverified sites, non-negative available capacity, and complete unique coverage of all 36 states/UTs.

See [API reference](docs/API.md) and [data dictionary](docs/DATA_DICTIONARY.md).
