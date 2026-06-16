// ---------------------------------------------------------------------------
// Canonical water demand constants — single source of truth for the frontend.
// The Python backend mirrors these in backend/models/constants.py.
// ---------------------------------------------------------------------------

/** IS 1172 — Litres Per Capita Per Day (residential, with flush toilet + bath) */
export const IS_LPCD = 135;

/**
 * Unaccounted-For Water (UFW) distribution loss factor.
 * Adds 15% on top of occupied demand to model pipe leakage,
 * metering error, and unregistered connections — per CPHEEO norms.
 */
export const UFW_LOSS_FACTOR = 0.15;

/**
 * Peak-demand headroom buffer.
 * Adds 10% on top of UFW-adjusted demand to cover peak-hour surge
 * and modelling uncertainty — per IS 1172 §4.
 */
export const DEMAND_BUFFER_FACTOR = 1.10;

/** Runoff coefficients by roof surface type */
export const ROOF_RUNOFF_COEFFICIENTS = {
  concrete: 0.90,
  metal: 0.90,
  gravel: 0.45,
  tiles: 0.75,
};

// ---------------------------------------------------------------------------
// Seasonal demand distribution weights (Jan → Dec, index 0–11)
// Source: CPHEEO urban water demand norms for peninsular India
// ---------------------------------------------------------------------------
export const SEASONAL_WEIGHTS = [0.9, 0.9, 1.1, 1.2, 1.2, 0.9, 0.8, 0.8, 0.9, 1.0, 0.95, 0.95];
// Index 0=Jan, 4=May (peak summer), 6=Jul (monsoon trough)

// ---------------------------------------------------------------------------
// Canonical demand formula
// ---------------------------------------------------------------------------

/**
 * Calculate the full, authoritative daily water demand for a society.
 *
 * Formula (applied in strict sequence):
 *   1. base          = num_flats × occupants_per_flat × IS_LPCD
 *   2. amenityMult   = sum of active amenity multipliers
 *   3. afterAmenities = base × (1 + amenityMult)
 *   4. afterUFW      = afterAmenities × (1 + UFW_LOSS_FACTOR)   [if includeLosses]
 *   5. adjustedDemand = afterUFW × DEMAND_BUFFER_FACTOR          [peak-hour buffer]
 *
 * This function is the canonical implementation. VirtualMeter.jsx must call
 * this and push the result into WaterWalletContext so that every downstream
 * consumer (ROI Dashboard, report generator) uses the same figure.
 *
 * @param {object} params
 * @param {number} params.numFlats              - Number of residential units
 * @param {number} params.occupantsPerFlat      - Average occupants per unit
 * @param {number} [params.lpcd=IS_LPCD]        - Litres per capita per day override
 * @param {number} [params.amenityMultiplier=0] - Sum of active amenity multipliers
 * @param {boolean} [params.includeLosses=true] - Whether to apply UFW factor
 * @returns {{ baseDemand: number, afterAmenities: number, adjustedDemand: number }}
 */
export function calculateCanonicalDemand({
  numFlats,
  occupantsPerFlat,
  lpcd = IS_LPCD,
  amenityMultiplier = 0,
  includeLosses = true,
}) {
  const base           = numFlats * occupantsPerFlat * lpcd;
  const afterAmenities = base * (1 + amenityMultiplier);
  const afterUFW       = includeLosses ? afterAmenities * (1 + UFW_LOSS_FACTOR) : afterAmenities;
  const adjustedDemand = Math.round(afterUFW * DEMAND_BUFFER_FACTOR);
  return { baseDemand: Math.round(base), afterAmenities: Math.round(afterAmenities), adjustedDemand };
}
