import unittest

from services.tank_sizer import simulate_tank_year, size_tanks


class TankSizerTests(unittest.TestCase):
    def test_monthly_storage_summary_uses_daily_simulation(self) -> None:
        result = simulate_tank_year(
            rainfall_mm=[10.0] * 31 + [0.0] * 334,
            tank_capacity_litres=1000,
            daily_demand_litres=0,
            usable_roof_area_sqm=10,
            runoff_coefficient=1,
            first_flush_fraction=0,
            year=2021,
            recharge_enabled=False,
        )

        self.assertEqual(result.monthly_inflow_litres[0], 3100)
        self.assertEqual(result.monthly_inflow_litres[1], 0)
        self.assertEqual(result.monthly_ending_storage_litres[0], 1000)
        self.assertEqual(result.monthly_ending_storage_litres[1], 1000)
        self.assertEqual(result.monthly_lost_overflow_litres[0], 2100)
        self.assertEqual(result.monthly_recharge_overflow_litres[0], 0)
        self.assertEqual(len(result.monthly_ending_storage_litres), 12)

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

    def test_finite_recharge_pit_splits_overflow(self) -> None:
        # 1 day with 100mm on 100sqm with 1.0 runoff = 10,000L inflow.
        # Demand = 0, tank_capacity = 0.
        # recharge_capacity = 3,000 L/day.
        # Should result in 3,000L recharge_overflow and 7,000L lost_overflow.
        result = simulate_tank_year(
            rainfall_mm=[100.0],
            tank_capacity_litres=0,
            daily_demand_litres=0,
            usable_roof_area_sqm=100,
            runoff_coefficient=1.0,
            first_flush_fraction=0.0,
            year=2021,
            recharge_enabled=True,
            recharge_capacity_litres_per_day=3000.0,
        )
        self.assertAlmostEqual(result.recharge_overflow_litres, 3000.0)
        self.assertAlmostEqual(result.lost_overflow_litres, 7000.0)
        self.assertAlmostEqual(result.total_inflow_litres, 10000.0)


if __name__ == "__main__":
    unittest.main()
