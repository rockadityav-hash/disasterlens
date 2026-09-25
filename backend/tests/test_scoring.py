import unittest

from app.scoring import calculate_immediate_priority, calculate_static_risk, classify_risk


class StaticRiskTests(unittest.TestCase):
    def test_weighted_score_is_transparent(self):
        result = calculate_static_risk(80, 60, 50, 40)
        self.assertEqual(result.score, 63.0)
        self.assertEqual(result.classification, "High")
        self.assertEqual(result.contributions, {"hazard":32.0,"exposure":15.0,"vulnerability":10.0,"access_weakness":6.0})

    def test_classes_use_documented_boundaries(self):
        self.assertEqual([classify_risk(x) for x in (0,24,25,49,50,74,75,100)], ["Low","Low","Moderate","Moderate","High","High","Very High","Very High"])

    def test_immediate_priority_requires_verification(self):
        result = calculate_immediate_priority(100, 100, 80, 70, 60)
        self.assertEqual(result.score, 85.5)
        self.assertTrue(result.official_verification_required)


if __name__ == "__main__":
    unittest.main()
