from models.constants import IS_LPCD, DEMAND_BUFFER_FACTOR, UFW_LOSS_FACTOR


def calculate_demand(
    num_flats: int,
    occupants_per_flat: float = 3.5,
    lpcd: float = IS_LPCD,
    include_losses: bool = True,
) -> dict:
    """
    Calculate daily water demand per IS 1172 with UFW.

    Args:
        num_flats: Number of residential units.
        occupants_per_flat: Average occupants per unit.
        lpcd: Litres Per Capita Per Day (defaults to IS 1172 value of 135).
        include_losses: Whether to include 15% UFW distribution losses.

    Returns:
        dict with total_occupants, base_demand_lpd, daily_demand_lpd
    """
    total_occupants = int(num_flats * occupants_per_flat)
    base = total_occupants * lpcd
    after_ufw = base * (1 + UFW_LOSS_FACTOR) if include_losses else base
    adjusted_demand = round(after_ufw * DEMAND_BUFFER_FACTOR)

    return {
        "total_occupants": total_occupants,
        "base_demand_lpd": round(base, 2),
        "daily_demand_lpd": float(adjusted_demand),
        "daily_demand_with_buffer_lpd": float(adjusted_demand),
    }
