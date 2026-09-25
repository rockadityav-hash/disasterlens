# Data dictionary

All demonstration records are synthetic and use the suffix or flag `synthetic`. LGD village code is the canonical village identifier; Census and historical codes are retained as mappings.

| Entity | Key fields | Purpose / restriction |
|---|---|---|
| `states`, `districts`, `subdistricts`, `gram_panchayats`, `villages` | LGD code, name, geometry, source | Administrative hierarchy and authoritative spatial join. |
| `habitations` | village ID, local code, point, population | Settlement-level exposure unit. |
| `households` | opaque reference, size, restricted payload, consent, retention date | Restricted role-only information; never store Aadhaar. |
| `people_vulnerability_summary` | children, elderly, pregnancy, disability, SC/ST aggregates | Aggregate social vulnerability inputs. |
| `hazard_layers` | hazard type, official class, geometry/raster reference, source | Authoritative classification takes precedence over prototype thresholds. |
| `hazard_events`, `alerts` | issue/validity times, affected area, original and processed payload | Original source is retained; expired alerts are excluded from active views. |
| `village_hazard_scores` | four component scores, combined score, explanation, thresholds | Auditable static-risk result. |
| `infrastructure`, `roads`, `road_status`, `shelters` | type/status/capacity, geometry, verification | Provisional routing and access analysis. |
| `candidate_relocation_sites` | land areas, verification status, geometry | Unverified/private land must not be treated as available. |
| `carrying_capacity_results` | six constraints, effective/available capacities, bottleneck | Effective capacity is the minimum essential constraint. |
| `household_surveys` | GPS, minimum vulnerability/condition/access fields, consent, verification | Restricted field record with no Aadhaar field. |
| `relocation_priority_results` | weighted inputs, score/class, explanation, verification | Triage for official review only—not an order. |
| `data_sources` | organisation, URL, version, dates, resolution, frequency, licence, confidence | Mandatory provenance registry. |
| `data_import_jobs`, `audit_logs` | status/errors/rollback token; actor/action/state change | Controlled ingestion and accountability. |

## Score fields

- Static risk: hazard and intensity 40%, exposure 25%, vulnerability 20%, access weakness 15%.
- Immediate priority: official warning 25%, observed danger 25%, household vulnerability 20%, building weakness 15%, isolation 15%.
- Classes: 0–24 Low, 25–49 Moderate, 50–74 High, 75–100 Very High. Official hazard classifications override defaults.

## Provenance fields

Every imported dataset is linked to `data_sources`, which records source organisation/URL, version, collection/import dates, geographic resolution, update frequency, licence/restrictions, confidence, and last verification date.
