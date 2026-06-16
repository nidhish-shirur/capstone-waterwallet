from fastapi import APIRouter
from models.schemas import CatchmentRequest, CatchmentResponse
from services.yield_engine import calculate_yield
from services.rainfall_api import fetch_monthly_rainfall

router = APIRouter()


@router.post("/calculate", response_model=CatchmentResponse)
async def catchment_calculate(payload: CatchmentRequest) -> CatchmentResponse:
    """
    Fetch real rainfall data from Open-Meteo for the given lat/lon,
    then calculate annual and monthly rainwater yield for the roof area.
    """
    monthly_rainfall = await fetch_monthly_rainfall(payload.latitude, payload.longitude)
    annual_rainfall = sum(monthly_rainfall)

    monthly_yield = [
        calculate_yield(
            rain_mm=r,
            roof_area_sqm=payload.roof_area_sqm,
            roof_surface_type=payload.roof_surface_type,
        )
        for r in monthly_rainfall
    ]
    annual_yield = sum(monthly_yield)

    return CatchmentResponse(
        annual_rainfall_mm=round(annual_rainfall, 2),
        monthly_rainfall_mm=[round(r, 2) for r in monthly_rainfall],
        annual_yield_litres=round(annual_yield, 2),
        monthly_yield_litres=[round(y, 2) for y in monthly_yield],
    )
