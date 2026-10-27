"""
Monte Carlo ROI Simulation — WaterWallet
==========================================
Samples 1,000 possible annual yield scenarios from the historical
P10–P90 monthly rainfall distribution and computes the break-even
year for each, producing a probability distribution.

The output answers: "What is the probability of break-even by Year N?"
which is far more informative than a single deterministic break-even.

Method mirrors the Colab notebook (Cell 10).
"""

import numpy as np
import csv
import os
from math import isfinite
from typing import Optional


# ---------------------------------------------------------------------------
# Constants (match the notebook)
# ---------------------------------------------------------------------------
TANKER_COST_PER_KL = 175.0       # INR per KL (midpoint of the local ₹150–200/KL range)
INFLATION_RATE     = 0.08        # 8% annual tanker price inflation
AMC_RATE           = 0.03        # 3% annual maintenance contract on capex
ROI_YEARS          = 10
N_SCENARIOS        = 1_000
RNG_SEED           = 42


def _load_percentile_table(csv_path: Optional[str] = None) -> Optional[np.ndarray]:
    """
    Load the 12 × 3 monthly percentile table (P10/P50/P90) from CSV.
    Returns an (12, 3) array where columns are [p10, p50, p90] rainfall (mm).
    Returns None if the file does not exist yet (models not trained).
    """
    if csv_path is None:
        csv_path = os.path.join(
            os.path.dirname(__file__), "..", "ml_models", "thane_rain_percentiles.csv"
        )
    csv_path = os.path.normpath(csv_path)

    if not os.path.exists(csv_path):
        return None

    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append([float(row["p10"]), float(row["p50"]), float(row["p90"])])
    return np.array(rows)   # shape (12, 3)


