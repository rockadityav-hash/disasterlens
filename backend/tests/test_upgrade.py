import unittest

from app.scoring import RED_ZONE_WEIGHTS, calculate_confidence, calculate_red_zone_risk, validate_weights


class UpgradeScoringTests(unittest.TestCase):
    def test_human_safety_has_majority_weight(self):
        self.assertEqual(RED_ZONE_WEIGHTS["human_exposure"] + RED_ZONE_WEIGHTS["evacuation_vulnerability"], 0.55)

    def test_red_zone_contributions_are_auditable(self):
        result = calculate_red_zone_risk(80, 90, 70, 40, 30)
        self.assertEqual(result.score, 71.7)
        self.assertEqual(result.contributions["human_exposure"], 27.0)
        self.assertTrue(result.official_verification_required)

    def test_confidence_is_measurable(self):
        result = calculate_confidence(90, 80, 70, 60, 100)
        self.assertEqual(result.score, 81.0)
        self.assertEqual(result.classification, "High")

    def test_invalid_weight_total_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_weights({key: 0.1 for key in RED_ZONE_WEIGHTS}, set(RED_ZONE_WEIGHTS))


if __name__ == "__main__":
    unittest.main()
