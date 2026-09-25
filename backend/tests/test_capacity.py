import unittest

from app.capacity import calculate_capacity


class CapacityTests(unittest.TestCase):
    def test_effective_capacity_uses_limiting_constraint(self):
        result = calculate_capacity({"housing":2000,"water":800,"sanitation":1200,"health":1000,"school":900,"road_access":1100},100,50)
        self.assertEqual(result.effective_capacity,800)
        self.assertEqual(result.available_capacity,650)
        self.assertEqual(result.limiting_factor,"water")

    def test_unverified_land_has_zero_available_capacity(self):
        result = calculate_capacity({"housing":500,"water":500,"sanitation":500,"health":500,"school":500,"road_access":500},legally_available=False)
        self.assertEqual(result.available_capacity,0)
        self.assertEqual(result.limiting_factor,"land_verification")

    def test_capacity_never_becomes_negative(self):
        result = calculate_capacity({"housing":100,"water":100,"sanitation":100,"health":100,"school":100,"road_access":100},80,40)
        self.assertEqual(result.available_capacity,0)


if __name__ == "__main__":
    unittest.main()
