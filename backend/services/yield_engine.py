from models.constants import ROOF_RUNOFF_COEFFICIENTS, USABILITY_FACTOR


def calculate_yield(rain_mm: float, roof_area_sqm: float, roof_surface_type: str = "concrete") -> float:
    """
    Calculate rainwater yield for a given rainfall depth and roof area.

    Formula:
        yield (litres) = rainfall (mm) × roof_area (m²) × runoff_coeff × usability_factor

    Note:
        1 mm of rain on 1 m² = 1 litre, so mm × m² = litres directly.

    Args:
        rain_mm: Rainfall depth in millimetres.
        roof_area_sqm: Usable roof catchment area in square metres.
        roof_surface_type: Type of roof surface (e.g. concrete, metal, gravel, tiles).

    Returns:
        Yield in litres.
    """
    coeff = ROOF_RUNOFF_COEFFICIENTS.get((roof_surface_type or "concrete").lower(), 0.90)
    yield_litres = rain_mm * roof_area_sqm * coeff * USABILITY_FACTOR
    return round(yield_litres, 2)
