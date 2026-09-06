"""
Tier 1 Safety Gate — WaterWallet
=================================
Hard hydrogeological checks that run BEFORE the ML classifier.
No model confidence score can override a physical safety constraint.

Three checks (in order):
  1. Coastal distance ≤ 2.5 km → Force Storage-Only (seawater intrusion risk)
  2. Soil perm class == 1 AND no borewell → Force Storage-Only (recharge infeasible)
  3. Borewell present AND depth < 30 m → Force Storage-Only (too shallow for injection)

References:
  CGWB guideline: minimum 2.5 km from coast for safe groundwater recharge.
  BMC RWH Guidelines 2007, 2019.
"""

from typing import Optional


COASTAL_THRESHOLD_KM = 2.5
BOREWELL_MIN_DEPTH_M = 30


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

    # Check 2 — Soil physically unable to absorb recharge AND no borewell
    if soil_perm == 1 and borewell == 0:
        return {
            "config": "Storage-Only",
            "source": "tier1_safety_gate",
            "safety_triggered": True,
            "reason": (
                "Soil permeability class 1 (very low / hard rock) with no existing "
                "borewell. Surface recharge is physically infeasible because water "
                "cannot penetrate the ground, and there is no injection infrastructure."
            ),
        }

    # Check 3 — Borewell too shallow for safe injection
    if borewell == 1 and borewell_depth < BOREWELL_MIN_DEPTH_M:
        return {
            "config": "Storage-Only",
            "source": "tier1_safety_gate",
            "safety_triggered": True,
            "reason": (
                f"Borewell depth is {borewell_depth:.0f} m, which is below the "
                f"minimum {BOREWELL_MIN_DEPTH_M} m required for safe artificial "
                "recharge injection. A shallow borewell risks aquifer contamination."
            ),
        }

    # All checks passed — allow ML classifier to run
    return None
