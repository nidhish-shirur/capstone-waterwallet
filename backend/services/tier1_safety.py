"""
Tier 1 Safety Gate — WaterWallet
=================================
Hard hydrogeological checks that run BEFORE the ML classifier.
No model confidence score can override a physical safety constraint.

Four checks (in order):
  1. Coastal distance ≤ 2.5 km → Force Storage-Only (seawater intrusion risk)
  2. No borewell → Force Storage-Only (recharge infrastructure unavailable)
  3. Soil perm class == 1 → Force Storage-Only (recharge infeasible)
  4. Borewell present AND depth < 30 m → Force Storage-Only (too shallow for injection)

References:
  CGWB guideline: minimum 2.5 km from coast for safe groundwater recharge.
  BMC RWH Guidelines 2007, 2019.
"""

from typing import Optional


COASTAL_THRESHOLD_KM = 2.5
BOREWELL_MIN_DEPTH_M = 30
MIN_RECHARGE_SOIL_PERM = 2


def tier1_safety_gate(
    coastal_km: float,
    soil_perm: int,
    borewell: int,
    borewell_depth: float,
) -> Optional[dict]:
    """
    Run the Tier 1 hard safety gate.

    Args:
        coastal_km:     Distance from coast in km.
        soil_perm:      Soil permeability class (1=very low … 5=very high).
        borewell:       1 if borewell exists, 0 otherwise.
        borewell_depth: Depth of borewell in metres (0 if no borewell).

    Returns:
        None if all checks pass (proceed to ML classifier).
        A dict with forced configuration and reason if any check fails:
            {
                "config": "Storage-Only",
                "source": "tier1_safety_gate",
                "safety_triggered": True,
                "reason": "<plain language reason>"
            }
    """
    # Check 1 — Seawater intrusion risk
    if coastal_km <= COASTAL_THRESHOLD_KM:
        return {
            "config": "Storage-Only",
            "source": "tier1_safety_gate",
            "safety_triggered": True,
            "reason": (
                f"Site is only {coastal_km:.1f} km from the coast. "
                f"CGWB guidelines require a minimum of {COASTAL_THRESHOLD_KM} km "
                "from the coastline before groundwater recharge is safe. "
                "Recharge at this location risks seawater intrusion into aquifers."
            ),
        }

    # Check 2 — No borewell infrastructure exists
    if borewell == 0:
        return {
            "config": "Storage-Only",
            "source": "tier1_safety_gate",
            "safety_triggered": True,
            "reason": (
                "No existing borewell on site. Artificial groundwater recharge "
                "requires dedicated injection borewell infrastructure. Without an "
                "existing borewell, direct Storage-Only is the physically and economically feasible configuration."
            ),
        }

    # Check 3 — Soil physically unable to absorb recharge
    if soil_perm < MIN_RECHARGE_SOIL_PERM:
        return {
            "config": "Storage-Only",
            "source": "tier1_safety_gate",
            "safety_triggered": True,
            "reason": (
                "Soil permeability class 1 (very low / dense impermeable clay or hard rock). "
                "Recharge water cannot percolate safely, risking surface waterlogging and poor aquifer intake."
            ),
        }

    # Check 4 — Borewell too shallow for safe injection
    if borewell == 1 and borewell_depth < BOREWELL_MIN_DEPTH_M:
        return {
            "config": "Storage-Only",
            "source": "tier1_safety_gate",
            "safety_triggered": True,
            "reason": (
                f"Borewell depth is {borewell_depth:.0f} m, which is below the "
                f"minimum {BOREWELL_MIN_DEPTH_M} m required for safe artificial "
                "recharge injection. A shallow borewell risks unconfined aquifer contamination."
            ),
        }

    # All checks passed — allow ML classifier to run
    return None
