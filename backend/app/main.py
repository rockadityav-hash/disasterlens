import os

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .capacity import calculate_capacity
from .connectors import connector_catalogue, demo_import_jobs
from .hazard_service import hazard_service, screen_shelters
from .models import CapacityInput, ConfidenceInput, FieldSurveyInput, HazardShelterScreenInput, PriorityInput, RedZoneRiskInput, RiskWeightsInput, RouteInput, ShelterRecommendationInput, StaticRiskInput
from .nationwide_reference import SOURCE_REGISTER, STATE_REFERENCES, find_state_reference
from .routes import compute_google_routes
from .sample_data import ALERTS, DATA_SOURCES, VILLAGES
from .scoring import RED_ZONE_WEIGHTS, calculate_confidence, calculate_immediate_priority, calculate_red_zone_risk, calculate_static_risk
from .shelter_recommendation import WEIGHTS as SHELTER_WEIGHTS, evaluate_shelters

app = FastAPI(
    title="SurakshaSetu API",
    version="1.0.0",
    description="Explainable hazard, capacity and official-review prioritisation API. Outputs are decision support only.",
)
cors_origins = os.getenv("CORS_ORIGINS", "").strip() or "http://localhost:5173"
app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Demonstration configuration store. Production must persist versioned weights in
# the database and audit every administrator change.
risk_weights = dict(RED_ZONE_WEIGHTS)


def demo_role(x_demo_role: str = Header(default="district_officer")) -> str:
    allowed = {"public", "field_surveyor", "district_officer", "data_manager", "administrator"}
    if x_demo_role not in allowed:
        raise HTTPException(status_code=403, detail="Unknown demo role")
    return x_demo_role


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "surakshasetu-api",
        "synthetic_data": True,
        "hazard_integration": "NDMA SACHET live CAP/RSS with supplemental USGS points and dated Bhuvan WMS references",
    }


@app.get("/api/v1/dashboard")
def dashboard(_: str = Depends(demo_role)) -> dict:
    return {"district":"Rudraprayag","state":"Uttarakhand","synthetic_data":True,"population_exposed":18420,"high_very_high_habitations":8,"critical_cases":4,"shelter_spaces":2760,"data_confidence":87,"alerts":ALERTS,"official_verification_required":True}


@app.get("/api/v1/villages")
def list_villages(_: str = Depends(demo_role)) -> dict:
    return {"items":VILLAGES,"count":len(VILLAGES),"synthetic_data":True}


@app.get("/api/v1/villages/{lgd_code}")
def get_village(lgd_code: str, _: str = Depends(demo_role)) -> dict:
    village = next((item for item in VILLAGES if item["lgd_code"] == lgd_code), None)
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")
    return {**village,"source_lineage":DATA_SOURCES,"official_verification_required":True}


@app.get("/api/v1/alerts")
def alerts(_: str = Depends(demo_role)) -> dict:
    return {"items":[item for item in ALERTS if item["is_active"]],"expired_alerts_excluded":True}


@app.get("/api/v1/data-sources")
def data_sources(_: str = Depends(demo_role)) -> dict:
    return {"items":DATA_SOURCES,"count":len(DATA_SOURCES)}


@app.get("/api/v1/states")
def list_state_references(_: str = Depends(demo_role)) -> dict:
    return {
        "items": STATE_REFERENCES,
        "count": len(STATE_REFERENCES),
        "reference_period": "Population Census 2011",
        "snapshot_prepared": "2026-09-02",
        "operational": False,
    }


@app.get("/api/v1/states/{state_name}")
def get_state_reference(state_name: str, _: str = Depends(demo_role)) -> dict:
    item = find_state_reference(state_name)
    if not item:
        raise HTTPException(status_code=404, detail="State or union territory not found")
    return {
        **item,
        "sources": SOURCE_REGISTER,
        "operational": False,
        "risk_score": None,
        "verified_shelter_occupancy": None,
        "notice": "Reference baseline only. Current hazard evidence and authorised local records are required for operational use.",
    }


@app.get("/api/v1/hazards/snapshot")
def hazard_snapshot(
    state: str = Query(min_length=2, max_length=80),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    force_refresh: bool = False,
    _: str = Depends(demo_role),
) -> dict:
    """Return source-labelled live alerts/events and dated static references."""

    reference = find_state_reference(state)
    if not reference:
        raise HTTPException(status_code=404, detail="State or union territory not found")
    if (latitude is None) != (longitude is None):
        raise HTTPException(status_code=422, detail="latitude and longitude must be supplied together")
    return hazard_service.snapshot(
        reference["name"],
        latitude,
        longitude,
        force_refresh=force_refresh,
    )


@app.post("/api/v1/hazards/screen-shelters")
def screen_hazard_shelters(payload: HazardShelterScreenInput, _: str = Depends(demo_role)) -> dict:
    """Check shelter points only against official CAP geometry; never certify safety."""

    reference = find_state_reference(payload.state)
    if not reference:
        raise HTTPException(status_code=404, detail="State or union territory not found")
    snapshot = hazard_service.snapshot(reference["name"], payload.latitude, payload.longitude)
    return screen_shelters(snapshot, [item.model_dump() for item in payload.shelters])


