"""USGS earthquake GeoJSON adapter.

USGS geometries are retained as official epicentre points. The adapter never
turns magnitude or distance into an official hazard-area polygon.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any, Callable

from .base import HazardFeedAdapter, HazardFetchResult
from .http import HttpDocument, fetch_url


DEFAULT_USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
MAX_JSON_BYTES = 5_000_000


def _as_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _iso_from_epoch_milliseconds(value: Any) -> str | None:
    try:
        parsed = datetime.fromtimestamp(float(value) / 1000, tz=timezone.utc)
    except (TypeError, ValueError, OverflowError, OSError):
        return None
    return parsed.isoformat().replace("+00:00", "Z")


def _severity(magnitude: float | None) -> str:
    if magnitude is None:
        return "unknown"
    if magnitude >= 7:
        return "extreme"
    if magnitude >= 6:
        return "severe"
    if magnitude >= 5:
        return "moderate"
    return "minor"


def normalize_usgs_feature(feature: Any, *, fetched_at: datetime, feed_url: str) -> dict[str, Any] | None:
    if not isinstance(feature, dict) or feature.get("type") != "Feature":
        return None
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "Point":
        return None
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return None
    try:
        longitude = float(coordinates[0])
        latitude = float(coordinates[1])
    except (TypeError, ValueError):
        return None
    if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
        return None

    properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
    external_id = str(feature.get("id") or properties.get("code") or "").strip()
    if not external_id:
        return None
    magnitude: float | None
    try:
        magnitude = float(properties["mag"]) if properties.get("mag") is not None else None
    except (TypeError, ValueError):
        magnitude = None
    event_url = str(properties.get("url") or feed_url)
    place = str(properties.get("place") or "Location not supplied by USGS")
    occurred_at = _iso_from_epoch_milliseconds(properties.get("time"))
    title = str(properties.get("title") or f"M {magnitude:g} earthquake — {place}" if magnitude is not None else f"Earthquake — {place}")
    normalized_coordinates: list[float] = [longitude, latitude]
    if len(coordinates) >= 3:
        try:
            normalized_coordinates.append(float(coordinates[2]))
        except (TypeError, ValueError):
            pass
    fetched_iso = fetched_at.isoformat().replace("+00:00", "Z")
    return {
        "type": "Feature",
        "id": f"usgs:{external_id}",
        "geometry": {"type": "Point", "coordinates": normalized_coordinates},
        "properties": {
            "external_id": external_id,
            "title": title,
            "description": place,
            "hazard_type": "earthquake",
            "severity": _severity(magnitude),
            "urgency": "past",
            "certainty": "observed",
            "status": "Observed",
            "scope": "Public",
            "issued_at": occurred_at,
            "effective_at": occurred_at,
            "expires_at": None,
            "is_active": True,
            "state": None,
            "area_description": place,
            "source_id": "usgs-earthquakes",
            "source_name": "U.S. Geological Survey",
            "source_url": event_url,
            "verification_status": "supplemental_official_source",
            "geometry_origin": "official_point",
            "synthetic": False,
            "record_type": "event",
            "magnitude": magnitude,
            "provenance": {
                "fetched_at": fetched_iso,
                "original_format": "USGS GeoJSON",
                "source_identifier": external_id,
                "transformation": "Official USGS epicentre retained as a Point; no hazard radius or polygon inferred",
            },
        },
    }


class UsgsEarthquakeAdapter(HazardFeedAdapter):
    source_id = "usgs-earthquakes"
    source_name = "U.S. Geological Survey"
    official = True

    def __init__(
        self,
        source_url: str = DEFAULT_USGS_URL,
        *,
        fetcher: Callable[..., HttpDocument] = fetch_url,
        timeout: float = 5.0,
        max_features: int = 2_000,
    ) -> None:
        self.source_url = source_url
        self._fetcher = fetcher
        self._timeout = max(0.5, timeout)
        self._max_features = max(1, min(max_features, 20_000))

    def fetch(self, *, etag: str | None = None, now: datetime | None = None) -> HazardFetchResult:
        checked_at = _as_utc(now or datetime.now(timezone.utc))
        headers = {"If-None-Match": etag} if etag else None
        document = self._fetcher(self.source_url, headers=headers, timeout=self._timeout, max_bytes=MAX_JSON_BYTES)
        response_etag = document.headers.get("etag") or etag
        if document.status == 304:
            return HazardFetchResult([], checked_at, etag=response_etag, not_modified=True)
        if not document.body or len(document.body) > MAX_JSON_BYTES:
            raise ValueError("USGS response is empty or too large.")
        try:
            payload = json.loads(document.body)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("USGS returned malformed JSON.") from error
        if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
            raise ValueError("USGS response is not a GeoJSON FeatureCollection.")

        normalized: dict[str, dict[str, Any]] = {}
        warnings: list[str] = []
        for raw_feature in payload["features"][: self._max_features]:
            feature = normalize_usgs_feature(raw_feature, fetched_at=checked_at, feed_url=document.final_url)
            if feature:
                normalized[str(feature["id"])] = feature
            else:
                warnings.append("Skipped one invalid USGS feature.")
        return HazardFetchResult(list(normalized.values()), checked_at, etag=response_etag, warnings=tuple(warnings[:20]))
