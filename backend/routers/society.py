from fastapi import APIRouter
from models.schemas import SocietyBaselineRequest, SocietyBaselineResponse
from models.constants import IS_LPCD
from services.demand_engine import calculate_demand

router = APIRouter()


@router.post("/baseline", response_model=SocietyBaselineResponse)
def society_baseline(payload: SocietyBaselineRequest) -> SocietyBaselineResponse:
    """
    Calculate daily water demand for a housing society using IS 1172.

    Delegates entirely to services.demand_engine.calculate_demand so that
    the demand formula lives in exactly one place.

    - Uses 135 LPCD as the baseline (overridable via lpcd_override)
    - Adds a 10 % peak-demand buffer (DEMAND_BUFFER_FACTOR in constants)
    """
    # Use explicit None check — a zero override is technically valid (edge-case)
    # and a truthiness check would silently fall back to IS_LPCD for it.
    lpcd = payload.lpcd_override if payload.lpcd_override is not None else IS_LPCD

    result = calculate_demand(
        num_flats=payload.num_flats,
        occupants_per_flat=payload.occupants_per_flat,
        lpcd=lpcd,
    )
    return SocietyBaselineResponse(**result)