@app.post("/api/v1/scoring/static-risk")
def static_risk(payload: StaticRiskInput, _: str = Depends(demo_role)) -> dict:
    return calculate_static_risk(**payload.model_dump()).to_dict()


@app.post("/api/v1/scoring/immediate-priority")
def immediate_priority(payload: PriorityInput, _: str = Depends(demo_role)) -> dict:
    result = calculate_immediate_priority(**payload.model_dump()).to_dict()
    result["notice"] = "Official verification required. This is not an evacuation order."
    return result


@app.post("/api/v1/capacity")
def capacity(payload: CapacityInput, _: str = Depends(demo_role)) -> dict:
    values = payload.model_dump()
    current = values.pop("current_population")
    allocated = values.pop("allocated_relocatees")
    legal = values.pop("legally_available")
    return calculate_capacity(values, current, allocated, legal).to_dict()


@app.post("/api/v1/shelters/recommend")
def recommend_shelters(payload: ShelterRecommendationInput, _: str = Depends(demo_role)) -> dict:
    """Screen first, then rank; unknown critical evidence is never treated as safe."""
    results = evaluate_shelters(
        payload.disaster,
        payload.people,
        [item.model_dump() for item in payload.shelters],
    )
    return {
        "disaster": payload.disaster,
        "people": payload.people,
        "items": results,
        "ranked_count": sum(item["decision"] == "eligible" for item in results),
        "weights": SHELTER_WEIGHTS,
        "satellite_evidence_considered": any(item.satellite_evidence is not None for item in payload.shelters),
        "satellite_evidence_count": sum(item.satellite_evidence is not None for item in payload.shelters),
        "satellite_data_live": False,
        "satellite_policy": "Satellite interpretations may warn, reject, or require verification. A non-detection never certifies shelter safety.",
        "input_policy": "Satellite interpretation plus surveyed levels, notified hazard records, engineering and field checks, road status, capacity and service audits.",
        "notice": "Decision support only. Authorised field verification is required before opening a shelter or moving people.",
    }


@app.post("/api/v1/scoring/red-zone")
def red_zone_risk(payload: RedZoneRiskInput, _: str = Depends(demo_role)) -> dict:
    result = calculate_red_zone_risk(**payload.model_dump(), weights=risk_weights).to_dict()
    result.update({"weights": risk_weights, "notice": "Human review and official verification are required. This is not an evacuation order."})
    return result


@app.post("/api/v1/scoring/confidence")
def confidence(payload: ConfidenceInput, _: str = Depends(demo_role)) -> dict:
    result = calculate_confidence(**payload.model_dump()).to_dict()
    result["method"] = "source reliability 30%, recency 20%, completeness 20%, cross-source agreement 15%, field verification 15%"
    return result


@app.get("/api/v1/admin/risk-weights")
def get_risk_weights(_: str = Depends(demo_role)) -> dict:
    return {"weights": risk_weights, "total": round(sum(risk_weights.values()), 4), "scope": "demonstration process memory"}


@app.put("/api/v1/admin/risk-weights")
def update_risk_weights(payload: RiskWeightsInput, role: str = Depends(demo_role)) -> dict:
    if role != "administrator":
        raise HTTPException(status_code=403, detail="Administrator role required to change risk weights")
    risk_weights.update(payload.model_dump())
    return {"weights": risk_weights, "total": round(sum(risk_weights.values()), 4), "audit_required": True}


@app.get("/api/v1/connectors/status")
def connector_status(_: str = Depends(demo_role)) -> dict:
    items = connector_catalogue()
    return {
        "items": items,
        "count": len(items),
        "live_connectors": sum(item["status"] == "configured_live" for item in items),
        "demonstration_connectors": sum(item["status"] == "available" and item["id"].startswith("demo-") for item in items),
    }


@app.get("/api/v1/import-jobs")
def import_jobs(state: str | None = None, _: str = Depends(demo_role)) -> dict:
    items = demo_import_jobs(state)
    return {"items": items, "count": len(items), "poll_after_seconds": 15}


@app.post("/api/v1/routes/compute")
def compute_routes(payload: RouteInput, _: str = Depends(demo_role)) -> dict:
    return compute_google_routes(payload)


@app.post("/api/v1/field-surveys", status_code=202)
def submit_field_survey(payload: FieldSurveyInput, role: str = Depends(demo_role)) -> dict:
    if role not in {"field_surveyor", "district_officer", "administrator"}:
        raise HTTPException(status_code=403, detail="Field surveyor or officer role required")
    if not payload.consent_acknowledged:
        raise HTTPException(status_code=422, detail="Consent acknowledgement is required")
    # Surveys are recorded as a separate evidence layer. They never overwrite an
    # official source; an authorised reconciliation job must accept/reject impacts.
    confidence_effect = "eligible_after_authorised_verification" if payload.verification_status == "verified" else "none_until_verified"
    return {
        "status": "accepted_for_review",
        "state": payload.state,
        "location": payload.location,
        "survey_time": payload.survey_time,
        "provenance": {"type": "field_survey", "officer_identifier": payload.officer_identifier, "verification_status": payload.verification_status},
        "confidence_effect": confidence_effect,
        "official_data_overwritten": False,
        "notice": "Authorised reconciliation is required before risk or confidence values change.",
    }
