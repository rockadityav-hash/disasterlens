import unittest

from app.nationwide_reference import STATE_REFERENCES, find_state_reference


class NationwideReferenceTests(unittest.TestCase):
    def test_all_states_and_union_territories_are_present(self):
        self.assertEqual(len(STATE_REFERENCES), 36)
        self.assertEqual(len({item["name"] for item in STATE_REFERENCES}), 36)

    def test_lookup_is_case_insensitive(self):
        result = find_state_reference("  tamil NADU ")
        self.assertIsNotNone(result)
        self.assertEqual(result["capital"], "Chennai")

    def test_unknown_state_is_not_invented(self):
        self.assertIsNone(find_state_reference("Atlantis"))

    def test_population_values_are_historical_baselines(self):
        result = find_state_reference("Uttar Pradesh")
        self.assertEqual(result["population_2011"], 199812341)


if __name__ == "__main__":
    unittest.main()
