"""Explainable, calamity-aware shelter screening and ranking.

Satellite interpretations can warn, block or hold a site for verification, but
they never certify a shelter as safe. Surveyed levels, notified hazard records,
engineering/field inspections, routes, capacity and services remain mandatory.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


DisasterType = Literal["flood", "landslide", "earthquake", "cyclone", "heatwave", "wildfire"]
Decision = Literal["eligible", "verification_required", "rejected"]


WEIGHTS = {
    "hazard_safety": 0.45,
    "route_access": 0.20,
    "capacity": 0.15,
    "essential_services": 0.15,
    "proximity": 0.05,
}
SATELLITE_SHARE_OF_HAZARD = 0.20


@dataclass(frozen=True)
class Evaluation:
    shelter_id: str
    shelter_name: str
    decision: Decision
    score: int | None
    rank: int | None
    factor_scores: dict[str, int]
    reasons: list[str]
    blockers: list[str]
    missing_fields: list[str]
    data_confidence: int
    satellite_evidence: dict[str, Any] | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "shelter_id": self.shelter_id,
            "shelter_name": self.shelter_name,
            "decision": self.decision,
            "score": self.score,
            "rank": self.rank,
            "factor_scores": self.factor_scores,
            "reasons": self.reasons,
            "blockers": self.blockers,
            "missing_fields": self.missing_fields,
            "data_confidence": self.data_confidence,
            "satellite_evidence": self.satellite_evidence,
            "human_verification_required": True,
        }


def _level(value: str | None, *, low: int, moderate: int, high: int) -> int:
    return {"low": low, "moderate": moderate, "high": high}.get(value or "", 0)


def _condition(value: str | None, *, good: int = 100, limited: int = 60, poor: int = 20) -> int:
    return {"good": good, "limited": limited, "poor": poor}.get(value or "", 0)


def _verified(value: str | None) -> int:
    return {"verified": 100, "conditional": 60, "failed": 0}.get(value or "", 0)


def _boolean_score(value: bool | None, *, safe_when: bool = True) -> int:
    if value is None:
        return 0
    return 100 if value is safe_when else 0


def _required_missing(site: dict[str, Any], fields: list[str]) -> list[str]:
    return [field for field in fields if site.get(field) is None]


def _satellite_assessment(disaster: DisasterType, site: dict[str, Any]) -> tuple[int, list[str], list[str], list[str]]:
    """Score a supplied interpretation; absence or weak QA never means safe."""

    evidence = site.get("satellite_evidence")
    if not evidence:
        return 0, [], [], ["satellite_evidence"]
    if evidence.get("quality") == "unusable":
        return 0, [], [], ["satellite_image_quality"]

    missing: list[str] = []
    reasons: list[str] = []
    blockers: list[str] = []
    if evidence.get("mode") == "analyst_verified" and evidence.get("analyst_reviewed") is not True:
        missing.append("satellite_analyst_review")
    signal = (evidence.get("hazard_signals") or {}).get(disaster)
    if signal is None:
        return 0, reasons, blockers, [*missing, "satellite_hazard_signal"]
    if evidence.get("quality") == "limited":
        missing.append("satellite_image_quality")
    if signal == "unsafe":
        blockers.append("Satellite interpretation indicates an unsafe condition for the selected disaster.")
    elif signal == "watch":
        reasons.append("Satellite interpretation shows a warning signal that needs field confirmation.")
        missing.append("satellite_field_confirmation")
    else:
        reasons.append("No disaster-specific warning signal was identified in the supplied satellite interpretation.")
    signal_score = {"clear": 100, "watch": 55, "unsafe": 0}[signal]
    quality_score = 100 if evidence.get("quality") == "usable" else 55
    return round(signal_score * 0.80 + quality_score * 0.20), reasons, blockers, missing


def _hazard_assessment(disaster: DisasterType, site: dict[str, Any]) -> tuple[int, list[str], list[str], list[str]]:
    """Return hazard score, reasons, blockers and missing critical inputs."""

    reasons: list[str] = []
    blockers: list[str] = []
    missing: list[str] = []

    if disaster == "flood":
        required = ["surveyed_elevation_m", "planning_flood_level_m", "in_notified_floodplain", "drainage", "landslide_susceptibility"]
        missing = _required_missing(site, required)
        if missing:
            return 0, reasons, blockers, missing
        margin = float(site["surveyed_elevation_m"]) - float(site["planning_flood_level_m"])
        if margin <= 0:
            blockers.append("Ground level is not above the recorded planning flood level.")
        else:
            reasons.append("Surveyed ground is above the recorded planning flood level.")
        if site["in_notified_floodplain"]:
            blockers.append("Site is inside the recorded floodplain.")
        else:
            reasons.append("Site is outside the recorded floodplain.")
        if site["landslide_susceptibility"] == "high":
            blockers.append("The elevated site has high landslide susceptibility.")
        else:
            reasons.append("Slope stability is not marked high risk.")
        elevation_score = 0 if margin <= 0 else 35 if margin < 1 else 75 if margin < 3 else 100
        score = round(
            elevation_score * 0.40
            + _boolean_score(site["in_notified_floodplain"], safe_when=False) * 0.25
            + _condition(site["drainage"]) * 0.20
            + _level(site["landslide_susceptibility"], low=100, moderate=55, high=0) * 0.15
        )
        return score, reasons, blockers, missing

    if disaster == "landslide":
        required = ["landslide_susceptibility", "in_landslide_runout", "slope_stability", "structural_audit"]
        missing = _required_missing(site, required)
        if missing:
            return 0, reasons, blockers, missing
        if site["landslide_susceptibility"] == "high" or site["in_landslide_runout"]:
            blockers.append("Site is in a high-susceptibility or landslide run-out area.")
        else:
            reasons.append("Site is outside recorded high-susceptibility and run-out areas.")
        if site["slope_stability"] == "poor":
            blockers.append("Field or geotechnical slope condition is marked poor.")
        score = round(
            _level(site["landslide_susceptibility"], low=100, moderate=55, high=0) * 0.40
            + _boolean_score(site["in_landslide_runout"], safe_when=False) * 0.25
            + _condition(site["slope_stability"]) * 0.20
            + _verified(site["structural_audit"]) * 0.15
        )
        return score, reasons, blockers, missing

    if disaster == "earthquake":
        required = ["structural_audit", "seismic_compliance", "liquefaction_risk"]
        missing = _required_missing(site, required)
        if missing:
            return 0, reasons, blockers, missing
        if site["structural_audit"] == "failed" or site["seismic_compliance"] == "failed":
            blockers.append("Building failed the structural or seismic safety check.")
        else:
            reasons.append("Structural and seismic records do not show a failed check.")
        if site["liquefaction_risk"] == "high":
            blockers.append("Ground liquefaction risk is marked high.")
        score = round(
            _verified(site["structural_audit"]) * 0.45
            + _verified(site["seismic_compliance"]) * 0.40
            + _level(site["liquefaction_risk"], low=100, moderate=50, high=0) * 0.15
        )
        return score, reasons, blockers, missing

    if disaster == "cyclone":
        required = ["structural_audit", "wind_resistance", "in_storm_surge_zone", "drainage"]
        missing = _required_missing(site, required)
        if missing:
            return 0, reasons, blockers, missing
        if site["structural_audit"] == "failed" or site["wind_resistance"] == "failed":
            blockers.append("Building failed the structural or wind-resistance check.")
        if site["in_storm_surge_zone"]:
            blockers.append("Site is inside the recorded storm-surge zone.")
        else:
            reasons.append("Site is outside the recorded storm-surge zone.")
        score = round(
            _verified(site["wind_resistance"]) * 0.40
            + _verified(site["structural_audit"]) * 0.30
            + _boolean_score(site["in_storm_surge_zone"], safe_when=False) * 0.20
            + _condition(site["drainage"]) * 0.10
        )
        return score, reasons, blockers, missing

    if disaster == "heatwave":
        required = ["water_reliability", "backup_power", "ventilation", "medical_access"]
        missing = _required_missing(site, required)
        if missing:
            return 0, reasons, blockers, missing
        if site["water_reliability"] == "poor" or site["ventilation"] == "poor":
            blockers.append("Reliable drinking water or safe ventilation is inadequate.")
        else:
            reasons.append("Drinking water and ventilation checks are usable.")
        score = round(
            _condition(site["water_reliability"]) * 0.35
            + _condition(site["backup_power"]) * 0.20
            + _condition(site["ventilation"]) * 0.30
            + _condition(site["medical_access"]) * 0.15
        )
        return score, reasons, blockers, missing

    required = ["fire_clearance_m", "vegetation_risk", "structural_audit"]
    missing = _required_missing(site, required)
    if missing:
        return 0, reasons, blockers, missing
    if float(site["fire_clearance_m"]) < 30 or site["vegetation_risk"] == "high":
        blockers.append("Vegetation/fire-break clearance fails the configurable demo rule.")
    else:
        reasons.append("Recorded vegetation risk and clearance pass the demo rule.")
    clearance_score = min(100, round(float(site["fire_clearance_m"]) / 60 * 100))
    score = round(
        clearance_score * 0.35
        + _level(site["vegetation_risk"], low=100, moderate=55, high=0) * 0.40
        + _verified(site["structural_audit"]) * 0.25
    )
    return score, reasons, blockers, missing


def evaluate_shelters(disaster: DisasterType, people: int, shelters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Screen and rank shelters, leaving rejected/unknown sites unranked."""

    evaluated: list[Evaluation] = []
    for site in shelters:
        blockers: list[str] = []
        reasons: list[str] = []
        missing: list[str] = []

        if site.get("status") == "closed":
            blockers.append("Shelter is closed.")
        if int(site.get("available_capacity", 0)) < people:
            blockers.append("Available capacity does not cover the selected group.")
        else:
            reasons.append("Available capacity covers the selected group.")
        if site.get("route_safety") == "unsafe":
            blockers.append("Access route is marked unsafe.")
        elif site.get("route_safety") in {"clear", "caution"}:
            reasons.append("Access route has not been marked unsafe.")
        else:
            missing.append("route_safety")
        if site.get("land_verified") is not True:
            missing.append("land_verified")
        if site.get("structural_audit") == "failed":
            blockers.append("Shelter failed its structural audit.")

        field_hazard_score, hazard_reasons, hazard_blockers, hazard_missing = _hazard_assessment(disaster, site)
        satellite_score, satellite_reasons, satellite_blockers, satellite_missing = _satellite_assessment(disaster, site)
        reasons.extend(hazard_reasons)
        reasons.extend(satellite_reasons)
        blockers.extend(hazard_blockers)
        blockers.extend(satellite_blockers)
        missing.extend(hazard_missing)
        missing.extend(satellite_missing)
        missing = sorted(set(missing))

        hazard_score = round(
            field_hazard_score * (1 - SATELLITE_SHARE_OF_HAZARD)
            + satellite_score * SATELLITE_SHARE_OF_HAZARD
        )

        route_score = {"clear": 100, "caution": 55, "unsafe": 0}.get(site.get("route_safety"), 0)
        capacity_score = min(100, round(int(site.get("available_capacity", 0)) / max(1, people) * 100))
        services = [site.get("water_reliability"), site.get("sanitation"), site.get("backup_power"), site.get("medical_access")]
        known_services = [_condition(value) for value in services if value is not None]
        service_score = round(sum(known_services) / len(known_services)) if known_services else 0
        distance = max(0.0, float(site.get("distance_km", 0)))
        proximity_score = max(0, round(100 - min(100, distance * 5)))
        factor_scores = {
            "hazard_safety": hazard_score,
            "satellite_interpretation": satellite_score,
            "route_access": route_score,
            "capacity": capacity_score,
            "essential_services": service_score,
            "proximity": proximity_score,
        }
        score = round(sum(factor_scores[key] * weight for key, weight in WEIGHTS.items()))
        base_confidence = int(site.get("data_confidence", 70))
        confidence = max(0, min(100, base_confidence - len(missing) * 12))
        decision: Decision = "rejected" if blockers else "verification_required" if missing else "eligible"
        evaluated.append(Evaluation(
            shelter_id=str(site["id"]),
            shelter_name=str(site["name"]),
            decision=decision,
            score=score if decision == "eligible" else None,
            rank=None,
            factor_scores=factor_scores,
            reasons=reasons,
            blockers=blockers,
            missing_fields=missing,
            data_confidence=confidence,
            satellite_evidence=site.get("satellite_evidence"),
        ))

    eligible = sorted((item for item in evaluated if item.decision == "eligible"), key=lambda item: (-int(item.score or 0), item.shelter_name))
    rank_by_id = {item.shelter_id: index + 1 for index, item in enumerate(eligible)}
    ordered = sorted(evaluated, key=lambda item: ({"eligible": 0, "verification_required": 1, "rejected": 2}[item.decision], -int(item.score or 0), item.shelter_name))
    return [Evaluation(**{**item.__dict__, "rank": rank_by_id.get(item.shelter_id)}).to_dict() for item in ordered]
