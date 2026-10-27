from models.schemas import ROIResponse, YearlyROI
from typing import Optional


def simulate_roi(
    daily_demand_lpd: float,
    annual_yield_litres: float,
    tank_capacity_litres: float,
    water_tariff_per_kl: float,
    installation_cost: float,
    years: int = 10,
    tariff_escalation_rate: float = 0.0,
    annual_tanker_spend: float = 200000.0,
    annual_tanker_volume_litres: float = 1333333.3,
    annual_municipal_spend: float = 46000.0,
    annual_opex_inr: Optional[float] = None,
) -> ROIResponse:
    """
    Simulate a multi-year ROI for a rainwater harvesting system.

    Methodology & Yield Harmonization:
    - Theoretical Unconstrained Ceiling: This deterministic engine models the
      potential return assuming 100% of harvestable annual rainwater is utilized
      up to the eligible non-potable annual demand (min(yield, demand)).
    - Storage-Constrained Reality: Real systems are limited by seasonal monsoon
      concentration and finite tank storage. The Monte Carlo (monte_carlo.py)
      and daily tank sizing (tank_sizer.py) services enforce sequential monthly
      and daily tank water balances, where excess monsoon inflow spills as overflow.
      Consequently, deterministic payback represents an optimal upper bound, whereas
      Monte Carlo payback reflects a conservative, storage-constrained reality.
    - Yield offsets high-cost tanker water first, then municipal water.
    - Compounds tanker tariff by escalation rate and municipal tariff by 5%.
    - Subtracts 3% of installation cost as annual maintenance cost (AMC) from savings.
    - Payback year = first year where cumulative net savings >= installation_cost.
    - Returns cumulative_without_rwh / cumulative_with_rwh for break-even chart.
    """
    annual_demand_litres = daily_demand_lpd * 365
    # The annual yield already comes from the roof/rainfall calculation.
    # Deterministic simulation assumes an ideal seasonal buffer up to annual demand.
    effective_annual_yield = min(annual_yield_litres, annual_demand_litres)

    # Volumetric offsets
    offset_tanker = min(effective_annual_yield, annual_tanker_volume_litres)
    offset_municipal = min(
        effective_annual_yield - offset_tanker,
        max(0.0, annual_demand_litres - annual_tanker_volume_litres)
    )

    offset_tanker_kl = offset_tanker / 1000.0
    offset_municipal_kl = offset_municipal / 1000.0

    tanker_rate_per_kl = (
        (annual_tanker_spend / (annual_tanker_volume_litres / 1000.0))
        if annual_tanker_volume_litres > 0
        else 150.0
    )
    annual_maintenance_cost = (
        annual_opex_inr if annual_opex_inr is not None else installation_cost * 0.03
    )

    # Guard: zero tariff => zero annual_savings
    if water_tariff_per_kl <= 0:
        raise ValueError(
            f"water_tariff_per_kl must be > 0, got {water_tariff_per_kl}."
        )

    yearly_breakdown: list[YearlyROI] = []
    cumulative_savings = 0.0
    payback_years: Optional[float] = None
    ten_year_savings = 0.0

    # Expenditure-trajectory accumulators (in INR) for the break-even chart
    cumulative_without_rwh = 0.0        # path A: keep buying tanker + municipal water
    cumulative_with_rwh    = installation_cost  # path B: paid capex upfront

    current_tanker_rate    = tanker_rate_per_kl
    current_municipal_rate = water_tariff_per_kl

    # Track base spend (pre-escalation anchors)
    curr_base_tanker    = annual_tanker_spend
    curr_base_municipal = annual_municipal_spend

    # Keep the requested horizon for payback discovery, while the response
    # still exposes the separate ten_year_savings metric.
    for year in range(1, years + 1):
        # Volumetric savings this year (value of harvested water at current rates)
        year_savings = (offset_tanker_kl * current_tanker_rate) + (offset_municipal_kl * current_municipal_rate)
        # Net savings after deducting AMC
        net_savings = year_savings - annual_maintenance_cost

        # What the society would pay each year without RWH (escalating bills)
        year_without_rwh = curr_base_tanker + curr_base_municipal
        # With RWH: residual bills after harvest + maintenance
        year_with_rwh    = year_without_rwh - year_savings + annual_maintenance_cost

        if year <= years:
            cumulative_savings     += net_savings
            cumulative_without_rwh += year_without_rwh
            cumulative_with_rwh    += year_with_rwh
            net_benefit = cumulative_savings - installation_cost

            if payback_years is None and net_savings > 0 and cumulative_savings >= installation_cost:
                # Interpolate the exact payback point within the year.
                excess = cumulative_savings - installation_cost
                payback_years = round(year - (excess / net_savings), 2)

            yearly_breakdown.append(
                YearlyROI(
                    year=year,
                    savings=round(net_savings, 2),
                    cumulative_savings=round(cumulative_savings, 2),
                    net_benefit=round(net_benefit, 2),
                    cumulative_without_rwh=round(cumulative_without_rwh, 2),
                    cumulative_with_rwh=round(cumulative_with_rwh, 2),
                )
            )

        if year <= 10:
            ten_year_savings += net_savings

        current_tanker_rate    *= (1 + tariff_escalation_rate)
        current_municipal_rate *= 1.05
        curr_base_tanker       *= (1 + tariff_escalation_rate)
        curr_base_municipal    *= 1.05

    return ROIResponse(
        payback_years=payback_years,
        total_period_savings=round(cumulative_savings, 2),
        ten_year_savings=round(ten_year_savings, 2),
        yearly_breakdown=yearly_breakdown,
    )
