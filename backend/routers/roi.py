from fastapi import APIRouter, HTTPException
from models.schemas import ROIRequest, ROIResponse, MonteCarloRequest, MonteCarloResponse, TankSizerRequest, TankSizerResponse
from services.roi_engine import simulate_roi
from services.monte_carlo import run_monte_carlo
from services.rainfall_api import fetch_daily_rainfall
from services.tank_sizer import size_tanks
from models.constants import ROOF_RUNOFF_COEFFICIENTS, USABILITY_FACTOR
from models.schemas import (
    ConfigurationComparisonRequest,
    ConfigurationComparisonResponse,
    CostEstimateRequest,
    CostEstimateResponse,
)
from services.cost_engine import estimate_project_cost
from services.configuration_comparison import compare_configurations

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
        annual_opex_inr=payload.annual_opex_inr,
    )


@router.post("/cost-estimate", response_model=CostEstimateResponse)
def roi_cost_estimate(payload: CostEstimateRequest) -> CostEstimateResponse:
    return estimate_project_cost(payload)


@router.post("/configuration-comparison", response_model=ConfigurationComparisonResponse)
async def roi_configuration_comparison(
    payload: ConfigurationComparisonRequest,
) -> ConfigurationComparisonResponse:
    rainfall_by_year = await fetch_daily_rainfall(payload.latitude, payload.longitude)
    if not rainfall_by_year:
        raise HTTPException(
            status_code=503,
            detail="No complete daily rainfall years were returned; configuration comparison was not fabricated.",
        )
    runoff_coefficient = ROOF_RUNOFF_COEFFICIENTS.get(
        payload.roof_surface_type.lower(), ROOF_RUNOFF_COEFFICIENTS["concrete"]
    )
    result = compare_configurations(payload, rainfall_by_year, runoff_coefficient)
    return ConfigurationComparisonResponse(**result)


@router.post("/monte-carlo", response_model=MonteCarloResponse)
def roi_monte_carlo(payload: MonteCarloRequest) -> MonteCarloResponse:
    """
    Run 1,000-scenario Monte Carlo ROI simulation.
    Samples monthly rainfall from the P10–P90 historical percentile table
    and returns the probability distribution of break-even year.

    Output: "72% chance of break-even by Year 3, 91% by Year 4."
    """
    runoff_coeff = ROOF_RUNOFF_COEFFICIENTS.get(
        (payload.roof_surface_type or "concrete").lower(), 0.90
    )
    result = run_monte_carlo(
        rooftop_area_m2   = payload.rooftop_area_m2,
        monthly_demand_kl = payload.monthly_demand_kl,
        capex_inr         = payload.capex_inr,
        annual_opex_inr    = payload.annual_opex_inr,
        tank_capacity_litres = payload.tank_capacity_litres,
        rainfall_reduction_percent = payload.rainfall_reduction_percent,
        tanker_rate_per_kl = payload.tanker_rate_per_kl,
        annual_tanker_volume_litres = payload.annual_tanker_volume_litres,
        water_tariff_per_kl = payload.water_tariff_per_kl,
        inflation_rate    = payload.inflation_rate,
        n_scenarios       = payload.n_scenarios,
        monthly_rainfall_mm = payload.monthly_rainfall_mm,
        runoff_coeff      = runoff_coeff,
    )
    return MonteCarloResponse(**result)


@router.post("/tank-sizer", response_model=TankSizerResponse)
async def roi_tank_sizer(payload: TankSizerRequest) -> TankSizerResponse:
    rainfall_by_year = await fetch_daily_rainfall(payload.latitude, payload.longitude)
    if not rainfall_by_year:
        raise HTTPException(status_code=503, detail="No complete daily rainfall years were returned; tank sizing was not fabricated.")
    result = size_tanks(
        rainfall_by_year=rainfall_by_year,
        candidate_capacities_litres=payload.candidate_capacities_litres,
        daily_demand_litres=payload.daily_demand_litres,
        usable_roof_area_sqm=payload.gross_roof_area_sqm * USABILITY_FACTOR,
        runoff_coefficient=ROOF_RUNOFF_COEFFICIENTS.get(payload.roof_surface_type.lower(), 0.90),
        first_flush_fraction=payload.first_flush_fraction,
        tanker_rate_per_litre=payload.tanker_rate_per_litre,
        tank_cost_per_litre=payload.tank_cost_per_litre,
        fixed_system_cost=payload.fixed_system_cost,
        reliability_target_percent=payload.reliability_target_percent,
        recharge_enabled=payload.recharge_enabled,
        recharge_capacity_litres_per_day=payload.recharge_capacity_litres_per_day,
    )
    return TankSizerResponse(**result)
