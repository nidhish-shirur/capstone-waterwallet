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
) -> ROIResponse:
    """
    Simulate a multi-year ROI for a rainwater harvesting system.

    Logic:
    - Usable yield is capped by demand and tank capacity.
    - Yield offsets high-cost tanker water first, then municipal water.
    - Compounds tanker tariff by escalation rate and municipal tariff by 5%.
    - Subtracts 3% of installation cost as annual maintenance cost (AMC) from savings.
    - Payback year = first year where cumulative net savings >= installation_cost.
    """
    max_storable_yield = tank_capacity_litres * 4.0
    storable_annual_yield = min(annual_yield_litres, max_storable_yield)

    annual_demand_litres = daily_demand_lpd * 365
    effective_annual_yield = min(storable_annual_yield, annual_demand_litres)

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
    annual_maintenance_cost = installation_cost * 0.03

    # Guard: zero tariff ⟹ zero annual_savings
    if water_tariff_per_kl <= 0:
        raise ValueError(
            f"water_tariff_per_kl must be > 0, got {water_tariff_per_kl}."
        )

    yearly_breakdown: list[YearlyROI] = []
    cumulative_savings = 0.0
    payback_years: Optional[float] = None
    ten_year_savings = 0.0

    current_tanker_rate = tanker_rate_per_kl
    current_municipal_rate = water_tariff_per_kl

    for year in range(1, max(years, 10) + 1):
        # Volumetric savings this year
        year_savings = (offset_tanker_kl * current_tanker_rate) + (offset_municipal_kl * current_municipal_rate)
        # Net savings after deducting AMC
        net_savings = year_savings - annual_maintenance_cost
        
        if year <= years:
            cumulative_savings += net_savings
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
                )
            )
            
        if year <= 10:
            ten_year_savings += net_savings
            
        current_tanker_rate *= (1 + tariff_escalation_rate)
        current_municipal_rate *= 1.05

    return ROIResponse(
        payback_years=payback_years,
        total_period_savings=round(cumulative_savings, 2),
        ten_year_savings=round(ten_year_savings, 2),
        yearly_breakdown=yearly_breakdown,
    )
