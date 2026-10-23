from math import floor

from models.constants import (
    IS_LPCD,
    POTABLE_LPCD,
    NON_POTABLE_LPCD,
    DEMAND_BUFFER_FACTOR,
    UFW_LOSS_FACTOR,
)


def _round_half_up(value: float, digits: int = 0) -> float | int:
    scale = 10 ** digits
    rounded = floor(value * scale + 0.5) / scale
    return int(rounded) if digits == 0 else rounded


def calculate_demand(
    num_flats: int,
    occupants_per_flat: float = 3.5,
    lpcd: float = IS_LPCD,
    include_losses: bool = True,
) -> dict:
    """
    Calculate daily water demand per IS 1172 with UFW, with potable and non-potable breakdown.

    Args:
        num_flats: Number of residential units.
        occupants_per_flat: Average occupants per unit.
        lpcd: Litres Per Capita Per Day (defaults to IS 1172 value of 135).
        include_losses: Whether to include 15% UFW distribution losses.

    Returns:
        dict with total_occupants, base_demand_lpd, daily_demand_lpd,
        potable_demand_lpd, non_potable_demand_lpd
    """
    total_occupants = int(num_flats * occupants_per_flat)
    base = total_occupants * lpcd
    after_ufw = base * (1 + UFW_LOSS_FACTOR) if include_losses else base
    adjusted_demand = _round_half_up(after_ufw * DEMAND_BUFFER_FACTOR)

    # Potable (70 LPCD) vs Non-Potable (65 LPCD) breakdown
    # If lpcd is overridden, scale proportionately
    potable_ratio = POTABLE_LPCD / IS_LPCD
    adjusted_potable = _round_half_up(adjusted_demand * potable_ratio)
    adjusted_non_potable = adjusted_demand - adjusted_potable

    base_potable = total_occupants * POTABLE_LPCD
    base_non_potable = total_occupants * NON_POTABLE_LPCD

    return {
        "total_occupants": total_occupants,
        "base_demand_lpd": _round_half_up(base, 2),
        "daily_demand_lpd": float(adjusted_demand),
        "daily_demand_with_buffer_lpd": float(adjusted_demand),
        "potable_demand_lpd": float(adjusted_potable),
        "non_potable_demand_lpd": float(adjusted_non_potable),
        "base_potable_demand_lpd": _round_half_up(base_potable, 2),
        "base_non_potable_demand_lpd": _round_half_up(base_non_potable, 2),
        "potable_lpcd": POTABLE_LPCD,
        "non_potable_lpcd": NON_POTABLE_LPCD,
    }
