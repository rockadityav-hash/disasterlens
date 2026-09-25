from dataclasses import asdict, dataclass
from typing import Mapping


def clamp(value: float) -> float:
    return round(max(0.0, min(100.0, float(value))), 2)


def classify_risk(score: float) -> str:
    if score >= 75:
        return "Very High"
    if score >= 50:
        return "High"
    if score >= 25:
        return "Moderate"
    return "Low"


@dataclass(frozen=True)
class ScoreResult:
    score: float
    classification: str
    contributions: dict[str, float]
    official_verification_required: bool = True

    def to_dict(self) -> dict:
        return asdict(self)


STATIC_WEIGHTS = {
    "hazard": 0.40,
    "exposure": 0.25,
    "vulnerability": 0.20,
    "access_weakness": 0.15,
}

PRIORITY_WEIGHTS = {
    "active_warning": 0.25,
    "observed_danger": 0.25,
    "household_vulnerability": 0.20,
    "building_weakness": 0.15,
    "isolation": 0.15,
}

# Human exposure and evacuation vulnerability together receive 55% of the score.
# This keeps life safety ahead of property or economic loss in red-zone review.
RED_ZONE_WEIGHTS = {
    "hazard": 0.25,
    "human_exposure": 0.30,
    "evacuation_vulnerability": 0.25,
    "critical_infrastructure": 0.12,
    "economic_assets": 0.08,
}

CONFIDENCE_WEIGHTS = {
    "source_reliability": 0.30,
    "recency": 0.20,
    "completeness": 0.20,
    "cross_source_agreement": 0.15,
    "field_verification": 0.15,
}


def weighted_score(inputs: Mapping[str, float], weights: Mapping[str, float]) -> ScoreResult:
    missing = set(weights) - set(inputs)
    if missing:
        raise ValueError(f"Missing score inputs: {', '.join(sorted(missing))}")
    contributions = {key: round(clamp(inputs[key]) * weight, 2) for key, weight in weights.items()}
    score = clamp(sum(contributions.values()))
    return ScoreResult(score, classify_risk(score), contributions)


def calculate_static_risk(hazard: float, exposure: float, vulnerability: float, access_weakness: float) -> ScoreResult:
    """Explainable 0–100 static risk using district-configurable default weights."""
    return weighted_score(locals(), STATIC_WEIGHTS)


def calculate_immediate_priority(active_warning: float, observed_danger: float, household_vulnerability: float, building_weakness: float, isolation: float) -> ScoreResult:
    """Immediate official-review priority; never an automatic evacuation instruction."""
    return weighted_score(locals(), PRIORITY_WEIGHTS)


def validate_weights(weights: Mapping[str, float], expected_keys: set[str]) -> dict[str, float]:
    if set(weights) != expected_keys:
        missing = expected_keys - set(weights)
        extra = set(weights) - expected_keys
        raise ValueError(f"Weight keys do not match. Missing: {sorted(missing)}; extra: {sorted(extra)}")
    if any(value < 0 or value > 1 for value in weights.values()):
        raise ValueError("Each weight must be between 0 and 1")
    if abs(sum(weights.values()) - 1.0) > 0.0001:
        raise ValueError("Weights must add up to 1.0")
    return {key: round(float(value), 4) for key, value in weights.items()}


def calculate_red_zone_risk(
    hazard: float,
    human_exposure: float,
    evacuation_vulnerability: float,
    critical_infrastructure: float,
    economic_assets: float,
    weights: Mapping[str, float] | None = None,
) -> ScoreResult:
    """Human-safety-first red-zone review score; never an automatic order."""
    factors = {
        "hazard": hazard,
        "human_exposure": human_exposure,
        "evacuation_vulnerability": evacuation_vulnerability,
        "critical_infrastructure": critical_infrastructure,
        "economic_assets": economic_assets,
    }
    configured = validate_weights(weights or RED_ZONE_WEIGHTS, set(RED_ZONE_WEIGHTS))
    return weighted_score(factors, configured)


def calculate_confidence(
    source_reliability: float,
    recency: float,
    completeness: float,
    cross_source_agreement: float,
    field_verification: float,
) -> ScoreResult:
    """Measurable confidence from provenance, freshness, coverage and verification."""
    result = weighted_score(locals(), CONFIDENCE_WEIGHTS)
    label = "High" if result.score >= 80 else "Medium" if result.score >= 55 else "Low"
    return ScoreResult(result.score, label, result.contributions, True)
