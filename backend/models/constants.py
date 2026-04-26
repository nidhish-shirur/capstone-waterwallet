# ---------------------------------------------------------------------------
# IS 1172 — Code of Basic Requirements for Water Supply, Drainage and Sanitation
# ---------------------------------------------------------------------------

# Litres Per Capita Per Day (residential, with flush toilet + bath)
IS_LPCD: float = 135.0

# Demand safety buffer (10 % above IS baseline)
DEMAND_BUFFER_FACTOR: float = 1.10

# ---------------------------------------------------------------------------
# Rainwater Harvesting — yield calculation
# ---------------------------------------------------------------------------

# Fraction of rainfall that becomes usable runoff (typical RCC roof)
RUNOFF_COEFFICIENT: float = 0.85

# Fraction of roof area considered usable after exclusions (equipment, shading)
USABILITY_FACTOR: float = 0.80

# Combined yield factor: rainfall × runoff × usability
YIELD_FACTOR: float = RUNOFF_COEFFICIENT * USABILITY_FACTOR   # ≈ 0.68

# ---------------------------------------------------------------------------
# Financial defaults
# ---------------------------------------------------------------------------

DEFAULT_WATER_TARIFF_PER_KL: float = 15.0   # ₹ per kilolitre (Mumbai approx.)
DEFAULT_INSTALLATION_COST: float = 250_000.0  # ₹
DEFAULT_TANK_CAPACITY_LITRES: float = 50_000.0
DEFAULT_ANALYSIS_YEARS: int = 10
