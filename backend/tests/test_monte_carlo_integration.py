import unittest

from services.monte_carlo import run_monte_carlo


class MonteCarloIntegrationTests(unittest.TestCase):
    def _run(self, rainfall):
        return run_monte_carlo(
            rooftop_area_m2=1000,
            monthly_demand_kl=100,
            capex_inr=100000,
            tank_capacity_litres=50000,
            annual_tanker_volume_litres=0,
            n_scenarios=20,
            monthly_rainfall_mm=rainfall,
        )

    def test_phase_two_rainfall_is_used_and_reported(self):
        result = self._run([0.0] * 12)

        self.assertEqual(result["scenarios_used"], "phase2_monthly_rainfall")
        self.assertTrue(result["is_site_specific"])
        self.assertEqual(result["n_scenarios"], 20)

    def test_phase_two_rainfall_changes_downstream_result(self):
        dry = self._run([0.0] * 12)
        wet = self._run([1000.0] * 12)

        self.assertNotEqual(
            dry["never_break_even_pct"],
            wet["never_break_even_pct"],
        )

    def test_phase_two_rainfall_requires_twelve_non_negative_values(self):
        with self.assertRaises(ValueError):
            self._run([10.0] * 11)
        with self.assertRaises(ValueError):
            self._run([10.0] * 11 + [-1.0])


if __name__ == "__main__":
    unittest.main()
