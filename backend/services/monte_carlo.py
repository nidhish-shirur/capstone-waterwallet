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
from typing import Optional


# ---------------------------------------------------------------------------
# Constants (match the notebook)
# ---------------------------------------------------------------------------
TANKER_COST_PER_KL = 800.0       # INR per KL (tanker water)
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
    tanker_rate_per_kl: float = TANKER_COST_PER_KL,
    inflation_rate: float = INFLATION_RATE,
    n_scenarios: int = N_SCENARIOS,
    percentile_csv_path: Optional[str] = None,
    usability_factor: float = 0.80,
    runoff_coeff: float = 0.90,
) -> dict:
    """
    Run the Monte Carlo ROI simulation.

    For each scenario:
      1. Sample monthly rainfall from U[P10, P90] for each of 12 months.
      2. Convert to monthly yield using the physics formula.
      3. Demand-gate: usable_yield = min(yield, monthly_demand).
      4. Compute annual usable yield (KL).
      5. Run the 10-year ROI loop and find break-even year.

    Args:
        rooftop_area_m2:      Rooftop catchment area in m².
        monthly_demand_kl:    Monthly water demand cap in KL.
        capex_inr:            One-time installation cost in INR.
        tanker_rate_per_kl:   Cost of tanker water in INR/KL.
        inflation_rate:       Annual tanker price inflation rate.
        n_scenarios:          Number of Monte Carlo samples.
        percentile_csv_path:  Path to thane_rain_percentiles.csv (optional).
        usability_factor:     Fraction of roof that is usable (default 0.80).
        runoff_coeff:         Runoff coefficient (default 0.90 for concrete).

    Returns:
        {
          "median_breakeven_year": int,
          "mean_breakeven_year": float,
          "prob_breakeven_by_year": {"1": 0.02, "2": 0.45, ...},  # years 1-10
          "percentiles": {"p10": int, "p50": int, "p90": int},
          "n_scenarios": int,
          "never_break_even_pct": float,
          "scenarios_used": "percentile_table" | "fallback_uniform",
        }
    """
    percentile_table = _load_percentile_table(percentile_csv_path)
    rng = np.random.default_rng(RNG_SEED)

    breakeven_years = []

    for _ in range(n_scenarios):
        # ── Sample 12 monthly rainfall values ──────────────────────────────
        if percentile_table is not None:
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

        # ── Demand-gate ────────────────────────────────────────────────────
        monthly_usable_kl = np.minimum(monthly_yield_kl, monthly_demand_kl)
        annual_usable_kl  = monthly_usable_kl.sum()

        # ── 10-year ROI loop ───────────────────────────────────────────────
        annual_opex   = capex_inr * AMC_RATE
        first_yr_sav  = annual_usable_kl * tanker_rate_per_kl
        cumulative    = -capex_inr
        breakeven     = None

        for yr in range(1, ROI_YEARS + 1):
            net = first_yr_sav * (1 + inflation_rate) ** (yr - 1) - annual_opex
            cumulative += net
            if breakeven is None and cumulative >= 0:
                breakeven = yr

        breakeven_years.append(breakeven if breakeven is not None else ROI_YEARS + 1)

    breakeven_arr = np.array(breakeven_years)
    valid_mask    = breakeven_arr <= ROI_YEARS

    # Probability of break-even by each year
    prob_by_year = {
        str(yr): round(float((breakeven_arr <= yr).mean()), 4)
        for yr in range(1, ROI_YEARS + 1)
    }

    valid_years = breakeven_arr[valid_mask]
    median_be   = int(np.median(valid_years)) if valid_years.size > 0 else ROI_YEARS + 1

    return {
        "median_breakeven_year":  median_be,
        "mean_breakeven_year":    round(float(breakeven_arr[valid_mask].mean()), 2)
                                  if valid_years.size > 0 else None,
        "prob_breakeven_by_year": prob_by_year,
        "percentiles": {
            "p10": int(np.percentile(breakeven_arr, 10)),
            "p50": int(np.percentile(breakeven_arr, 50)),
            "p90": int(np.percentile(breakeven_arr, 90)),
        },
        "n_scenarios":           n_scenarios,
        "never_break_even_pct":  round(float((~valid_mask).mean()) * 100, 1),
        "scenarios_used":        "percentile_table" if percentile_table is not None
                                 else "fallback_uniform",
    }
