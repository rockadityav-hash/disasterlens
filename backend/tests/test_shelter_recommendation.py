import unittest

from app.shelter_recommendation import evaluate_shelters


def safe_site(**overrides):
    site = {
        "id": "S-1",
        "name": "Surveyed Hill Shelter",
        "status": "open",
        "available_capacity": 400,
        "route_safety": "clear",
        "land_verified": True,
        "distance_km": 8,
        "data_confidence": 86,
        "surveyed_elevation_m": 112,
        "planning_flood_level_m": 105,
        "in_notified_floodplain": False,
        "drainage": "good",
        "landslide_susceptibility": "low",
        "in_landslide_runout": False,
        "slope_stability": "good",
        "structural_audit": "verified",
        "seismic_compliance": "verified",
        "liquefaction_risk": "low",
        "wind_resistance": "verified",
        "in_storm_surge_zone": False,
        "water_reliability": "good",
        "sanitation": "good",
        "backup_power": "good",
        "ventilation": "good",
        "medical_access": "good",
        "fire_clearance_m": 60,
        "vegetation_risk": "low",
        "satellite_evidence": {
            "mode": "synthetic_demo",
            "source_name": "Copernicus demonstration workflow",
            "sensor": "derived_product",
            "scene_id": "DEMO-SAT-001",
            "captured_at": "2026-09-04T05:30:00Z",
            "analysis_radius_m": 1000,
            "resolution_m": 10,
            "quality": "usable",
            "analyst_reviewed": False,
            "hazard_signals": {
                "flood": "clear",
                "landslide": "clear",
                "earthquake": "clear",
                "cyclone": "clear",
                "heatwave": "clear",
                "wildfire": "clear",
            },
            "source_url": "https://browser.dataspace.copernicus.eu/",
        },
    }
    site.update(overrides)
    return site


class ShelterRecommendationTests(unittest.TestCase):
    def test_flood_prefers_safe_elevation_not_shortest_distance(self):
        closer = safe_site(id="LOW", name="Closer low site", distance_km=1, surveyed_elevation_m=106)
        higher = safe_site(id="HIGH", name="Safer high site", distance_km=9, surveyed_elevation_m=112)
        results = evaluate_shelters("flood", 250, [closer, higher])
        self.assertEqual(results[0]["shelter_id"], "HIGH")
        self.assertEqual(results[0]["rank"], 1)

    def test_high_hill_is_rejected_when_landslide_risk_is_high(self):
        unstable = safe_site(landslide_susceptibility="high", surveyed_elevation_m=140)
        result = evaluate_shelters("flood", 250, [unstable])[0]
        self.assertEqual(result["decision"], "rejected")
        self.assertIsNone(result["score"])
        self.assertTrue(any("landslide" in reason.lower() for reason in result["blockers"]))

    def test_missing_critical_input_requires_verification_and_is_not_ranked(self):
        unknown = safe_site(planning_flood_level_m=None)
        result = evaluate_shelters("flood", 250, [unknown])[0]
        self.assertEqual(result["decision"], "verification_required")
        self.assertIsNone(result["rank"])
        self.assertIn("planning_flood_level_m", result["missing_fields"])

    def test_capacity_and_unsafe_route_are_hard_blocks(self):
        result = evaluate_shelters("earthquake", 250, [safe_site(available_capacity=100, route_safety="unsafe")])[0]
        self.assertEqual(result["decision"], "rejected")
        self.assertGreaterEqual(len(result["blockers"]), 2)

    def test_disaster_changes_the_required_safety_check(self):
        site = safe_site(seismic_compliance="failed")
        flood = evaluate_shelters("flood", 250, [site])[0]
        earthquake = evaluate_shelters("earthquake", 250, [site])[0]
        self.assertEqual(flood["decision"], "eligible")
        self.assertEqual(earthquake["decision"], "rejected")

    def test_every_supported_disaster_returns_an_explanation(self):
        for disaster in ("flood", "landslide", "earthquake", "cyclone", "heatwave", "wildfire"):
            with self.subTest(disaster=disaster):
                result = evaluate_shelters(disaster, 250, [safe_site()])[0]
                self.assertEqual(result["decision"], "eligible")
                self.assertEqual(result["rank"], 1)
                self.assertTrue(result["factor_scores"])
                self.assertTrue(result["reasons"])
                self.assertTrue(result["human_verification_required"])

    def test_satellite_observed_floodwater_rejects_otherwise_safe_site(self):
        site = safe_site()
        site["satellite_evidence"]["hazard_signals"]["flood"] = "unsafe"
        result = evaluate_shelters("flood", 250, [site])[0]
        self.assertEqual(result["decision"], "rejected")
        self.assertTrue(any("satellite" in reason.lower() for reason in result["blockers"]))

    def test_missing_satellite_evidence_requires_verification(self):
        result = evaluate_shelters("flood", 250, [safe_site(satellite_evidence=None)])[0]
        self.assertEqual(result["decision"], "verification_required")
        self.assertIn("satellite_evidence", result["missing_fields"])

    def test_clear_satellite_signal_cannot_override_unsafe_route(self):
        result = evaluate_shelters("flood", 250, [safe_site(route_safety="unsafe")])[0]
        self.assertEqual(result["decision"], "rejected")
        self.assertTrue(any("route" in reason.lower() for reason in result["blockers"]))

    def test_watch_signal_requires_field_confirmation(self):
        site = safe_site()
        site["satellite_evidence"]["hazard_signals"]["flood"] = "watch"
        result = evaluate_shelters("flood", 250, [site])[0]
        self.assertEqual(result["decision"], "verification_required")
        self.assertIn("satellite_field_confirmation", result["missing_fields"])

    def test_satellite_signal_is_disaster_specific_and_provenance_is_returned(self):
        site = safe_site()
        site["satellite_evidence"]["hazard_signals"]["wildfire"] = "unsafe"
        flood = evaluate_shelters("flood", 250, [site])[0]
        wildfire = evaluate_shelters("wildfire", 250, [site])[0]
        self.assertEqual(flood["decision"], "eligible")
        self.assertEqual(wildfire["decision"], "rejected")
        self.assertEqual(flood["satellite_evidence"]["scene_id"], "DEMO-SAT-001")


if __name__ == "__main__":
    unittest.main()
