import unittest
from datetime import datetime, timedelta, timezone

from app.adapters.base import HazardFetchResult
from app.hazard_service import HazardService, ndma_candidate_terms, screen_shelters, static_layers_for_state


NOW = datetime(2026, 9, 16, 12, 0, tzinfo=timezone.utc)


def official_feature(identifier, state, geometry=None):
    return {
        "type": "Feature",
        "id": f"ndma-sachet:{identifier}",
        "geometry": geometry,
        "properties": {
            "external_id": identifier,
            "title": f"{state} official alert",
            "description": "Official alert fixture",
            "hazard_type": "flood",
            "severity": "severe",
            "urgency": "immediate",
            "certainty": "likely",
            "status": "Actual",
            "scope": "Public",
            "issued_at": "2026-09-16T10:00:00Z",
            "effective_at": "2026-09-16T10:00:00Z",
            "expires_at": "2026-09-17T10:00:00Z",
            "is_active": True,
            "state": state,
            "area_description": state,
            "source_id": "ndma-sachet",
            "source_name": "NDMA SACHET",
            "source_url": "https://sachet.ndma.gov.in/cap.xml",
            "verification_status": "official_source",
            "geometry_origin": "official_polygon" if geometry else "unavailable",
            "synthetic": False,
            "record_type": "alert",
            "provenance": {"fetched_at": "2026-09-16T12:00:00Z"},
        },
    }


def usgs_feature(identifier, longitude, latitude):
    return {
        "type": "Feature",
        "id": f"usgs:{identifier}",
        "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
        "properties": {
            "external_id": identifier,
            "title": "Observed earthquake",
            "is_active": True,
            "source_id": "usgs-earthquakes",
            "source_name": "U.S. Geological Survey",
            "verification_status": "supplemental_official_source",
            "geometry_origin": "official_point",
            "synthetic": False,
        },
    }


class FakeAdapter:
    def __init__(self, source_id, results):
        self.source_id = source_id
        self.source_name = source_id
        self.source_url = "https://example.gov/feed"
        self.results = list(results)
        self.calls = []

    def fetch(self, *, etag=None, now=None):
        self.calls.append(etag)
        if not self.results:
            raise RuntimeError("fixture exhausted")
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


class MutableClock:
    def __init__(self, value):
        self.value = value

    def __call__(self):
        return self.value


