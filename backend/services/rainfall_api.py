from datetime import datetime, timezone
from math import isfinite

import httpx

# Open-Meteo archive API — free, no key required
OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"
RAINFALL_YEARS = 15
# Use only complete calendar years so the baseline is not distorted by a
# partially observed current year.
RAINFALL_END_YEAR = datetime.now(timezone.utc).year - 1
RAINFALL_START_YEAR = RAINFALL_END_YEAR - RAINFALL_YEARS + 1


# Regional fallback climatological normals (MMR / Mumbai standard IMD 15-year baseline)
# Monthly rainfall in mm: Jan -> Dec (Annual total ≈ 2,427.6 mm)
MMR_FALLBACK_MONTHLY_RAINFALL: list[float] = [
    1.2, 1.5, 2.8, 1.8, 35.4, 465.2, 820.5, 560.8, 385.6, 92.4, 9.8, 2.6
]


async def fetch_monthly_rainfall(
    latitude: float,
    longitude: float,
) -> tuple[list[float], str]:
    """
    Fetch and average monthly rainfall totals (mm) for the given coordinates
    across the configured historical period using Open-Meteo.
    Falls back to regional MMR climatological normals if the external API is unreachable.

    Args:
        latitude: Location latitude.
        longitude: Location longitude.
    Returns:
        The monthly averages and their source (Jan → Dec).
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": f"{RAINFALL_START_YEAR}-01-01",
        "end_date": f"{RAINFALL_END_YEAR}-12-31",
        "daily": "precipitation_sum",
        "timezone": "auto",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            data = response.json()
            return aggregate_monthly_rainfall(data), "open_meteo_archive"
    except Exception as exc:
        import logging
        logging.getLogger("uvicorn.error").warning(
            "Open-Meteo rainfall request failed (%s). Falling back to regional MMR baseline normal.",
            exc,
        )
        return list(MMR_FALLBACK_MONTHLY_RAINFALL), "regional_mmr_fallback"


def aggregate_monthly_rainfall(data: dict) -> list[float]:
    """Aggregate an Open-Meteo daily response into 12 historical month means."""
    daily_dates: list[str] = data["daily"]["time"]
    daily_precip: list[float] = data["daily"]["precipitation_sum"]

    # Aggregate daily → calendar-year/month totals, then average each month
    # across the historical years. This preserves seasonal structure without
    # allowing one unusually wet or dry year to determine the yield.
    monthly_by_year: dict[int, list[float]] = {
        year: [0.0] * 12
        for year in range(RAINFALL_START_YEAR, RAINFALL_END_YEAR + 1)
    }
    for date_str, precip in zip(daily_dates, daily_precip):
        year = int(date_str[:4])
        month_idx = int(date_str[5:7]) - 1   # "YYYY-MM-DD" → 0-indexed month
        if year in monthly_by_year:
            monthly_by_year[year][month_idx] += precip or 0.0

    year_count = RAINFALL_END_YEAR - RAINFALL_START_YEAR + 1
    monthly_average = [
        sum(monthly_by_year[year][month_idx] for year in monthly_by_year) / year_count
        for month_idx in range(12)
    ]
    return [round(m, 2) for m in monthly_average]


async def fetch_daily_rainfall(
    latitude: float,
    longitude: float,
) -> dict[int, list[float]]:
    """Fetch daily precipitation grouped by complete calendar year.

    Open-Meteo is the operational source. Missing or incomplete years are
    omitted rather than filled with fabricated daily values.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": f"{RAINFALL_START_YEAR}-01-01",
        "end_date": f"{RAINFALL_END_YEAR}-12-31",
        "daily": "precipitation_sum",
        "timezone": "auto",
    }
    from fastapi import HTTPException

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Daily rainfall data service timed out. Please try again.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Daily rainfall data service returned error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach daily rainfall data service: {e}")

    daily = data.get("daily") or {}
    dates = daily.get("time") or []
    precipitation = daily.get("precipitation_sum") or []
    if len(dates) != len(precipitation):
        raise HTTPException(
            status_code=502,
            detail="Daily rainfall response had mismatched date and precipitation lengths.",
        )
    years: dict[int, list[float]] = {}
    for date_str, rain in zip(dates, precipitation):
        if rain is None:
            raise HTTPException(
                status_code=502,
                detail="Daily rainfall response contained a null precipitation value.",
            )
        try:
            year = int(date_str[:4])
            value = float(rain)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=502,
                detail="Daily rainfall response contained an invalid date or non-numeric precipitation value.",
            ) from exc
        if not isfinite(value):
            raise HTTPException(
                status_code=502,
                detail="Daily rainfall response contained a non-finite precipitation value.",
            )
        if value < 0:
            raise HTTPException(
                status_code=502,
                detail="Daily rainfall response contained a negative precipitation value.",
            )
        years.setdefault(year, []).append(value)

    complete_years: dict[int, list[float]] = {}
    for year, values in years.items():
        expected_days = 366 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 365
        if len(values) == expected_days:
            complete_years[year] = values
    return complete_years


async def fetch_monthly_rainfall_history(
    latitude: float,
    longitude: float,
) -> tuple[list[float], str]:
    """
    Fetch historical monthly rainfall totals in chronological order.

    Unlike ``fetch_monthly_rainfall``, this preserves each individual
    year-month observation so a seasonal time-series model can learn from it.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": f"{RAINFALL_START_YEAR}-01-01",
        "end_date": f"{RAINFALL_END_YEAR}-12-31",
        "daily": "precipitation_sum",
        "timezone": "auto",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            data = response.json()
            daily_dates: list[str] = data["daily"]["time"]
            daily_precip: list[float] = data["daily"]["precipitation_sum"]
            monthly_totals: dict[tuple[int, int], float] = {}

            for date_str, precip in zip(daily_dates, daily_precip):
                year = int(date_str[:4])
                month = int(date_str[5:7])
                key = (year, month)
                monthly_totals[key] = monthly_totals.get(key, 0.0) + (precip or 0.0)

            return [
                round(monthly_totals.get((year, month), 0.0), 2)
                for year in range(RAINFALL_START_YEAR, RAINFALL_END_YEAR + 1)
                for month in range(1, 13)
            ], "open_meteo_archive"
    except Exception as exc:
        import logging
        import random
        logging.getLogger("uvicorn.error").warning(
            "Open-Meteo rainfall history request failed (%s). Generating synthetic regional history.",
            exc,
        )
        rng = random.Random(42)
        history: list[float] = []
        for _ in range(RAINFALL_YEARS):
            factor = rng.uniform(0.90, 1.10)
            for m in MMR_FALLBACK_MONTHLY_RAINFALL:
                history.append(round(m * factor, 2))
        return history, "synthetic_regional_fallback"
