from fastapi import APIRouter
from models.schemas import ROIRequest, ROIResponse, MonteCarloRequest, MonteCarloResponse
from services.roi_engine import simulate_roi
from services.monte_carlo import run_monte_carlo

router = APIRouter()


@router.post("/simulate", response_model=ROIResponse)
def roi_simulate(payload: ROIRequest) -> ROIResponse:
    """
    Run a multi-year ROI simulation for a rainwater harvesting system.
    Returns year-by-year savings, cumulative savings, and payback period.
    """
    return simulate_roi(
        daily_demand_lpd=payload.daily_demand_lpd,
        annual_yield_litres=payload.annual_yield_litres,
        tank_capacity_litres=payload.tank_capacity_litres,
        water_tariff_per_kl=payload.water_tariff_per_kl,
        installation_cost=payload.installation_cost,
        years=payload.years,
        tariff_escalation_rate=payload.tariff_escalation_rate,
        annual_tanker_spend=payload.annual_tanker_spend,
        annual_tanker_volume_litres=payload.annual_tanker_volume_litres,
        annual_municipal_spend=payload.annual_municipal_spend,
    )


@router.post("/monte-carlo", response_model=MonteCarloResponse)
def roi_monte_carlo(payload: MonteCarloRequest) -> MonteCarloResponse:
    """
    Run 1,000-scenario Monte Carlo ROI simulation.
    Samples monthly rainfall from the P10–P90 historical percentile table
    and returns the probability distribution of break-even year.

    Output: "72% chance of break-even by Year 3, 91% by Year 4."
    """
    result = run_monte_carlo(
        rooftop_area_m2   = payload.rooftop_area_m2,
        monthly_demand_kl = payload.monthly_demand_kl,
        capex_inr         = payload.capex_inr,
        tanker_rate_per_kl = payload.tanker_rate_per_kl,
        inflation_rate    = payload.inflation_rate,
        n_scenarios       = payload.n_scenarios,
    )
    return MonteCarloResponse(**result)
