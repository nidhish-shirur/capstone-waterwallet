import {
  IS_LPCD,
  POTABLE_LPCD,
  NON_POTABLE_LPCD,
  DEMAND_BUFFER_FACTOR,
  UFW_LOSS_FACTOR,
} from "../constants.js";

function roundHalfUp(value, digits = 0) {
  const scale = 10 ** digits;
  const rounded = Math.floor(value * scale + 0.5) / scale;
  return digits === 0 ? Math.round(rounded) : rounded;
}

export function calculateDemand({
  num_flats,
  occupants_per_flat = 3.5,
  lpcd = IS_LPCD,
  include_losses = true,
}) {
  const validFlats = Math.max(1, Math.floor(Number(num_flats) || 1));
  const validOccupants = Math.max(0.1, Number(occupants_per_flat) || 3.5);
  const validLpcd = Math.max(1, Number(lpcd) || IS_LPCD);
  const total_occupants = Math.max(1, Math.floor(validFlats * validOccupants));
  const base = total_occupants * validLpcd;
  const after_ufw = include_losses ? base * (1 + UFW_LOSS_FACTOR) : base;
  const adjusted_demand = roundHalfUp(after_ufw * DEMAND_BUFFER_FACTOR);

  const potable_ratio = POTABLE_LPCD / IS_LPCD;
  const adjusted_potable = roundHalfUp(adjusted_demand * potable_ratio);
  const adjusted_non_potable = adjusted_demand - adjusted_potable;

  const base_potable = total_occupants * POTABLE_LPCD;
  const base_non_potable = total_occupants * NON_POTABLE_LPCD;

  return {
    total_occupants,
    base_demand_lpd: roundHalfUp(base, 2),
    daily_demand_lpd: Number(adjusted_demand),
    daily_demand_with_buffer_lpd: Number(adjusted_demand),
    potable_demand_lpd: Number(adjusted_potable),
    non_potable_demand_lpd: Number(adjusted_non_potable),
    base_potable_demand_lpd: roundHalfUp(base_potable, 2),
    base_non_potable_demand_lpd: roundHalfUp(base_non_potable, 2),
    potable_lpcd: POTABLE_LPCD,
    non_potable_lpcd: NON_POTABLE_LPCD,
  };
}
