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
) -> ROIResponse:
    """
    Simulate a multi-year ROI for a rainwater harvesting system.

    Logic:
    - Monthly yield is bounded by tank capacity (assuming 1 fill per rainy month for simplified baseline).
      TODO: A more dynamic model should use average tank turnover cycles per month.
    - Effective annual yield is capped at annual demand (can't save more than you use).
    - Annual savings = effective_yield_kl × compounded_tariff_per_kl.
    - Payback year = first year where cumulative savings >= installation_cost.

    Args:
        daily_demand_lpd: Daily water demand in litres.
        annual_yield_litres: Total harvestable water per year.
        tank_capacity_litres: Tank size used to cap utilized yield.
        water_tariff_per_kl: Cost of municipal water per kilolitre in Year 1.
        installation_cost: One-time system installation cost in ₹.
        years: Number of years to simulate.
        tariff_escalation_rate: Annual municipal tariff escalation rate.

    Returns:
        ROIResponse with yearly breakdown and payback period.
    """
    # Cap usable yield by tank capacity constraint.
    # In a 4 month monsoon, max static storage capture without turnover is roughly 4 * tank_capacity.
    # For a robust calculation, we'll cap the total annual yield to min(annual_yield, tank_capacity * 4).
    # A true monthly sim would be better, but this addresses the API gap realistically.
    max_storable_yield = tank_capacity_litres * 4.0
    storable_annual_yield = min(annual_yield_litres, max_storable_yield)

    annual_demand_litres = daily_demand_lpd * 365
    effective_annual_yield = min(storable_annual_yield, annual_demand_litres)
    effective_yield_kl = effective_annual_yield / 1000

    # Guard: zero tariff ⟹ zero annual_savings ⟹ division-by-zero in payback
    # interpolation below. The Pydantic schema rejects this at the API boundary,
    # but we also guard here for any direct service-layer callers.
    if water_tariff_per_kl <= 0:
        raise ValueError(
            f"water_tariff_per_kl must be > 0, got {water_tariff_per_kl}. "
            "Zero tariff yields zero annual savings and a division-by-zero "
            "when interpolating the payback break-even year."
        )

    yearly_breakdown: list[YearlyROI] = []
    cumulative_savings = 0.0
    payback_years: Optional[float] = None
    
    # Track 10 year savings specifically for the benchmark field
    ten_year_savings = 0.0

    current_tariff = water_tariff_per_kl

    for year in range(1, max(years, 10) + 1):
        annual_savings = effective_yield_kl * current_tariff
        
        if year <= years:
            cumulative_savings += annual_savings
            net_benefit = cumulative_savings - installation_cost

            if payback_years is None and cumulative_savings >= installation_cost:
                # Interpolate the exact payback point within the year.
                excess = cumulative_savings - installation_cost
                payback_years = round(year - (excess / annual_savings), 2)

            yearly_breakdown.append(
                YearlyROI(
                    year=year,
                    savings=round(annual_savings, 2),
                    cumulative_savings=round(cumulative_savings, 2),
                    net_benefit=round(net_benefit, 2),
                )
            )
            
        if year <= 10:
            ten_year_savings += annual_savings
            
        current_tariff *= (1 + tariff_escalation_rate)

    return ROIResponse(
        payback_years=payback_years,
        total_period_savings=round(cumulative_savings, 2),
        ten_year_savings=round(ten_year_savings, 2),
        yearly_breakdown=yearly_breakdown,
    )
