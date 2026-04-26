from models.constants import IS_LPCD, DEMAND_BUFFER_FACTOR


def calculate_demand(
    num_flats: int,
    occupants_per_flat: float = 3.5,
    lpcd: float = IS_LPCD,
) -> dict:
    """
    Calculate daily water demand per IS 1172.

    Args:
        num_flats: Number of residential units.
        occupants_per_flat: Average occupants per unit.
        lpcd: Litres Per Capita Per Day (defaults to IS 1172 value of 135).

    Returns:
        dict with total_occupants, daily_demand_lpd, daily_demand_with_buffer_lpd
    """
    total_occupants = int(num_flats * occupants_per_flat)
    daily_demand = total_occupants * lpcd
    daily_demand_buffered = daily_demand * DEMAND_BUFFER_FACTOR

    return {
        "total_occupants": total_occupants,
        "daily_demand_lpd": round(daily_demand, 2),
        "daily_demand_with_buffer_lpd": round(daily_demand_buffered, 2),
    }
