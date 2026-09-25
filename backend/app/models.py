from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class StaticRiskInput(BaseModel):
    hazard: float = Field(ge=0, le=100)
    exposure: float = Field(ge=0, le=100)
    vulnerability: float = Field(ge=0, le=100)
    access_weakness: float = Field(ge=0, le=100)


class PriorityInput(BaseModel):
    active_warning: float = Field(ge=0, le=100)
    observed_danger: float = Field(ge=0, le=100)
    household_vulnerability: float = Field(ge=0, le=100)
    building_weakness: float = Field(ge=0, le=100)
    isolation: float = Field(ge=0, le=100)


class CapacityInput(BaseModel):
    housing: int = Field(ge=0)
    water: int = Field(ge=0)
    sanitation: int = Field(ge=0)
    health: int = Field(ge=0)
    school: int = Field(ge=0)
    road_access: int = Field(ge=0)
    current_population: int = Field(default=0, ge=0)
    allocated_relocatees: int = Field(default=0, ge=0)
    legally_available: bool = True


class RedZoneRiskInput(BaseModel):
    hazard: float = Field(ge=0, le=100)
    human_exposure: float = Field(ge=0, le=100)
    evacuation_vulnerability: float = Field(ge=0, le=100)
    critical_infrastructure: float = Field(ge=0, le=100)
    economic_assets: float = Field(ge=0, le=100)


class ConfidenceInput(BaseModel):
    source_reliability: float = Field(ge=0, le=100)
    recency: float = Field(ge=0, le=100)
    completeness: float = Field(ge=0, le=100)
    cross_source_agreement: float = Field(ge=0, le=100)
    field_verification: float = Field(ge=0, le=100)


class RiskWeightsInput(BaseModel):
    hazard: float = Field(ge=0, le=1)
    human_exposure: float = Field(ge=0, le=1)
    evacuation_vulnerability: float = Field(ge=0, le=1)
    critical_infrastructure: float = Field(ge=0, le=1)
    economic_assets: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def total_is_one(self):
        if abs(sum(self.model_dump().values()) - 1.0) > 0.0001:
            raise ValueError("weights must add up to 1.0")
        return self


class Coordinate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class RouteInput(BaseModel):
    origin: Coordinate
    destination: Coordinate
    travel_mode: Literal["DRIVE", "WALK", "BICYCLE", "TWO_WHEELER"] = "DRIVE"
    compute_alternatives: bool = True


class FieldSurveyInput(BaseModel):
    state: str = Field(min_length=2, max_length=80)
    location: str = Field(min_length=2, max_length=160)
    coordinates: Coordinate
    survey_time: datetime
    officer_identifier: str = Field(min_length=3, max_length=100)
    risk_observations: str = Field(default="", max_length=4000)
    shelter_condition: Literal["usable", "limited", "unsafe", "unknown"] = "unknown"
    road_accessibility: Literal["open", "restricted", "blocked", "unknown"] = "unknown"
    affected_population: int = Field(ge=0)
    notes: str = Field(default="", max_length=4000)
    photo_references: list[str] = Field(default_factory=list, max_length=10)
    verification_status: Literal["pending", "field_checked", "verified"] = "pending"
    consent_acknowledged: bool


class SatelliteEvidenceInput(BaseModel):
    mode: Literal["synthetic_demo", "analyst_verified"]
    source_name: str = Field(min_length=2, max_length=200)
    sensor: Literal["optical", "sar", "derived_product"]
    scene_id: str = Field(min_length=2, max_length=200)
    captured_at: str = Field(min_length=4, max_length=80)
    analysis_radius_m: int = Field(gt=0, le=100_000)
    resolution_m: float | None = Field(default=None, gt=0)
    quality: Literal["usable", "limited", "unusable"]
    analyst_reviewed: bool = False
    hazard_signals: dict[Literal["flood", "landslide", "earthquake", "cyclone", "heatwave", "wildfire"], Literal["clear", "watch", "unsafe"]]
    source_url: str | None = Field(default=None, max_length=1000)


class ShelterSafetyInput(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=2, max_length=200)
    status: Literal["open", "limited", "closed"]
    available_capacity: int = Field(ge=0)
    route_safety: Literal["clear", "caution", "unsafe"] | None = None
    land_verified: bool | None = None
    distance_km: float = Field(ge=0)
    data_confidence: int = Field(default=70, ge=0, le=100)

    # Surveyed or officially recorded inputs. None means "not verified", never
    # zero. The recommender keeps such a site out of the ranked shortlist.
    surveyed_elevation_m: float | None = None
    planning_flood_level_m: float | None = None
    in_notified_floodplain: bool | None = None
    drainage: Literal["good", "limited", "poor"] | None = None
    landslide_susceptibility: Literal["low", "moderate", "high"] | None = None
    in_landslide_runout: bool | None = None
    slope_stability: Literal["good", "limited", "poor"] | None = None
    structural_audit: Literal["verified", "conditional", "failed"] | None = None
    seismic_compliance: Literal["verified", "conditional", "failed"] | None = None
    liquefaction_risk: Literal["low", "moderate", "high"] | None = None
    wind_resistance: Literal["verified", "conditional", "failed"] | None = None
    in_storm_surge_zone: bool | None = None
    water_reliability: Literal["good", "limited", "poor"] | None = None
    sanitation: Literal["good", "limited", "poor"] | None = None
    backup_power: Literal["good", "limited", "poor"] | None = None
    ventilation: Literal["good", "limited", "poor"] | None = None
    medical_access: Literal["good", "limited", "poor"] | None = None
    fire_clearance_m: float | None = Field(default=None, ge=0)
    vegetation_risk: Literal["low", "moderate", "high"] | None = None
    satellite_evidence: SatelliteEvidenceInput | None = None


class ShelterRecommendationInput(BaseModel):
    disaster: Literal["flood", "landslide", "earthquake", "cyclone", "heatwave", "wildfire"]
    people: int = Field(gt=0, le=1_000_000)
    shelters: list[ShelterSafetyInput] = Field(min_length=1, max_length=500)


class HazardShelterPoint(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=2, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class HazardShelterScreenInput(BaseModel):
    state: str = Field(min_length=2, max_length=80)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    shelters: list[HazardShelterPoint] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def anchor_is_complete(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be supplied together")
        return self
