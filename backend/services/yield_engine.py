from models.constants import RUNOFF_COEFFICIENT, USABILITY_FACTOR


def calculate_yield(rain_mm: float, roof_area_sqm: float) -> float:
    """
    Calculate rainwater yield for a given rainfall depth and roof area.

    Formula:
        yield (litres) = rainfall (mm) × roof_area (m²) × runoff_coeff × usability_factor

    Note:
        1 mm of rain on 1 m² = 1 litre, so mm × m² = litres directly.

    Args:
        rain_mm: Rainfall depth in millimetres.
        roof_area_sqm: Usable roof catchment area in square metres.

    Returns:
        Yield in litres.
    """
    yield_litres = rain_mm * roof_area_sqm * RUNOFF_COEFFICIENT * USABILITY_FACTOR
    return round(yield_litres, 2)
