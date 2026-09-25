"""NDMA SACHET RSS/CAP ingestion with conservative geometry handling."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
import re
from threading import RLock
from typing import Any, Callable
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ElementTree

from .base import HazardFeedAdapter, HazardFetchResult
from .geo import combine_cap_areas
from .http import HttpDocument, fetch_url


DEFAULT_NDMA_RSS_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
MAX_XML_BYTES = 2_000_000


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    try:
        return _as_utc(datetime.fromisoformat(text.replace("Z", "+00:00")))
    except ValueError:
        try:
            return _as_utc(parsedate_to_datetime(text))
        except (TypeError, ValueError, OverflowError):
            return None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat().replace("+00:00", "Z") if value else None


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].rsplit(":", 1)[-1]


def _children(node: ElementTree.Element, name: str) -> list[ElementTree.Element]:
    return [child for child in list(node) if _local_name(child.tag) == name]


def _child_text(node: ElementTree.Element | None, name: str) -> str | None:
    if node is None:
        return None
    for child in list(node):
        if _local_name(child.tag) == name and child.text and child.text.strip():
            return child.text.strip()
    return None


def _descendant_text(node: ElementTree.Element, name: str) -> str | None:
    for child in node.iter():
        if _local_name(child.tag) == name and child.text and child.text.strip():
            return child.text.strip()
    return None


def _all_descendant_text(node: ElementTree.Element, name: str) -> list[str]:
    return [child.text.strip() for child in node.iter() if _local_name(child.tag) == name and child.text and child.text.strip()]


def parse_xml_safely(payload: bytes) -> ElementTree.Element:
    """Parse bounded XML after rejecting DTD/entity declarations."""

    if not payload or len(payload) > MAX_XML_BYTES:
        raise ValueError("XML document is empty or too large.")
    upper_payload = payload.upper()
    if b"<!DOCTYPE" in upper_payload or b"<!ENTITY" in upper_payload:
        raise ValueError("DTD and entity declarations are not allowed in hazard feeds.")
    try:
        return ElementTree.fromstring(payload)
    except ElementTree.ParseError as error:
        raise ValueError("Hazard source returned malformed XML.") from error


def _clean_text(value: str | None, *, limit: int = 4000) -> str:
    if not value:
        return ""
    without_markup = re.sub(r"<[^>]+>", " ", unescape(value))
    return re.sub(r"\s+", " ", without_markup).strip()[:limit]


def normalize_hazard_type(event: str | None) -> str:
    value = (event or "").casefold()
    if "earthquake" in value or "भूकंप" in value:
        return "earthquake"
    if "landslide" in value or "land slip" in value:
        return "landslide"
    if any(token in value for token in ("flood", "inundation")):
        return "flood"
    if any(token in value for token in ("thunderstorm", "lightning", "squall")):
        return "thunderstorm"
    if any(token in value for token in ("heavy rain", "rainfall", "cloudburst")):
        return "heavy_rain"
    if any(token in value for token in ("cyclone", "storm surge", "tropical storm")):
        return "cyclone"
    if "heat" in value:
        return "heatwave"
    if any(token in value for token in ("forest fire", "wildfire", "bushfire")):
        return "wildfire"
    return "other"


def _parameter_value(nodes: list[ElementTree.Element], wanted_names: set[str]) -> str | None:
    for node in nodes:
        name = (_child_text(node, "valueName") or "").casefold().replace(" ", "_")
        if name in wanted_names:
            return _child_text(node, "value")
    return None


def _is_active(*, now: datetime, effective_at: datetime | None, expires_at: datetime | None, message_type: str) -> bool:
    if message_type.casefold() not in {"alert", "update"}:
        return False
    if effective_at and effective_at > now:
        return False
    if expires_at and expires_at <= now:
        return False
    return True


def normalize_cap_alert(root: ElementTree.Element, *, document_url: str, fetched_at: datetime, now: datetime) -> dict[str, Any] | None:
    """Normalize one CAP alert. Test/private messages are deliberately omitted."""

    if _local_name(root.tag) != "alert":
        raise ValueError("Document is not a CAP alert.")
    status = _child_text(root, "status") or "Unknown"
    scope = _child_text(root, "scope") or "Unknown"
    if status.casefold() != "actual" or scope.casefold() != "public":
        return None

    identifier = _child_text(root, "identifier") or ""
    if not identifier:
        raise ValueError("CAP alert has no identifier.")
    message_type = _child_text(root, "msgType") or "Alert"
    infos = _children(root, "info")
    info = next((item for item in infos if (_child_text(item, "language") or "").casefold().startswith("en")), infos[0] if infos else None)
    if info is None:
        raise ValueError("CAP alert has no info block.")

    areas = _children(info, "area")
    polygons = [value for area in areas for value in _all_descendant_text(area, "polygon")]
    circles = [value for area in areas for value in _all_descendant_text(area, "circle")]
    geometry, geometry_origin = combine_cap_areas(polygons, circles)
    area_descriptions = [value for area in areas if (value := _child_text(area, "areaDesc"))]
    parameters = [node for node in info.iter() if _local_name(node.tag) == "parameter"]
    parameters.extend(node for area in areas for node in area.iter() if _local_name(node.tag) == "geocode")
    state = _parameter_value(parameters, {"state", "state_name", "state_ut", "statecode"})

    sent_at = _parse_datetime(_child_text(root, "sent"))
    effective_at = _parse_datetime(_child_text(info, "effective") or _child_text(info, "onset")) or sent_at
    expires_at = _parse_datetime(_child_text(info, "expires"))
    event = _child_text(info, "event") or "Official hazard alert"
    headline = _child_text(info, "headline") or event
    references = _child_text(root, "references") or ""
    source_identifier = _child_text(root, "sender") or identifier
    feature_id = f"ndma-sachet:{identifier}"
    return {
        "type": "Feature",
        "id": feature_id,
        "geometry": geometry,
        "properties": {
            "external_id": identifier,
            "title": headline,
            "description": _clean_text(_child_text(info, "description")),
            "hazard_type": normalize_hazard_type(event),
            "severity": (_child_text(info, "severity") or "Unknown").casefold(),
            "urgency": (_child_text(info, "urgency") or "Unknown").casefold(),
            "certainty": (_child_text(info, "certainty") or "Unknown").casefold(),
            "status": status,
            "scope": scope,
            "issued_at": _iso(sent_at),
            "effective_at": _iso(effective_at),
            "expires_at": _iso(expires_at),
            "is_active": _is_active(now=now, effective_at=effective_at, expires_at=expires_at, message_type=message_type),
            "state": state,
            "area_description": "; ".join(dict.fromkeys(area_descriptions)),
            "source_id": "ndma-sachet",
            "source_name": "NDMA SACHET",
            "source_url": document_url,
            "verification_status": "official_source",
            "geometry_origin": geometry_origin,
            "synthetic": False,
            "record_type": "alert",
            "message_type": message_type,
            "references": references,
            "provenance": {
                "fetched_at": _iso(fetched_at),
                "original_format": "CAP XML",
                "source_identifier": source_identifier,
                "transformation": "CAP latitude/longitude normalized to GeoJSON longitude/latitude; CAP circles tessellated without changing their stated radius",
            },
        },
    }


def normalize_rss_item(item: ElementTree.Element, *, feed_url: str, fetched_at: datetime, now: datetime) -> dict[str, Any] | None:
    identifier = _child_text(item, "guid") or _child_text(item, "id") or _child_text(item, "link")
    title = _child_text(item, "title")
    if not identifier or not title:
        return None
    issued_at = _parse_datetime(_child_text(item, "pubDate") or _child_text(item, "updated"))
    effective_at = _parse_datetime(_descendant_text(item, "effective")) or issued_at
    expires_at = _parse_datetime(_descendant_text(item, "expires"))
    event = _descendant_text(item, "event") or title
    polygons = _all_descendant_text(item, "polygon")
    circles = _all_descendant_text(item, "circle")
    geometry, geometry_origin = combine_cap_areas(polygons, circles)
    link = _child_text(item, "link") or feed_url
    area_description = _descendant_text(item, "areaDesc") or _child_text(item, "category") or ""
    issuing_context = _descendant_text(item, "author") or _descendant_text(item, "creator") or ""
    return {
        "type": "Feature",
        "id": f"ndma-sachet:{identifier}",
        "geometry": geometry,
        "properties": {
            "external_id": identifier,
            "title": title,
            "description": _clean_text(_child_text(item, "description") or _child_text(item, "summary")),
            "hazard_type": normalize_hazard_type(event),
            "severity": (_descendant_text(item, "severity") or "Unknown").casefold(),
            "urgency": (_descendant_text(item, "urgency") or "Unknown").casefold(),
            "certainty": (_descendant_text(item, "certainty") or "Unknown").casefold(),
            "status": "Actual",
            "scope": "Public",
            "issued_at": _iso(issued_at),
            "effective_at": _iso(effective_at),
            "expires_at": _iso(expires_at),
            # A plain RSS item without CAP expiry cannot be safely presented as
            # an indefinitely active warning. The record is retained for
            # provenance, but only an explicit future expiry makes it active.
            "is_active": expires_at is not None and _is_active(now=now, effective_at=effective_at, expires_at=expires_at, message_type="Alert"),
            "state": None,
            "area_description": area_description,
            "feed_context": " ".join(part for part in (title, area_description, issuing_context) if part),
            "source_id": "ndma-sachet",
            "source_name": "NDMA SACHET",
            "source_url": link,
            "verification_status": "official_source",
            "geometry_origin": geometry_origin,
            "synthetic": False,
            "record_type": "alert",
            "message_type": "Alert",
            "references": "",
            "provenance": {
                "fetched_at": _iso(fetched_at),
                "original_format": "NDMA RSS",
                "source_identifier": identifier,
                "transformation": "RSS/CAP fields normalized to GeoJSON; no geometry inferred from area text",
            },
        },
    }


def _referenced_identifiers(value: str) -> set[str]:
    identifiers: set[str] = set()
    for reference in value.split():
        parts = reference.split(",")
        if len(parts) >= 2 and parts[1]:
            identifiers.add(parts[1])
    return identifiers


def _apply_lifecycle(features: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def timestamp(feature: dict[str, Any]) -> str:
        return str(feature.get("properties", {}).get("issued_at") or "")

    current: dict[str, dict[str, Any]] = {}
    for feature in sorted(features, key=timestamp):
        properties = feature["properties"]
        message_type = str(properties.get("message_type") or "Alert").casefold()
        for referenced_id in _referenced_identifiers(str(properties.get("references") or "")):
            current.pop(referenced_id, None)
        if message_type in {"alert", "update"}:
            current[str(properties["external_id"])] = feature
    return list(current.values())


class NdmaSachetAdapter(HazardFeedAdapter):
    source_id = "ndma-sachet"
    source_name = "NDMA SACHET"
    official = True

    def __init__(
        self,
        source_url: str = DEFAULT_NDMA_RSS_URL,
        *,
        fetcher: Callable[..., HttpDocument] = fetch_url,
        timeout: float = 5.0,
        max_items: int = 16,
        match_terms: tuple[str, ...] = (),
    ) -> None:
        self.source_url = source_url
        self._fetcher = fetcher
        self._timeout = max(0.5, timeout)
        self._max_items = max(1, min(max_items, 100))
        self._match_terms = tuple(term.strip().casefold() for term in match_terms if term.strip())
        self._cap_cache: dict[str, tuple[str | None, dict[str, Any] | None]] = {}
        self._cap_cache_lock = RLock()

    def _item_matches(self, item: ElementTree.Element) -> bool:
        if not self._match_terms:
            return True
        searchable = " ".join(part.strip() for part in item.itertext() if part and part.strip()).casefold()
        return any(term in searchable for term in self._match_terms)

    def _cap_url(self, item: ElementTree.Element) -> str | None:
        candidates = [_child_text(item, "link"), _child_text(item, "guid")]
        for enclosure in _children(item, "enclosure"):
            candidates.append(enclosure.attrib.get("url"))
        allowed_hosts = {urlparse(self.source_url).hostname, "sachet.ndma.gov.in"}
        for candidate in candidates:
            if not candidate:
                continue
            url = urljoin(self.source_url, candidate)
            parsed = urlparse(url)
            if parsed.scheme == "https" and parsed.hostname in allowed_hosts:
                return url
        return None

    def _fetch_cap(self, index: int, url: str, fetched_at: datetime, now: datetime) -> tuple[int, bool, dict[str, Any] | None, str | None]:
        try:
            with self._cap_cache_lock:
                cached = self._cap_cache.get(url)
            headers = {"If-None-Match": cached[0]} if cached and cached[0] else None
            document = self._fetcher(url, headers=headers, timeout=min(self._timeout, 3.0), max_bytes=MAX_XML_BYTES)
            if document.status == 304:
                if cached is None:
                    return index, False, None, "Linked NDMA CAP document returned not-modified without a cached copy."
                feature = deepcopy(cached[1])
                if feature:
                    feature["properties"]["provenance"]["revalidated_at"] = _iso(fetched_at)
                return index, True, feature, None
            root = parse_xml_safely(document.body)
            if _local_name(root.tag) != "alert":
                return index, False, None, "Linked NDMA document was not CAP XML; RSS metadata retained."
            feature = normalize_cap_alert(root, document_url=document.final_url, fetched_at=fetched_at, now=now)
            response_etag = document.headers.get("etag")
            with self._cap_cache_lock:
                self._cap_cache[url] = (response_etag, deepcopy(feature))
                while len(self._cap_cache) > 256:
                    self._cap_cache.pop(next(iter(self._cap_cache)))
            return index, True, feature, None
        except (RuntimeError, ValueError) as error:
            return index, False, None, str(error)

    def fetch(self, *, etag: str | None = None, now: datetime | None = None) -> HazardFetchResult:
        checked_at = _as_utc(now or _utc_now())
        headers = {"If-None-Match": etag} if etag else None
        document = self._fetcher(self.source_url, headers=headers, timeout=self._timeout, max_bytes=MAX_XML_BYTES)
        response_etag = document.headers.get("etag") or etag
        if document.status == 304:
            return HazardFetchResult([], checked_at, etag=response_etag, not_modified=True)

        root = parse_xml_safely(document.body)
        if _local_name(root.tag) == "alert":
            feature = normalize_cap_alert(root, document_url=document.final_url, fetched_at=checked_at, now=checked_at)
            return HazardFetchResult(_apply_lifecycle([feature] if feature else []), checked_at, etag=response_etag)

        # The SACHET RSS document is newest-first. Select from the beginning and
        # pre-filter before following CAP links so a request for one state never
        # downloads or returns arbitrary alerts from another state.
        all_items = [node for node in root.iter() if _local_name(node.tag) in {"item", "entry"}]
        items = [item for item in all_items if self._item_matches(item)][: self._max_items]
        fallback_features = [normalize_rss_item(item, feed_url=document.final_url, fetched_at=checked_at, now=checked_at) for item in items]
        cap_jobs = [(index, url) for index, item in enumerate(items) if (url := self._cap_url(item))]
        cap_results: dict[int, tuple[bool, dict[str, Any] | None]] = {}
        warnings: list[str] = []
        if cap_jobs:
            with ThreadPoolExecutor(max_workers=min(4, len(cap_jobs)), thread_name_prefix="ndma-cap") as executor:
                futures = [executor.submit(self._fetch_cap, index, url, checked_at, checked_at) for index, url in cap_jobs]
                for future in as_completed(futures):
                    index, handled, feature, warning = future.result()
                    cap_results[index] = (handled, feature)
                    if warning:
                        warnings.append(warning)

        features: list[dict[str, Any]] = []
        for index, fallback in enumerate(fallback_features):
            handled, cap_feature = cap_results.get(index, (False, None))
            if handled:
                if cap_feature:
                    if fallback:
                        cap_feature["properties"]["feed_context"] = " ".join(
                            filter(
                                None,
                                (
                                    str(fallback["properties"].get("title") or ""),
                                    str(fallback["properties"].get("area_description") or ""),
                                    str(fallback["properties"].get("feed_context") or ""),
                                ),
                            )
                        )
                    features.append(cap_feature)
            elif fallback:
                features.append(fallback)
        return HazardFetchResult(_apply_lifecycle(features), checked_at, etag=response_etag, warnings=tuple(warnings[:20]))
