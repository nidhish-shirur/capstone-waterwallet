from fastapi import APIRouter
from models.schemas import ROIRequest, ROIResponse
from services.roi_engine import simulate_roi

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
    )
