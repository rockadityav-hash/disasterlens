# Calamity-aware, satellite-assisted shelter identification

SurakshaSetu combines a disaster-specific satellite interpretation with ground, official, engineering, route, capacity and service evidence. It is a decision-support workflow, not an automatic evacuation system. Satellite evidence may warn, reject or hold a site for verification; it cannot certify a shelter as safe.

## Decision flow

1. Select the calamity and the number of people who need accommodation.
2. Apply hard safety gates. A closed shelter, unsafe route, insufficient capacity, failed structural audit, unsafe hazard location, or missing critical evidence cannot receive a rank.
3. Interpret the satellite signal for the selected disaster. Missing, unusable or unreviewed operational imagery keeps the site out of the ranked shortlist. An unsafe signal blocks it; a watch signal requires field confirmation.
4. Score only eligible shelters: disaster safety 45%, route/access 20%, usable capacity 15%, essential services 15%, and distance 5%. Within disaster safety, the field/official assessment contributes 80% and the satellite interpretation 20%.
5. Return the rank, factor scores, reasons, blockers, missing evidence, confidence, imagery source, scene ID, capture date, sensor, resolution and quality.
6. Require an authorised officer to verify dated records and field conditions before using the result.

Being on higher ground is not enough for a flood. The ground must be above the recorded planning flood level and outside the recorded floodplain, while the slope, route, structure, capacity, and basic services must also be safe.

## Satellite interpretation by disaster

| Disaster | Satellite-derived warning signal | Decision boundary |
|---|---|---|
| Flood | Surface water or inundation from radar/derived flood products | A non-detection is unknown outside the observed footprint; it never proves the site or route is dry. |
| Landslide | Slope/ground change or a derived landslide product | Satellite screening does not replace site-specific geological and geotechnical checks. |
| Earthquake | Post-event surface change or damage proxy | Satellites do not predict earthquakes or determine whether a building is safe to occupy. |
| Cyclone | Inundation or storm-impact proxy | Official IMD/NDMA warnings remain the trigger; cloud imagery alone does not define evacuation zones. |
| Heat wave | Land-surface temperature anomaly | Land-surface temperature is not air temperature, heat index or proof of adequate cooling. |
| Wildfire | Thermal hotspot or burn-area signal | A hotspot is not a fire perimeter and cannot confirm that an evacuation route is clear. |

The interface uses `DEMO-SAT-*` scene IDs and clearly labelled synthetic interpretations so that every state can demonstrate the workflow without pretending that a live imagery pipeline is connected. The API also accepts analyst-verified evidence for future integration.

Useful official imagery and product references:

- [Copernicus Data Space STAC API](https://documentation.dataspace.copernicus.eu/APIs/STAC.html)
- [Copernicus Browser](https://browser.dataspace.copernicus.eu/)
- [NASA Worldview](https://worldview.earthdata.nasa.gov/)
- [NASA GIBS access documentation](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)
- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/)
- [ISRO Disaster Management Support](https://www.isro.gov.in/DisasterManagementSupport.html)

## Ground and official evidence

| Check | Expected evidence | Example authority |
|---|---|---|
| Ground and flood levels | Total-station/DGPS survey, benchmarked reduced levels, design or historical flood level | State Irrigation/Flood Control department, Central Water Commission, authorised land survey |
| Floodplain status and drainage | Notified floodplain map, municipal/drainage inspection, waterlogging record | CWC, State/UT nodal agency, ULB or Panchayat |
| Slope and landslide safety | Susceptibility/inventory record plus site-specific geological or geotechnical check | Geological Survey of India, State geology department |
| Route safety | Dated road/bridge status and field verification | PWD, district control room, authorised field team |
| Structural safety | Signed structural audit and applicable BIS-code compliance | Competent government/empanelled structural engineer |
| Capacity and services | Usable capacity, WASH, power, ventilation, medical access, current occupancy | District shelter register, local body, IDRN/resource inventory, field audit |

Useful official references:

- [NDMA National Guidelines for Temporary Shelters](https://nidm.gov.in/PDF/pubs/NDMA/24.pdf)
- [Central Water Commission](https://cwc.gov.in/)
- [GSI Bhusanket landslide hazard portal](https://bhusanket.gsi.gov.in/LS_hazard.html)
- [India Disaster Resource Network](https://idrn.nidm.gov.in/About/Index)

## Fail-safe behaviour

- `eligible`: all required checks are present and no hard safety rule failed.
- `verification_required`: a critical record is missing or land status is not verified; the site remains unranked.
- `rejected`: at least one hard safety rule failed; the site remains unranked.

The local interface currently uses clearly labelled synthetic measurements so the workflow can be demonstrated. Those values must be replaced with authorised, dated records before operational use.
