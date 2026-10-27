import unittest

from services.roi_engine import simulate_roi
from models.constants import (
    USABILITY_FACTOR,
    RUNOFF_COEFFICIENT,
    DEFAULT_WATER_TARIFF_PER_KL,
)


class ROIEngineParameterSensitivityTests(unittest.TestCase):
    """
    Sensitivity and boundary tests for the ROI engine:
    1. Phase 1 tanker spend sensitivity (monotonicity, derivative bounds).
    2. Phase 2 rooftop area sensitivity (small vs oversized roof, diminishing returns).
    3. Tariff boundary conditions and mathematical sanity.
    """

    def setUp(self):
        # Base society parameters
        self.daily_demand_lpd = 10000.0          # 10,000 L/day non-potable demand
        self.annual_demand_l = self.daily_demand_lpd * 365.0  # 3,650,000 L/yr
        self.tank_capacity = 50000.0             # 50,000 L
        self.capex = 300000.0                    # ₹300,000 capex
        self.municipal_tariff = DEFAULT_WATER_TARIFF_PER_KL  # ₹15/kL
        self.annual_tanker_volume = 1000000.0    # 1,000,000 L/yr tanker dependency
        self.annual_municipal_spend = 40000.0

    # ──────────────────────────────────────────────────────────────────────────
    # 1. Phase 1: Tanker Spend Sensitivity Tests
    # ──────────────────────────────────────────────────────────────────────────

    def test_tanker_spend_monotonicity(self):
        """
        Increasing annual tanker spend (holding tanker volume and yield constant)
        must monotonically increase 10-year savings and reduce (or maintain) payback years.
        """
        # Ensure yield is high enough to offset part or all of the tanker volume
        yield_litres = 1200000.0

        spend_levels = [100000.0, 200000.0, 300000.0, 450000.0, 600000.0]
        results = [
            simulate_roi(
                daily_demand_lpd=self.daily_demand_lpd,
                annual_yield_litres=yield_litres,
                tank_capacity_litres=self.tank_capacity,
                water_tariff_per_kl=self.municipal_tariff,
                installation_cost=self.capex,
                annual_tanker_spend=spend,
                annual_tanker_volume_litres=self.annual_tanker_volume,
                annual_municipal_spend=self.annual_municipal_spend,
            )
            for spend in spend_levels
        ]

        # Ten-year savings must strictly increase with tanker spend
        ten_yr_savings = [r.ten_year_savings for r in results]
        for i in range(len(ten_yr_savings) - 1):
            self.assertGreater(
                ten_yr_savings[i + 1],
                ten_yr_savings[i],
                f"10-yr savings failed strict monotonicity between spend={spend_levels[i]} and spend={spend_levels[i+1]}",
            )

        # Payback years must monotonically decrease (or remain tied if at boundary)
        paybacks = [r.payback_years for r in results]
        for i in range(len(paybacks) - 1):
            if paybacks[i] is not None and paybacks[i + 1] is not None:
                self.assertLessEqual(
                    paybacks[i + 1],
                    paybacks[i],
                    f"Payback period failed monotonic decrease between spend={spend_levels[i]} and spend={spend_levels[i+1]}",
                )

    def test_itemized_annual_opex_is_used_when_provided(self):
        result = simulate_roi(
            daily_demand_lpd=self.daily_demand_lpd,
            annual_yield_litres=self.annual_tanker_volume,
            tank_capacity_litres=self.tank_capacity,
            water_tariff_per_kl=self.municipal_tariff,
            installation_cost=self.capex,
            annual_tanker_spend=200000,
            annual_tanker_volume_litres=self.annual_tanker_volume,
            annual_opex_inr=10000,
        )

        expected_savings = 200000 - 10000
        self.assertEqual(result.yearly_breakdown[0].savings, expected_savings)

    def test_tanker_spend_marginal_derivative_bound_full_offset(self):
        """
        When annual yield >= annual tanker volume, 100% of tanker volume is offset.
        The marginal first-year gross savings with respect to tanker spend must equal exactly 1.0:
            d(Year 1 savings) / d(tanker spend) == 1.0
        """
        yield_litres = 1500000.0  # > annual_tanker_volume (1,000,000 L)
        spend_a = 200000.0
        spend_b = 300000.0
        delta_spend = spend_b - spend_a

        res_a = simulate_roi(
            daily_demand_lpd=self.daily_demand_lpd,
            annual_yield_litres=yield_litres,
            tank_capacity_litres=self.tank_capacity,
            water_tariff_per_kl=self.municipal_tariff,
            installation_cost=self.capex,
            annual_tanker_spend=spend_a,
            annual_tanker_volume_litres=self.annual_tanker_volume,
            annual_municipal_spend=self.annual_municipal_spend,
        )
        res_b = simulate_roi(
            daily_demand_lpd=self.daily_demand_lpd,
            annual_yield_litres=yield_litres,
            tank_capacity_litres=self.tank_capacity,
            water_tariff_per_kl=self.municipal_tariff,
            installation_cost=self.capex,
            annual_tanker_spend=spend_b,
            annual_tanker_volume_litres=self.annual_tanker_volume,
            annual_municipal_spend=self.annual_municipal_spend,
        )

        yr1_savings_a = res_a.yearly_breakdown[0].savings
        yr1_savings_b = res_b.yearly_breakdown[0].savings
        delta_savings = yr1_savings_b - yr1_savings_a

        # Marginal rate d(savings)/d(spend) must be 1.0
        marginal_rate = delta_savings / delta_spend
        self.assertAlmostEqual(
            marginal_rate,
            1.0,
            places=2,
            msg=f"Expected marginal savings derivative of 1.0, got {marginal_rate}",
        )

    def test_tanker_spend_marginal_derivative_bound_partial_offset(self):
        """
        When annual yield < annual tanker volume, only a fraction of tanker volume is offset.
        The marginal first-year savings with respect to tanker spend must equal the volumetric ratio:
            d(Year 1 savings) / d(tanker spend) == yield / tanker_volume
        """
        yield_litres = 500000.0  # 50% of annual_tanker_volume (1,000,000 L)
        fraction = yield_litres / self.annual_tanker_volume  # 0.50

        spend_a = 200000.0
        spend_b = 350000.0
        delta_spend = spend_b - spend_a

        res_a = simulate_roi(
            daily_demand_lpd=self.daily_demand_lpd,
            annual_yield_litres=yield_litres,
            tank_capacity_litres=self.tank_capacity,
            water_tariff_per_kl=self.municipal_tariff,
            installation_cost=self.capex,
            annual_tanker_spend=spend_a,
            annual_tanker_volume_litres=self.annual_tanker_volume,
            annual_municipal_spend=self.annual_municipal_spend,
        )
        res_b = simulate_roi(
            daily_demand_lpd=self.daily_demand_lpd,
            annual_yield_litres=yield_litres,
            tank_capacity_litres=self.tank_capacity,
            water_tariff_per_kl=self.municipal_tariff,
            installation_cost=self.capex,
            annual_tanker_spend=spend_b,
            annual_tanker_volume_litres=self.annual_tanker_volume,
            annual_municipal_spend=self.annual_municipal_spend,
        )

        yr1_savings_a = res_a.yearly_breakdown[0].savings
        yr1_savings_b = res_b.yearly_breakdown[0].savings
        delta_savings = yr1_savings_b - yr1_savings_a

        marginal_rate = delta_savings / delta_spend
        self.assertAlmostEqual(
            marginal_rate,
            fraction,
            places=2,
            msg=f"Expected marginal savings derivative of {fraction}, got {marginal_rate}",
        )

    # ──────────────────────────────────────────────────────────────────────────
    # 2. Phase 2: Rooftop Area Sensitivity & Boundary Tests
    # ──────────────────────────────────────────────────────────────────────────

    def _area_to_inputs(self, area_m2: float, capex_rate_per_sqm: float = 600.0, rainfall_mm: float = 2424.0):
        """Helper computing Phase 2 yield and capex from gross roof area."""
        usable_area = area_m2 * USABILITY_FACTOR
        annual_yield = usable_area * rainfall_mm * RUNOFF_COEFFICIENT
        capex = usable_area * capex_rate_per_sqm
        return annual_yield, capex

    def test_rooftop_area_low_regime_improves_payback(self):
        """
        In the undersized roof regime (e.g., 200 m² to 600 m²), increasing roof area
        offsets expensive tanker water faster than capex accumulates, shortening payback.
        """
        annual_tanker_spend = 350000.0
        annual_tanker_volume = 1200000.0  # high tanker usage

        areas = [200.0, 400.0, 600.0]
        paybacks = []
        for a in areas:
            yld, cost = self._area_to_inputs(a)
            res = simulate_roi(
                daily_demand_lpd=self.daily_demand_lpd,
                annual_yield_litres=yld,
                tank_capacity_litres=self.tank_capacity,
                water_tariff_per_kl=self.municipal_tariff,
                installation_cost=cost,
                annual_tanker_spend=annual_tanker_spend,
                annual_tanker_volume_litres=annual_tanker_volume,
                annual_municipal_spend=self.annual_municipal_spend,
            )
            paybacks.append(res.payback_years)

        self.assertIsNotNone(paybacks[0])
        self.assertIsNotNone(paybacks[1])
        self.assertIsNotNone(paybacks[2])
        # Payback should shorten or remain attractive as high-cost tanker water is offset
        self.assertLessEqual(paybacks[1], paybacks[0])
        self.assertLessEqual(paybacks[2], paybacks[1])

    def test_rooftop_area_oversized_saturation_and_derivative_bound(self):
        """
        When rooftop area is so large that annual harvestable yield exceeds annual demand:
        1. Effective yield is capped at annual_demand_litres (derivative of volumetric savings w.r.t area is 0).
        2. Incremental installation cost increases capex and AMC (3% of capex).
        3. Therefore, net annual savings strictly DECREASES for area beyond demand saturation:
           d(Net Savings) / d(Area) = - (0.80 * 600 * 0.03) = -14.4 ₹/m²/yr < 0.
        4. Payback years strictly lengthens (worsens).
        """
        rainfall_mm = 2424.0
        # Calculate roof area at which yield equals total annual demand:
        # demand = area * 0.80 * 2424 * 0.90 => area_cap = demand / (0.80 * 2424 * 0.90)
        yield_per_m2 = USABILITY_FACTOR * rainfall_mm * RUNOFF_COEFFICIENT  # ≈ 1745.28 L/m²
        area_at_cap = self.annual_demand_l / yield_per_m2  # ≈ 2091 m²

        area_saturation = area_at_cap + 500.0  # Yield exceeds demand
        area_extreme = area_at_cap + 2500.0     # Yield far exceeds demand

        yld_sat, capex_sat = self._area_to_inputs(area_saturation)
        yld_ext, capex_ext = self._area_to_inputs(area_extreme)

        res_sat = simulate_roi(
            daily_demand_lpd=self.daily_demand_lpd,
            annual_yield_litres=yld_sat,
            tank_capacity_litres=self.tank_capacity,
            water_tariff_per_kl=self.municipal_tariff,
            installation_cost=capex_sat,
            annual_tanker_spend=200000.0,
            annual_tanker_volume_litres=self.annual_tanker_volume,
            annual_municipal_spend=self.annual_municipal_spend,
        )
        res_ext = simulate_roi(
            daily_demand_lpd=self.daily_demand_lpd,
            annual_yield_litres=yld_ext,
            tank_capacity_litres=self.tank_capacity,
            water_tariff_per_kl=self.municipal_tariff,
            installation_cost=capex_ext,
            annual_tanker_spend=200000.0,
            annual_tanker_volume_litres=self.annual_tanker_volume,
            annual_municipal_spend=self.annual_municipal_spend,
        )

        # Net annual savings in year 1 should decrease by exactly the AMC on the incremental capex
        delta_capex = capex_ext - capex_sat
        expected_amc_increase = delta_capex * 0.03
        delta_net_savings = res_sat.yearly_breakdown[0].savings - res_ext.yearly_breakdown[0].savings
        self.assertAlmostEqual(delta_net_savings, expected_amc_increase, places=2)

        # Payback years must lengthen for extreme oversized roof
        self.assertIsNotNone(res_sat.payback_years)
        if res_ext.payback_years is not None:
            self.assertGreater(res_ext.payback_years, res_sat.payback_years)

    def test_zero_or_negative_tariff_raises_value_error(self):
        """Test tariff guard in simulate_roi."""
        with self.assertRaises(ValueError):
            simulate_roi(
                daily_demand_lpd=self.daily_demand_lpd,
                annual_yield_litres=1000000.0,
                tank_capacity_litres=self.tank_capacity,
                water_tariff_per_kl=0.0,
                installation_cost=self.capex,
            )

    def test_payback_interpolates_within_first_crossing_year(self):
        result = simulate_roi(
            daily_demand_lpd=1000,
            annual_yield_litres=365000,
            tank_capacity_litres=50000,
            water_tariff_per_kl=15,
            installation_cost=180000,
            years=10,
            tariff_escalation_rate=0.10,
            annual_tanker_spend=100000,
            annual_tanker_volume_litres=365000,
            annual_municipal_spend=0,
        )

        year_one_net = 100000 - 180000 * 0.03
        year_two_net = 100000 * 1.10 - 180000 * 0.03
        expected_payback = 1 + (180000 - year_one_net) / year_two_net
        self.assertAlmostEqual(result.payback_years, round(expected_payback, 2))
        self.assertAlmostEqual(
            result.yearly_breakdown[1].cumulative_without_rwh
            - result.yearly_breakdown[1].cumulative_with_rwh,
            year_one_net + year_two_net - 180000,
        )

    def test_payback_is_zero_for_zero_capex_and_none_when_outside_horizon(self):
        free_install = simulate_roi(
            daily_demand_lpd=1000,
            annual_yield_litres=365000,
            tank_capacity_litres=50000,
            water_tariff_per_kl=15,
            installation_cost=0,
            annual_tanker_spend=100000,
            annual_tanker_volume_litres=365000,
            annual_municipal_spend=0,
        )
        no_payback = simulate_roi(
            daily_demand_lpd=1000,
            annual_yield_litres=365000,
            tank_capacity_litres=50000,
            water_tariff_per_kl=15,
            installation_cost=2000000,
            annual_tanker_spend=100000,
            annual_tanker_volume_litres=365000,
            annual_municipal_spend=0,
        )

        self.assertEqual(free_install.payback_years, 0)
        self.assertIsNone(no_payback.payback_years)


if __name__ == "__main__":
    unittest.main()
