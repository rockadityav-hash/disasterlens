"""Honest, failure-isolated hazard snapshot and shelter-zone screening.

The service combines three deliberately different evidence classes:

* NDMA SACHET CAP alerts are official alerts. Publisher-supplied polygons and
  circles may be drawn as zones; area text is never geocoded into a polygon.
* USGS earthquakes are supplemental observed epicentre points. They are never
  expanded into an impact or red-zone radius.
* Bhuvan WMS layers are dated historical raster references. They are displayed
  by the map, but are not treated as a current alert or used for point-in-zone
  shelter screening.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import os
import re
from threading import RLock
from typing import Any, Callable

from .adapters import HazardFeedAdapter, HazardFetchResult, NdmaSachetAdapter, UsgsEarthquakeAdapter
from .adapters.geo import geometry_covers_point, haversine_km
from .nationwide_reference import find_state_reference


NDMA_SOURCE_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
USGS_SOURCE_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
BHUVAN_FLOOD_WMS_URL = "https://bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe"
BHUVAN_FLOOD_CAPABILITIES_URL = f"{BHUVAN_FLOOD_WMS_URL}?SERVICE=WMS&REQUEST=GetCapabilities"


# These names come from the public Bhuvan WMS capabilities document. They are
# event/year layers, not live inundation maps and not official red-zone orders.
_BHUVAN_HISTORICAL_FLOOD_LAYERS: dict[str, tuple[str, str]] = {
    "andhra pradesh": ("ap_281013_flood", "Andhra Pradesh flood extent · 28 Oct 2013"),
    "assam": ("as_fld_2010", "Assam flood extent · 2010"),
    "bihar": ("br_fld_2010", "Bihar flood extent · 2010"),
    "maharashtra": ("mh_020813_flood", "Maharashtra flood extent · 02 Aug 2013"),
    "odisha": ("or_12161013_flood", "Odisha flood extent · 12–16 Oct 2013"),
    "punjab": ("punjab_flood", "Punjab historical flood extent"),
    "tamil nadu": ("tn_011112_flood", "Tamil Nadu flood extent · 01 Nov 2012"),
    "west bengal": ("wb_281013_flood", "West Bengal flood extent · 28 Oct 2013"),
}


_STATE_ALIASES: dict[str, tuple[str, ...]] = {
    "andaman and nicobar islands": ("andaman & nicobar islands", "andaman nicobar"),
    "dadra and nagar haveli and daman and diu": ("dadra & nagar haveli and daman & diu",),
    "delhi": ("nct of delhi", "national capital territory of delhi"),
    "jammu and kashmir": ("jammu & kashmir", "j&k"),
    "odisha": ("orissa",),
    "puducherry": ("pondicherry",),
    "uttarakhand": ("uttaranchal",),
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    aware = value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return aware.isoformat().replace("+00:00", "Z")


def _parse_iso(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _normalise_words(value: str) -> str:
    return " ".join(re.sub(r"[^\w]+", " ", value.casefold(), flags=re.UNICODE).split())


def state_match_terms(state: str) -> tuple[str, ...]:
    canonical = _normalise_words(state)
    aliases = _STATE_ALIASES.get(canonical, ())
    return tuple(dict.fromkeys((canonical, *(_normalise_words(alias) for alias in aliases))))


def ndma_candidate_terms(state: str) -> tuple[str, ...]:
    """Return broad RSS pre-filter terms; final state filtering stays strict.

    SACHET RSS summaries sometimes name districts while their issuing centre
    names the state capital. A unique capital is useful for deciding which CAP
    documents to inspect, but is never itself accepted as proof that an alert
    applies to the state. Shared capitals are safe at this pre-filter stage:
    the normalized CAP state/area fields are still checked strictly afterward.
    """

    terms = list(state_match_terms(state))
    reference = find_state_reference(state)
    if reference:
        capital = _normalise_words(str(reference.get("capital") or ""))
        if capital:
            terms.append(capital)
    return tuple(dict.fromkeys(terms))


def _contains_term(text: str, term: str) -> bool:
    padded = f" {_normalise_words(text)} "
    return f" {term} " in padded


def _feature_matches_state(feature: dict[str, Any], state: str) -> bool:
    properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
    terms = state_match_terms(state)
    declared_state = str(properties.get("state") or "").strip()
    if declared_state:
        declared = _normalise_words(declared_state)
        if declared in {"india", "all india", "pan india", "nationwide"}:
            return True
        return any(_contains_term(declared_state, term) for term in terms)

    searchable = " ".join(
        str(properties.get(field) or "")
        for field in ("title", "area_description", "description", "feed_context")
    )
    normalised = _normalise_words(searchable)
    if any(global_term in f" {normalised} " for global_term in (" all india ", " pan india ", " nationwide ")):
        return True
    return any(_contains_term(searchable, term) for term in terms)


def _feature_active_at(feature: dict[str, Any], now: datetime) -> bool:
    properties = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
    if properties.get("is_active") is not True:
        return False
    effective_at = _parse_iso(properties.get("effective_at"))
    expires_at = _parse_iso(properties.get("expires_at"))
    return not ((effective_at and effective_at > now) or (expires_at and expires_at <= now))


def _bounded_float_env(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return min(maximum, max(minimum, value))


def _bounded_int_env(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return min(maximum, max(minimum, value))


def static_layers_for_state(state: str) -> list[dict[str, Any]]:
    layer = _BHUVAN_HISTORICAL_FLOOD_LAYERS.get(_normalise_words(state))
    if layer is None:
        return []
    layer_name, title = layer
    return [
        {
            "id": f"bhuvan-historical:{layer_name}",
            "title": title,
            "hazard_type": "flood",
            "layer_type": "wms",
            "service_url": BHUVAN_FLOOD_WMS_URL,
            "capabilities_url": BHUVAN_FLOOD_CAPABILITIES_URL,
            "layer_name": layer_name,
            "version": "1.1.1",
            "format": "image/png",
            "transparent": True,
            "opacity": 0.48,
            "attribution": "Historical flood layer: NRSC/ISRO Bhuvan",
            "status": "available",
            "source": {
                "organisation": "National Remote Sensing Centre, ISRO",
                "source_url": BHUVAN_FLOOD_CAPABILITIES_URL,
                "licence_or_restrictions": "Dated historical reference only; subject to Bhuvan terms and source metadata. Not a current warning or red-zone declaration.",
            },
        }
    ]


@dataclass
class _SourceState:
    features: list[dict[str, Any]]
    etag: str | None
    status: str
    checked_at: datetime
    success_at: datetime | None
    error: str | None = None
    warnings: tuple[str, ...] = ()


@dataclass
class _SnapshotCacheEntry:
    snapshot: dict[str, Any]
    expires_at: datetime
    sources: dict[str, _SourceState]


NdmaFactory = Callable[[tuple[str, ...]], HazardFeedAdapter]


class HazardService:
    """Fetch, normalize and cache external hazard evidence per state/query."""

    def __init__(
        self,
        *,
        ndma_factory: NdmaFactory | None = None,
        usgs_adapter: HazardFeedAdapter | None = None,
        ttl_seconds: int | None = None,
        query_radius_km: float | None = None,
        now: Callable[[], datetime] = _utc_now,
    ) -> None:
        timeout = _bounded_float_env("HAZARD_FETCH_TIMEOUT_SECONDS", 5.0, 0.5, 30.0)
        ndma_max_items = _bounded_int_env("NDMA_MAX_CAP_ITEMS", 16, 1, 50)
        ndma_url = os.getenv("NDMA_CAP_FEED_URL", NDMA_SOURCE_URL).strip() or NDMA_SOURCE_URL
        usgs_url = os.getenv("USGS_FEED_URL", USGS_SOURCE_URL).strip() or USGS_SOURCE_URL
        self._ndma_factory = ndma_factory or (
            lambda terms: NdmaSachetAdapter(ndma_url, timeout=timeout, max_items=ndma_max_items, match_terms=terms)
        )
        self._usgs_adapter = usgs_adapter or UsgsEarthquakeAdapter(usgs_url, timeout=timeout)
        self.ttl_seconds = ttl_seconds if ttl_seconds is not None else _bounded_int_env("HAZARD_CACHE_TTL_SECONDS", 120, 15, 3600)
        self.query_radius_km = query_radius_km if query_radius_km is not None else _bounded_float_env("USGS_QUERY_RADIUS_KM", 500.0, 10.0, 2000.0)
        self._now = now
        self._cache: dict[tuple[str, float | None, float | None], _SnapshotCacheEntry] = {}
        self._ndma_adapters: dict[str, HazardFeedAdapter] = {}
        self._lock = RLock()

    @staticmethod
    def _key(state: str, latitude: float | None, longitude: float | None) -> tuple[str, float | None, float | None]:
        return (_normalise_words(state), round(latitude, 4) if latitude is not None else None, round(longitude, 4) if longitude is not None else None)

    @staticmethod
    def _error_text(error: Exception) -> str:
        message = " ".join(str(error).split())[:240]
        return message or "Hazard source could not be read."

    def _fetch_source(
        self,
        adapter: HazardFeedAdapter,
        previous: _SourceState | None,
        now: datetime,
    ) -> _SourceState:
        try:
            result: HazardFetchResult = adapter.fetch(etag=previous.etag if previous else None, now=now)
            if result.not_modified:
                if previous is None:
                    raise ValueError("Source returned not-modified without a cached response.")
                features = deepcopy(previous.features)
            else:
                features = deepcopy(result.features)
            source_status = "error" if adapter.source_id == "ndma-sachet" and result.warnings else "ok"
            return _SourceState(
                features=features,
                etag=result.etag,
                status=source_status,
                checked_at=result.fetched_at,
                success_at=result.fetched_at,
                error="; ".join(result.warnings[:3]) or None,
                warnings=result.warnings,
            )
        except Exception as error:  # A failed external source must not take down the API.
            if previous is not None:
                return _SourceState(
                    features=deepcopy(previous.features),
                    etag=previous.etag,
                    status="stale",
                    checked_at=now,
                    success_at=previous.success_at,
                    error=self._error_text(error),
                    warnings=previous.warnings,
                )
            return _SourceState([], None, "error", now, None, self._error_text(error))

    @staticmethod
    def _source_view(source_id: str, name: str, state: _SourceState, *, official: bool = True) -> dict[str, Any]:
        warning = "; ".join(state.warnings[:3]) or None
        error = state.error or warning
        return {
            "id": source_id,
            "name": name,
            "status": state.status,
            "official": official,
            "last_checked_at": _iso(state.checked_at),
            "last_success_at": _iso(state.success_at),
            "error": error,
        }

    def snapshot(
        self,
        state: str,
        latitude: float | None = None,
        longitude: float | None = None,
        *,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        now = self._now()
        now = now.astimezone(timezone.utc) if now.tzinfo else now.replace(tzinfo=timezone.utc)
        key = self._key(state, latitude, longitude)
        with self._lock:
            cached = self._cache.get(key)
            if cached and not force_refresh and cached.expires_at > now:
                result = deepcopy(cached.snapshot)
                result["cache"]["hit"] = True
                return result
            previous_sources = deepcopy(cached.sources) if cached else {}
            state_key = key[0]
            ndma_adapter = self._ndma_adapters.get(state_key)
            if ndma_adapter is None:
                ndma_adapter = self._ndma_factory(ndma_candidate_terms(state))
                self._ndma_adapters[state_key] = ndma_adapter

        # External network work must not hold the global cache lock; one slow
        # state feed must not block every other local API request.
        ndma = self._fetch_source(ndma_adapter, previous_sources.get("ndma-sachet"), now)

        if latitude is not None and longitude is not None:
            usgs = self._fetch_source(self._usgs_adapter, previous_sources.get("usgs-earthquakes"), now)
        else:
            usgs = _SourceState(
                [],
                None,
                "not_configured",
                now,
                None,
                "A latitude and longitude are required to select nearby USGS events without assigning them to a state boundary.",
            )

        ndma_features = [
                feature
                for feature in ndma.features
                if _feature_active_at(feature, now) and _feature_matches_state(feature, state)
            ]
        usgs_features: list[dict[str, Any]] = []
        if latitude is not None and longitude is not None:
            for feature in usgs.features:
                    geometry = feature.get("geometry") if isinstance(feature.get("geometry"), dict) else {}
                    coordinates = geometry.get("coordinates")
                    if geometry.get("type") != "Point" or not isinstance(coordinates, list) or len(coordinates) < 2:
                        continue
                    try:
                        distance = haversine_km(latitude, longitude, float(coordinates[1]), float(coordinates[0]))
                    except (TypeError, ValueError):
                        continue
                    if distance <= self.query_radius_km:
                        selected = deepcopy(feature)
                        selected["properties"]["query_distance_km"] = round(distance, 1)
                        selected["properties"]["selection_basis"] = f"Observed epicentre within {self.query_radius_km:g} km of the supplied map anchor; not classified as inside the state."
                        usgs_features.append(selected)

        features = [*ndma_features, *usgs_features]
        verified_active = len(ndma_features)
        mapped_official = sum(
                feature.get("geometry", {}).get("type") in {"Polygon", "MultiPolygon"}
                for feature in ndma_features
                if isinstance(feature.get("geometry"), dict)
            )
        attempted_states = (ndma.status, usgs.status)
        partial = any(status in {"error", "stale"} for status in attempted_states)
        if partial:
                status = "partial"
                notice = "One or more attempted hazard feeds is unavailable or stale. The result is incomplete, and shelter locations require authorised verification."
        elif verified_active and mapped_official:
                status = "active_alerts"
                notice = f"{verified_active} active NDMA SACHET alert record(s) matched {state}; {mapped_official} include publisher-supplied map geometry."
        elif verified_active:
                status = "active_alerts"
                notice = f"{verified_active} active NDMA SACHET alert record(s) matched {state}, but no publisher-supplied boundary was available. No red zone was inferred from place names."
        else:
                status = "no_verified_active_alerts"
                notice = f"No verified active NDMA SACHET alert matched {state} at the latest successful check. This is not proof that an area or shelter is safe."

        static_layers = static_layers_for_state(state)
        source_views = [
                self._source_view("ndma-sachet", "NDMA SACHET CAP alerts", ndma),
                self._source_view("usgs-earthquakes", "USGS observed earthquake epicentres", usgs),
                {
                    "id": "bhuvan-historical",
                    "name": "ISRO Bhuvan historical flood WMS",
                    "status": "ok" if static_layers else "not_configured",
                    "official": True,
                    "last_checked_at": None,
                    "last_success_at": None,
                    "error": None if static_layers else f"No verified historical Bhuvan WMS layer is configured for {state}.",
                },
                {
                    "id": "imd-authorised",
                    "name": "India Meteorological Department authorised services",
                    "status": "not_configured",
                    "official": True,
                    "last_checked_at": None,
                    "last_success_at": None,
                    "error": "No authorised IMD API credential or IP whitelist is configured.",
                },
            ]
        snapshot = {
                "type": "FeatureCollection",
                "features": features,
                "state": state,
                "query": {"latitude": latitude, "longitude": longitude},
                "generated_at": _iso(now),
                "cache": {"hit": False, "ttl_seconds": self.ttl_seconds},
                "verified_active_alerts": verified_active,
                "status": status,
                "notice": notice,
                "synthetic": False,
                "static_layers": static_layers,
                "sources": source_views,
            }
        with self._lock:
            self._cache[key] = _SnapshotCacheEntry(
                snapshot=deepcopy(snapshot),
                expires_at=now + timedelta(seconds=self.ttl_seconds),
                sources={"ndma-sachet": ndma, "usgs-earthquakes": usgs},
            )
        return snapshot

    def clear_cache(self) -> None:
        with self._lock:
            self._cache.clear()
            self._ndma_adapters.clear()


def screen_shelters(snapshot: dict[str, Any], shelters: list[dict[str, Any]]) -> dict[str, Any]:
    """Screen points against official active polygons without certifying safety."""

    official_alerts = [
        feature
        for feature in snapshot.get("features", [])
        if isinstance(feature, dict)
        and feature.get("properties", {}).get("verification_status") == "official_source"
        and feature.get("properties", {}).get("is_active") is True
    ]
    mapped_alerts = [
        feature
        for feature in official_alerts
        if isinstance(feature.get("geometry"), dict)
        and feature["geometry"].get("type") in {"Polygon", "MultiPolygon"}
    ]
    has_area_only_alert = any(feature.get("geometry") is None for feature in official_alerts)
    ndma_source = next(
        (source for source in snapshot.get("sources", []) if source.get("id") == "ndma-sachet"),
        None,
    )
    # Only the official CAP source can make polygon screening indeterminate.
    # A supplemental USGS outage must not downgrade every shelter because USGS
    # epicentre points are intentionally excluded from this intersection test.
    official_source_incomplete = not ndma_source or ndma_source.get("status") in {"error", "stale"}
    evaluated_at = snapshot.get("generated_at") or _iso(_utc_now())
    items: list[dict[str, Any]] = []

    for shelter in shelters:
        latitude = float(shelter["latitude"])
        longitude = float(shelter["longitude"])
        matched = [
            feature
            for feature in mapped_alerts
            if geometry_covers_point(feature.get("geometry"), longitude=longitude, latitude=latitude) is True
        ]
        if matched:
            result_status = "inside_active_zone"
            notice = "This point intersects publisher-supplied geometry for an active official alert. Hold it for authorised hazard and field review; this result is not an evacuation order."
        elif has_area_only_alert or official_source_incomplete:
            result_status = "verification_required"
            notice = "A source is incomplete/stale or an active alert has no machine-readable boundary. The point cannot be cleared automatically."
        else:
            result_status = "outside_mapped_active_zones"
            notice = "The point did not intersect the currently mapped active official alert geometries. This is not a safety certification; field, engineering, access and disaster-specific checks remain required."

        items.append(
            {
                "shelter_id": str(shelter["id"]),
                "shelter_name": str(shelter["name"]),
                "status": result_status,
                "matched_zone_ids": [str(feature.get("id") or "") for feature in matched],
                "matched_sources": sorted(
                    {
                        str(feature.get("properties", {}).get("source_name") or "NDMA SACHET")
                        for feature in matched
                    }
                ),
                "evaluated_at": evaluated_at,
                "notice": notice,
            }
        )

    return {
        "state": snapshot.get("state"),
        "items": items,
        "evaluated_at": evaluated_at,
        "official_active_alerts": len(official_alerts),
        "mapped_official_zones": len(mapped_alerts),
        "static_wms_used_for_intersection": False,
        "notice": "Automated screening uses only publisher-supplied active CAP Polygon/MultiPolygon geometry. USGS points and historical Bhuvan WMS images do not create red zones or certify a shelter as safe.",
    }


hazard_service = HazardService()
