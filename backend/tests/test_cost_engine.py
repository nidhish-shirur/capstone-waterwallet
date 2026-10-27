import unittest

from models.schemas import ConfigurationComparisonRequest, CostEstimateRequest
from services.configuration_comparison import compare_configurations
from services.cost_engine import estimate_project_cost


class CostEngineTests(unittest.TestCase):
    def test_storage_cost_uses_existing_editable_assumptions(self):
        result = estimate_project_cost(
            CostEstimateRequest(
                configuration="storage_only",
                gross_roof_area_sqm=100,
                capex_rate_per_sqm=600,
                tank_capacity_litres=5000,
                tank_cost_per_litre=4,
            )
        )

        self.assertEqual(result.total_capex_inr, 68000)
        self.assertEqual(result.annual_opex_inr, 2040)
        self.assertEqual(
            [line.component for line in result.capex_breakdown],
            ["catchment_and_installation", "storage_tank"],
        )
        self.assertIn("not a contractor quotation", result.assumptions[0])

    def test_recharge_price_is_required_for_complete_cost_and_opex(self):
        result = estimate_project_cost(
            CostEstimateRequest(
                configuration="hybrid",
                gross_roof_area_sqm=100,
                tank_capacity_litres=5000,
            )
        )

        self.assertFalse(result.capex_complete)
        self.assertIsNone(result.total_capex_inr)
        self.assertIsNone(result.annual_opex_inr)
        self.assertIsNone(result.capex_breakdown[-1].amount_inr)

    def test_zero_cost_assumptions_produce_zero_capex_and_opex(self):
        result = estimate_project_cost(
            CostEstimateRequest(
                configuration="storage_only",
                gross_roof_area_sqm=100,
                capex_rate_per_sqm=0,
                tank_capacity_litres=0,
                tank_cost_per_litre=0,
                annual_maintenance_rate=0,
                fixed_annual_opex_inr=0,
            )
        )

        self.assertEqual(result.total_capex_inr, 0)
        self.assertEqual(result.annual_opex_inr, 0)

    def test_comparison_uses_direct_supply_for_savings_not_recharge(self):
        payload = ConfigurationComparisonRequest(
            latitude=19.0,
            longitude=72.0,
            gross_roof_area_sqm=100,
            daily_non_potable_demand_litres=100,
            tank_capacity_litres=1000,
            coastal_distance_km=10,
            soil_permeability_class=3,
            borewell_present=1,
            borewell_depth_m=50,
            annual_tanker_volume_litres=10000,
            annual_tanker_spend_inr=20000,
            recharge_connection_cost_inr=5000,
        )
        result = compare_configurations(
            payload,
            {2021: [0.0] * 365},
            runoff_coefficient=0.9,
        )

        recharge_only = result["scenarios"][1]
        hybrid = result["scenarios"][2]
        self.assertEqual(recharge_only.average_useful_water_litres, 0)
        self.assertEqual(recharge_only.annual_tanker_offset_litres, 0)
        self.assertEqual(recharge_only.annual_gross_savings_inr, 0)
        self.assertEqual(hybrid.average_recharge_overflow_litres, 0)
        self.assertEqual(result["rainfall_source"], "open_meteo_daily")

    def test_safety_gate_marks_recharge_scenarios_ineligible(self):
        payload = ConfigurationComparisonRequest(
            latitude=19.0,
            longitude=72.0,
            gross_roof_area_sqm=100,
            daily_non_potable_demand_litres=100,
            tank_capacity_litres=1000,
            coastal_distance_km=1,
            soil_permeability_class=3,
            borewell_present=1,
            borewell_depth_m=50,
        )
        result = compare_configurations(
            payload,
            {2021: [0.0] * 365},
            runoff_coefficient=0.9,
        )

        self.assertTrue(result["scenarios"][0].eligible)
        self.assertFalse(result["scenarios"][1].eligible)
        self.assertFalse(result["scenarios"][2].eligible)
        self.assertIsNotNone(result["scenarios"][1].safety_reason)

    def test_missing_billing_keeps_financial_comparison_unavailable(self):
        payload = ConfigurationComparisonRequest(
            latitude=19.0,
            longitude=72.0,
            gross_roof_area_sqm=100,
            daily_non_potable_demand_litres=100,
            tank_capacity_litres=1000,
            coastal_distance_km=10,
            soil_permeability_class=3,
            borewell_present=1,
            borewell_depth_m=50,
        )

        result = compare_configurations(
            payload,
            {2021: [0.0] * 365},
            runoff_coefficient=0.9,
        )
        storage = result["scenarios"][0]

        self.assertEqual(storage.average_useful_water_litres, 0)
        self.assertIsNone(storage.annual_tanker_offset_litres)
        self.assertIsNone(storage.annual_net_savings_inr)
        self.assertIsNone(storage.simple_payback_years)
        self.assertEqual(len(storage.missing_financial_inputs), 2)


if __name__ == "__main__":
    unittest.main()