def run_monte_carlo(
    rooftop_area_m2: float,
    monthly_demand_kl: float,
    capex_inr: float,
    tank_capacity_litres: float = 50000,
    rainfall_reduction_percent: float = 0,
    tanker_rate_per_kl: float = TANKER_COST_PER_KL,
    annual_tanker_volume_litres: float = 0,
    water_tariff_per_kl: float = 15.0,
    inflation_rate: float = INFLATION_RATE,
    n_scenarios: int = N_SCENARIOS,
    monthly_rainfall_mm: Optional[list[float]] = None,
    percentile_csv_path: Optional[str] = None,
    usability_factor: float = 0.80,
    runoff_coeff: float = 0.90,
    annual_opex_inr: Optional[float] = None,
) -> dict:
    """
    Run the Monte Carlo ROI simulation.

    For each scenario:
      1. Sample monthly rainfall from U[P10, P90] for each of 12 months.
      2. Convert to monthly yield using the physics formula.
      3. Demand-gate: usable_yield = min(yield, eligible non-potable monthly demand).
      4. Compute annual usable yield (KL).
      5. Run the 10-year ROI loop and find break-even year.

    Args:
        rooftop_area_m2:      Rooftop catchment area in m².
        monthly_demand_kl:         Monthly eligible non-potable demand cap in KL.
        capex_inr:            One-time installation cost in INR.
        tanker_rate_per_kl:   Cost of tanker water in INR/KL.
        inflation_rate:       Annual tanker price inflation rate.
        n_scenarios:          Number of Monte Carlo samples.
        percentile_csv_path:  Path to thane_rain_percentiles.csv (optional).
        usability_factor:     Fraction of roof that is usable (default 0.80).
        runoff_coeff:         Runoff coefficient (default 0.90 for concrete).

    Returns:
        {
          "median_breakeven_year": float,  # P50 across all scenarios; 11 means >10 years
          "mean_breakeven_year": float,
          "prob_breakeven_by_year": {"1": 0.02, "2": 0.45, ...},  # years 1-10
          "percentiles": {"p10": int, "p50": int, "p90": int},
          "n_scenarios": int,
          "never_break_even_pct": float,
          "scenarios_used": "percentile_table" | "fallback_uniform",
          "is_site_specific": bool,
        }
    """
    if monthly_rainfall_mm is not None:
        if len(monthly_rainfall_mm) != 12 or any(
            not isfinite(value) or value < 0 for value in monthly_rainfall_mm
        ):
            raise ValueError("monthly_rainfall_mm must contain 12 finite, non-negative values.")
        rainfall_baseline = np.asarray(monthly_rainfall_mm, dtype=float)
        scenario_source = "phase2_monthly_rainfall"
    else:
        rainfall_baseline = None
        percentile_table = _load_percentile_table(percentile_csv_path)
        scenario_source = "percentile_table" if percentile_table is not None else "fallback_uniform"
    rng = np.random.default_rng(RNG_SEED)

    breakeven_years = []

    for _ in range(n_scenarios):
        # ── Sample 12 monthly rainfall values ──────────────────────────────
        if rainfall_baseline is not None:
            monthly_rain_mm = np.array([
                rng.uniform(max(0.0, value * 0.8), value * 1.2)
                for value in rainfall_baseline
            ])
        elif percentile_table is not None:
            # Interpolate uniformly between P10 and P90 for each month
            monthly_rain_mm = np.array([
                rng.uniform(percentile_table[m, 0], percentile_table[m, 2])
                for m in range(12)
            ])
        else:
            # Fallback: rough Thane-like distribution (no CSV available)
            monthly_rain_mm = np.array([
                rng.uniform(0, 10),    # Jan
                rng.uniform(0, 8),     # Feb
                rng.uniform(0, 12),    # Mar
                rng.uniform(0, 20),    # Apr
                rng.uniform(5, 60),    # May
                rng.uniform(100, 350), # Jun
                rng.uniform(200, 600), # Jul
                rng.uniform(150, 500), # Aug
                rng.uniform(80, 250),  # Sep
                rng.uniform(20, 100),  # Oct
                rng.uniform(5, 40),    # Nov
                rng.uniform(0, 15),    # Dec
            ])

        # ── Physics yield formula ──────────────────────────────────────────
        monthly_yield_kl = (
            rooftop_area_m2
            * np.maximum(monthly_rain_mm, 0)
            * usability_factor
            * runoff_coeff
            / 1000.0
        )
        monthly_yield_kl *= 1 - (rainfall_reduction_percent / 100.0)

        # ── Monthly tank water balance ─────────────────────────────────────
        # Carry storage between months so the requested tank capacity affects
        # how much rainy-season water can serve later demand.
        tank_level_litres = 0.0
        monthly_demand_litres = monthly_demand_kl * 1000.0
        annual_usable_litres = 0.0
        for monthly_inflow_kl in monthly_yield_kl:
            available_litres = tank_level_litres + float(monthly_inflow_kl) * 1000.0
            served_litres = min(available_litres, monthly_demand_litres)
            annual_usable_litres += served_litres
            tank_level_litres = min(
                max(0.0, available_litres - served_litres),
                tank_capacity_litres,
            )
        annual_usable_kl = annual_usable_litres / 1000.0

        # ── 10-year ROI loop ───────────────────────────────────────────────
        annual_opex = (
            annual_opex_inr if annual_opex_inr is not None else capex_inr * AMC_RATE
        )
        annual_demand_litres = monthly_demand_kl * 1000 * 12
        offset_tanker_kl = min(annual_usable_kl, annual_tanker_volume_litres / 1000.0)
        offset_municipal_kl = min(
            max(0.0, annual_usable_kl - offset_tanker_kl),
            max(0.0, annual_demand_litres - annual_tanker_volume_litres) / 1000.0,
        )
        first_yr_tanker_sav = offset_tanker_kl * tanker_rate_per_kl
        first_yr_municipal_sav = offset_municipal_kl * water_tariff_per_kl
        cumulative    = -capex_inr
        breakeven     = None

        for yr in range(1, ROI_YEARS + 1):
            gross_savings = (
                first_yr_tanker_sav * (1 + inflation_rate) ** (yr - 1)
                + first_yr_municipal_sav * (1.05 ** (yr - 1))
            )
            net = gross_savings - annual_opex
            prev_cumulative = cumulative
            cumulative += net
            if breakeven is None and cumulative >= 0:
                deficit = -prev_cumulative
                fraction = deficit / net if net > 0 else 0.0
                breakeven = round((yr - 1) + fraction, 2)

        breakeven_years.append(breakeven if breakeven is not None else float(ROI_YEARS + 1))

    breakeven_arr = np.array(breakeven_years)
    valid_mask    = breakeven_arr <= ROI_YEARS

    # Probability of break-even by each year
    prob_by_year = {
        str(yr): round(float((breakeven_arr <= yr).mean()), 4)
        for yr in range(1, ROI_YEARS + 1)
    }

    valid_years = breakeven_arr[valid_mask]
    # Keep the median consistent with the full-sample P50. Non-break-even
    # scenarios remain right-censored at year 11 instead of being discarded.
    median_be   = round(float(np.median(breakeven_arr)), 2) if breakeven_arr.size > 0 else None

    return {
        "median_breakeven_year":  median_be,
        "mean_breakeven_year":    round(float(valid_years.mean()), 2)
                                  if valid_years.size > 0 else None,
        "prob_breakeven_by_year": prob_by_year,
        "percentiles": {
            "p10": round(float(np.percentile(breakeven_arr, 10)), 2),
            "p50": round(float(np.percentile(breakeven_arr, 50)), 2),
            "p90": round(float(np.percentile(breakeven_arr, 90)), 2),
        },
        "n_scenarios":           n_scenarios,
        "never_break_even_pct":  round(float((~valid_mask).mean()) * 100, 1),
        "scenarios_used":        scenario_source,
        "is_site_specific":       rainfall_baseline is not None,
    }
