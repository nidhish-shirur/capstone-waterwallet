import datetime
import httpx
from typing import Optional

# Open-Meteo archive API — free, no key required
OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"


async def fetch_monthly_rainfall(
    latitude: float,
    longitude: float,
    year: Optional[int] = None,
) -> list[float]:
    """
    Fetch historical monthly rainfall totals (mm) for the given coordinates
    using the Open-Meteo Climate Archive API.

    Uses the most recent complete calendar year if `year` is not specified.

    Args:
        latitude: Location latitude.
        longitude: Location longitude.
        year: Calendar year to fetch (defaults to last complete year).

    Returns:
        List of 12 monthly rainfall totals in mm (Jan → Dec).
    """
    if year is None:
        year = datetime.date.today().year - 1

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": f"{year}-01-01",
        "end_date": f"{year}-12-31",
        "daily": "precipitation_sum",
        "timezone": "auto",
    }

    from fastapi import HTTPException

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Rainfall data service timed out. Please try again.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Rainfall data service returned error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach rainfall data service: {e}")

    daily_dates: list[str] = data["daily"]["time"]
    daily_precip: list[float] = data["daily"]["precipitation_sum"]

    # Aggregate daily → monthly
    monthly: list[float] = [0.0] * 12
    for date_str, precip in zip(daily_dates, daily_precip):
        month_idx = int(date_str[5:7]) - 1   # "YYYY-MM-DD" → 0-indexed month
        monthly[month_idx] += precip or 0.0

    return [round(m, 2) for m in monthly]
