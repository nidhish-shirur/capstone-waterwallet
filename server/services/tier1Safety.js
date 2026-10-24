export const COASTAL_THRESHOLD_KM = 2.5;
export const BOREWELL_MIN_DEPTH_M = 30;
export const MIN_RECHARGE_SOIL_PERM = 2;

export function tier1SafetyGate({
  coastal_km,
  soil_perm,
  borewell,
  borewell_depth,
}) {
  const cKm = Number.isFinite(Number(coastal_km)) ? Math.max(0, Number(coastal_km)) : 10.0;
  const bw = Number(borewell) === 1 ? 1 : 0;
  const bwDepth = Number.isFinite(Number(borewell_depth)) ? Math.max(0, Number(borewell_depth)) : 0;
  const sPerm = Number.isFinite(Number(soil_perm)) ? Math.max(1, Math.min(5, Math.round(Number(soil_perm)))) : 3;

  // Check 1 — Seawater intrusion risk
  if (cKm <= COASTAL_THRESHOLD_KM) {
    return {
      config: "Storage-Only",
      source: "tier1_safety_gate",
      safety_triggered: true,
      reason: `Site is only ${cKm.toFixed(1)} km from the coast. CGWB guidelines require a minimum of ${COASTAL_THRESHOLD_KM} km from the coastline before groundwater recharge is safe. Recharge at this location risks seawater intrusion into aquifers.`,
    };
  }

  // Check 2 — No borewell infrastructure exists
  if (bw === 0) {
    return {
      config: "Storage-Only",
      source: "tier1_safety_gate",
      safety_triggered: true,
      reason: "No existing borewell on site. Artificial groundwater recharge requires dedicated injection borewell infrastructure. Without an existing borewell, direct Storage-Only is the physically and economically feasible configuration.",
    };
  }

  // Check 3 — Soil physically unable to absorb recharge
  if (sPerm < MIN_RECHARGE_SOIL_PERM) {
    return {
      config: "Storage-Only",
      source: "tier1_safety_gate",
      safety_triggered: true,
      reason: "Soil permeability class 1 (very low / dense impermeable clay or hard rock). Recharge water cannot percolate safely, risking surface waterlogging and poor aquifer intake.",
    };
  }

  // Check 4 — Borewell too shallow for safe injection
  if (bw === 1 && bwDepth < BOREWELL_MIN_DEPTH_M) {
    return {
      config: "Storage-Only",
      source: "tier1_safety_gate",
      safety_triggered: true,
      reason: `Borewell depth is ${Math.round(bwDepth)} m, which is below the minimum ${BOREWELL_MIN_DEPTH_M} m required for safe artificial recharge injection. A shallow borewell risks unconfined aquifer contamination.`,
    };
  }

  return null;
}
