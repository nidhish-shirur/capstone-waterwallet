import unittest

from services.tank_sizer import simulate_tank_year, size_tanks


class TankSizerTests(unittest.TestCase):
    def test_simulator_uses_actual_year_length(self) -> None:
        for year, days in [(2012, 366), (2016, 366), (2020, 366), (2024, 366), (2021, 365)]:
            with self.subTest(year=year):
                result = simulate_tank_year(
                    rainfall_mm=[10.0] * days,
                    tank_capacity_litres=1000,
                    daily_demand_litres=1,
                    usable_roof_area_sqm=10,
                    runoff_coefficient=0.9,
                    first_flush_fraction=0,
                    year=year,
                    recharge_enabled=False,
                )
                self.assertAlmostEqual(result.total_inflow_litres, 90 * days)
                self.assertAlmostEqual(result.reliability_percent, 100)

    def test_water_reconciliation_holds_for_each_year_and_candidate(self) -> None:
        rainfall = {2020: [100.0] * 366, 2021: [0.0, 50.0, 25.0]}
        result = size_tanks(
            rainfall_by_year=rainfall,
            candidate_capacities_litres=[0, 100, 1000],
            daily_demand_litres=20,
            usable_roof_area_sqm=10,
            runoff_coefficient=0.9,
            first_flush_fraction=0.05,
            tanker_rate_per_litre=1,
            tank_cost_per_litre=4,
            fixed_system_cost=7200,
            reliability_target_percent=80,
            recharge_enabled=False,
        )
        for candidate in result["candidates"]:
            for year in candidate["years"]:
                accounted = (
                    year["useful_water_litres"]
                    + year["recharge_overflow_litres"]
                    + year["lost_overflow_litres"]
                    + year["ending_storage_litres"]
                )
                self.assertAlmostEqual(accounted, year["total_inflow_litres"], delta=1)

    def test_zero_capacity_is_do_nothing_baseline(self) -> None:
        result = size_tanks(
            rainfall_by_year={2020: [100.0] * 366},
            candidate_capacities_litres=[0],
            daily_demand_litres=20,
            usable_roof_area_sqm=10,
            runoff_coefficient=0.9,
            first_flush_fraction=0,
            tanker_rate_per_litre=1,
            tank_cost_per_litre=4,
            fixed_system_cost=7200,
            reliability_target_percent=80,
            recharge_enabled=False,
        )["selected_candidate"]
        self.assertEqual(result["useful_water_litres"], 0)
        self.assertAlmostEqual(
            result["recharge_overflow_litres"] + result["lost_overflow_litres"],
            result["years"][0]["total_inflow_litres"],
            delta=1,
        )
        self.assertEqual(result["reliability_percent"], 0)
        self.assertEqual(result["annual_savings_inr"], 0)
        self.assertIsNone(result["payback_years"])

    def test_outputs_are_monotonic_as_capacity_increases(self) -> None:
        result = size_tanks(
            rainfall_by_year={2020: ([0.0, 100.0, 0.0, 50.0] * 92)},
            candidate_capacities_litres=[0, 100, 500, 2000, 10000],
            daily_demand_litres=80,
            usable_roof_area_sqm=100,
            runoff_coefficient=0.9,
            first_flush_fraction=0.05,
            tanker_rate_per_litre=1,
            tank_cost_per_litre=4,
            fixed_system_cost=7200,
            reliability_target_percent=80,
            recharge_enabled=True,
        )
        candidates = result["candidates"]
        useful = [row["useful_water_litres"] for row in candidates]
        reliability = [row["reliability_percent"] for row in candidates]
        overflow = [
            row["recharge_overflow_litres"] + row["lost_overflow_litres"]
            for row in candidates
        ]
        unmet = [row["unmet_demand_litres"] for row in candidates]
        self.assertTrue(all(left <= right for left, right in zip(useful, useful[1:])))
        self.assertTrue(all(left <= right for left, right in zip(reliability, reliability[1:])))
        self.assertTrue(all(left >= right for left, right in zip(overflow, overflow[1:])))
        self.assertTrue(all(left >= right for left, right in zip(unmet, unmet[1:])))


if __name__ == "__main__":
    unittest.main()
