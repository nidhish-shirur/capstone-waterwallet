from fastapi import APIRouter
from models.schemas import (
    CatchmentRequest,
    CatchmentResponse,
    RainfallForecastRequest,
    RainfallForecastResponse,
)
from services.yield_engine import calculate_yield
from services.rainfall_api import fetch_monthly_rainfall, fetch_monthly_rainfall_history
from services.rainfall_forecast import forecast_monthly_rainfall

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


@router.post("/forecast", response_model=RainfallForecastResponse)
async def catchment_forecast(payload: RainfallForecastRequest) -> RainfallForecastResponse:
    """Forecast the next rainfall months with seasonal Auto-SARIMA."""
    history = await fetch_monthly_rainfall_history(payload.latitude, payload.longitude)
    try:
        forecast = forecast_monthly_rainfall(history, payload.periods)
    except ValueError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail=str(exc)) from exc

    monthly_rainfall = forecast["monthly_rainfall_mm"]
    monthly_yield = [
        calculate_yield(
            rain_mm=rainfall,
            roof_area_sqm=payload.roof_area_sqm,
            roof_surface_type=payload.roof_surface_type,
        )
        for rainfall in monthly_rainfall
    ]

    return RainfallForecastResponse(
        annual_rainfall_mm=round(sum(monthly_rainfall), 2),
        monthly_rainfall_mm=monthly_rainfall,
        annual_yield_litres=round(sum(monthly_yield), 2),
        monthly_yield_litres=[round(value, 2) for value in monthly_yield],
        source="auto_sarima",
        model_order=forecast["model_order"],
        training_months=forecast["training_months"],
        confidence_intervals=forecast["confidence_intervals"],
    )