class HazardServiceTests(unittest.TestCase):
    def test_ndma_prefilter_can_use_issuing_centre_before_strict_state_filter(self):
        self.assertIn("chennai", ndma_candidate_terms("Tamil Nadu"))
        self.assertIn("chandigarh", ndma_candidate_terms("Haryana"))

    def setUp(self):
        self.polygon = {
            "type": "Polygon",
            "coordinates": [[[84.0, 25.0], [86.0, 25.0], [86.0, 27.0], [84.0, 27.0], [84.0, 25.0]]],
        }

    def service(self, ndma_results, usgs_results, clock=None, ttl=120):
        self.ndma = FakeAdapter("ndma-sachet", ndma_results)
        self.usgs = FakeAdapter("usgs-earthquakes", usgs_results)
        return HazardService(
            ndma_factory=lambda _terms: self.ndma,
            usgs_adapter=self.usgs,
            ttl_seconds=ttl,
            query_radius_km=500,
            now=clock or (lambda: NOW),
        )

    def test_snapshot_filters_state_keeps_geometry_null_and_nearby_usgs_only(self):
        ndma_result = HazardFetchResult(
            [official_feature("b1", "Bihar", self.polygon), official_feature("b2", "Bihar"), official_feature("p1", "Punjab", self.polygon)],
            NOW,
            etag="ndma-v1",
        )
        usgs_result = HazardFetchResult(
            [usgs_feature("near", 85.2, 25.7), usgs_feature("far", 10.0, 10.0)],
            NOW,
            etag="usgs-v1",
        )
        service = self.service([ndma_result], [usgs_result])
        snapshot = service.snapshot("Bihar", 25.6, 85.1)

        self.assertEqual(snapshot["verified_active_alerts"], 2)
        self.assertEqual({feature["id"] for feature in snapshot["features"]}, {"ndma-sachet:b1", "ndma-sachet:b2", "usgs:near"})
        self.assertEqual(snapshot["status"], "active_alerts")
        self.assertFalse(snapshot["synthetic"])
        self.assertIn("query_distance_km", snapshot["features"][-1]["properties"])

    def test_ttl_cache_and_etag_not_modified_reuse_features(self):
        good_ndma = HazardFetchResult([official_feature("b1", "Bihar", self.polygon)], NOW, etag="ndma-v1")
        good_usgs = HazardFetchResult([], NOW, etag="usgs-v1")
        unchanged_ndma = HazardFetchResult([], NOW, etag="ndma-v1", not_modified=True)
        unchanged_usgs = HazardFetchResult([], NOW, etag="usgs-v1", not_modified=True)
        service = self.service([good_ndma, unchanged_ndma], [good_usgs, unchanged_usgs])

        first = service.snapshot("Bihar", 25.6, 85.1)
        cached = service.snapshot("Bihar", 25.6, 85.1)
        refreshed = service.snapshot("Bihar", 25.6, 85.1, force_refresh=True)

        self.assertFalse(first["cache"]["hit"])
        self.assertTrue(cached["cache"]["hit"])
        self.assertEqual(len(self.ndma.calls), 2)
        self.assertEqual(self.ndma.calls, [None, "ndma-v1"])
        self.assertEqual(refreshed["verified_active_alerts"], 1)

    def test_failed_refresh_returns_stale_evidence_and_partial_status(self):
        clock = MutableClock(NOW)
        good_ndma = HazardFetchResult([official_feature("b1", "Bihar", self.polygon)], NOW, etag="v1")
        good_usgs = HazardFetchResult([], NOW, etag="u1")
        service = self.service([good_ndma, RuntimeError("NDMA offline")], [good_usgs, HazardFetchResult([], NOW, etag="u1", not_modified=True)], clock, ttl=15)
        service.snapshot("Bihar", 25.6, 85.1)
        clock.value = NOW + timedelta(seconds=16)
        snapshot = service.snapshot("Bihar", 25.6, 85.1)

        self.assertEqual(snapshot["status"], "partial")
        ndma_status = next(source for source in snapshot["sources"] if source["id"] == "ndma-sachet")
        self.assertEqual(ndma_status["status"], "stale")
        self.assertEqual(snapshot["verified_active_alerts"], 1)

    def test_one_source_failure_is_isolated(self):
        service = self.service(
            [RuntimeError("NDMA unavailable")],
            [HazardFetchResult([usgs_feature("near", 85.2, 25.7)], NOW)],
        )
        snapshot = service.snapshot("Bihar", 25.6, 85.1)
        self.assertEqual(snapshot["status"], "partial")
        self.assertEqual([feature["id"] for feature in snapshot["features"]], ["usgs:near"])

    def test_ndma_cap_warning_cannot_be_reported_as_false_calm(self):
        service = self.service(
            [HazardFetchResult([], NOW, warnings=("Linked CAP document could not be read.",))],
            [HazardFetchResult([], NOW)],
        )
        snapshot = service.snapshot("Bihar", 25.6, 85.1)
        self.assertEqual(snapshot["status"], "partial")
        ndma = next(source for source in snapshot["sources"] if source["id"] == "ndma-sachet")
        self.assertEqual(ndma["status"], "error")

    def test_shelter_screen_distinguishes_intersection_clear_of_mapped_zones_and_unknown(self):
        base_snapshot = {
            "state": "Bihar",
            "generated_at": "2026-09-16T12:00:00Z",
            "status": "active_alerts",
            "features": [official_feature("b1", "Bihar", self.polygon)],
            "sources": [
                {"id": "ndma-sachet", "status": "ok"},
                {"id": "usgs-earthquakes", "status": "ok"},
            ],
        }
        shelters = [
            {"id": "inside", "name": "Inside shelter", "latitude": 26.0, "longitude": 85.0},
            {"id": "outside", "name": "Outside shelter", "latitude": 28.0, "longitude": 85.0},
        ]
        screened = screen_shelters(base_snapshot, shelters)
        self.assertEqual([item["status"] for item in screened["items"]], ["inside_active_zone", "outside_mapped_active_zones"])
        self.assertFalse(screened["static_wms_used_for_intersection"])

        with_area_only = {**base_snapshot, "features": [*base_snapshot["features"], official_feature("b2", "Bihar")]}
        unknown = screen_shelters(with_area_only, [shelters[1]])
        self.assertEqual(unknown["items"][0]["status"], "verification_required")

        supplemental_partial = screen_shelters(
            {
                **base_snapshot,
                "status": "partial",
                "features": [],
                "sources": [
                    {"id": "ndma-sachet", "status": "ok"},
                    {"id": "usgs-earthquakes", "status": "error"},
                ],
            },
            [shelters[1]],
        )
        self.assertEqual(supplemental_partial["items"][0]["status"], "outside_mapped_active_zones")

        official_partial = screen_shelters(
            {
                **base_snapshot,
                "status": "partial",
                "features": [],
                "sources": [{"id": "ndma-sachet", "status": "error"}],
            },
            [shelters[1]],
        )
        self.assertEqual(official_partial["items"][0]["status"], "verification_required")

    def test_bhuvan_layers_are_explicitly_historical_and_state_limited(self):
        bihar = static_layers_for_state("Bihar")
        self.assertEqual(bihar[0]["layer_name"], "br_fld_2010")
        self.assertIn("historical", bihar[0]["source"]["licence_or_restrictions"].lower())
        self.assertEqual(static_layers_for_state("Uttarakhand"), [])


if __name__ == "__main__":
    unittest.main()
