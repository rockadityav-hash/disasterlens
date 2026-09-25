"""Dependency-free GeoJSON helpers for CAP conversion and point screening."""

from __future__ import annotations

import math
from typing import Any, Literal


PointRelation = Literal["inside", "boundary", "outside", "invalid"]


def cap_polygon_ring(value: str) -> list[list[float]] | None:
    """Convert CAP's ``latitude,longitude`` sequence to a GeoJSON ring."""

    coordinates: list[list[float]] = []
    try:
        for token in value.replace("\n", " ").split():
            latitude_text, longitude_text = token.split(",", 1)
            latitude = float(latitude_text)
            longitude = float(longitude_text)
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                return None
            coordinate = [longitude, latitude]
            if not coordinates or coordinate != coordinates[-1]:
                coordinates.append(coordinate)
    except (TypeError, ValueError):
        return None
    if len({(item[0], item[1]) for item in coordinates}) < 3:
        return None
    if coordinates[0] != coordinates[-1]:
        coordinates.append(coordinates[0][:])
    return coordinates


def cap_circle_ring(value: str, *, vertices: int = 48) -> list[list[float]] | None:
    """Tessellate an official CAP circle definition into a GeoJSON ring.

    CAP radius units are kilometres. This only renders the publisher-supplied
    circle; it does not estimate or enlarge an alert area.
    """

    try:
        centre, radius_text = value.strip().split(None, 1)
        latitude_text, longitude_text = centre.split(",", 1)
        latitude = float(latitude_text)
        longitude = float(longitude_text)
        radius_km = float(radius_text)
    except (AttributeError, TypeError, ValueError):
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180 and 0 < radius_km <= 20_000):
        return None

    angular_distance = radius_km / 6371.0088
    latitude_radians = math.radians(latitude)
    longitude_radians = math.radians(longitude)
    ring: list[list[float]] = []
    for index in range(max(12, vertices)):
        bearing = 2 * math.pi * index / max(12, vertices)
        point_latitude = math.asin(
            math.sin(latitude_radians) * math.cos(angular_distance)
            + math.cos(latitude_radians) * math.sin(angular_distance) * math.cos(bearing)
        )
        point_longitude = longitude_radians + math.atan2(
            math.sin(bearing) * math.sin(angular_distance) * math.cos(latitude_radians),
            math.cos(angular_distance) - math.sin(latitude_radians) * math.sin(point_latitude),
        )
        normalized_longitude = (math.degrees(point_longitude) + 540) % 360 - 180
        ring.append([normalized_longitude, math.degrees(point_latitude)])
    ring.append(ring[0][:])
    return ring


def combine_cap_areas(polygons: list[str], circles: list[str]) -> tuple[dict[str, Any] | None, str]:
    polygon_rings = [ring for value in polygons if (ring := cap_polygon_ring(value))]
    circle_rings = [ring for value in circles if (ring := cap_circle_ring(value))]
    rings = [*polygon_rings, *circle_rings]
    if not rings:
        return None, "unavailable"
    origin = "official_polygon" if polygon_rings else "official_circle"
    if len(rings) == 1:
        return {"type": "Polygon", "coordinates": [rings[0]]}, origin
    return {"type": "MultiPolygon", "coordinates": [[[coordinate for coordinate in ring]] for ring in rings]}, origin


def _point_on_segment(longitude: float, latitude: float, start: list[float], end: list[float]) -> bool:
    x1, y1 = float(start[0]), float(start[1])
    x2, y2 = float(end[0]), float(end[1])
    cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1)
    tolerance = 1e-10 * max(1.0, abs(x2 - x1), abs(y2 - y1))
    if abs(cross) > tolerance:
        return False
    return min(x1, x2) - tolerance <= longitude <= max(x1, x2) + tolerance and min(y1, y2) - tolerance <= latitude <= max(y1, y2) + tolerance


def _ring_relation(longitude: float, latitude: float, ring: Any) -> PointRelation:
    if not isinstance(ring, list) or len(ring) < 4:
        return "invalid"
    inside = False
    try:
        for index in range(len(ring)):
            start = ring[index]
            end = ring[(index + 1) % len(ring)]
            if not (isinstance(start, list) and isinstance(end, list) and len(start) >= 2 and len(end) >= 2):
                return "invalid"
            if _point_on_segment(longitude, latitude, start, end):
                return "boundary"
            x1, y1 = float(start[0]), float(start[1])
            x2, y2 = float(end[0]), float(end[1])
            crosses = (y1 > latitude) != (y2 > latitude)
            if crosses and longitude < (x2 - x1) * (latitude - y1) / (y2 - y1) + x1:
                inside = not inside
    except (TypeError, ValueError, ZeroDivisionError):
        return "invalid"
    return "inside" if inside else "outside"


def _polygon_covers(longitude: float, latitude: float, coordinates: Any) -> bool | None:
    if not isinstance(coordinates, list) or not coordinates:
        return None
    outer = _ring_relation(longitude, latitude, coordinates[0])
    if outer == "invalid":
        return None
    if outer == "boundary":
        return True
    if outer == "outside":
        return False
    for hole in coordinates[1:]:
        relation = _ring_relation(longitude, latitude, hole)
        if relation == "invalid":
            return None
        if relation == "boundary":
            return True
        if relation == "inside":
            return False
    return True


def geometry_covers_point(geometry: Any, *, longitude: float, latitude: float) -> bool | None:
    """Return whether Polygon/MultiPolygon covers the point; unsupported is None."""

    if not isinstance(geometry, dict):
        return None
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type == "Polygon":
        return _polygon_covers(longitude, latitude, coordinates)
    if geometry_type == "MultiPolygon":
        if not isinstance(coordinates, list) or not coordinates:
            return None
        saw_valid = False
        for polygon in coordinates:
            result = _polygon_covers(longitude, latitude, polygon)
            if result is True:
                return True
            if result is False:
                saw_valid = True
        return False if saw_valid else None
    return None


def haversine_km(first_latitude: float, first_longitude: float, second_latitude: float, second_longitude: float) -> float:
    first_latitude_radians, second_latitude_radians = map(math.radians, (first_latitude, second_latitude))
    latitude_delta = math.radians(second_latitude - first_latitude)
    longitude_delta = math.radians(second_longitude - first_longitude)
    value = math.sin(latitude_delta / 2) ** 2 + math.cos(first_latitude_radians) * math.cos(second_latitude_radians) * math.sin(longitude_delta / 2) ** 2
    return 6371.0088 * 2 * math.atan2(math.sqrt(value), math.sqrt(max(0.0, 1 - value)))
