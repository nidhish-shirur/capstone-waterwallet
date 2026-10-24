// IS 1172 & Rainwater Harvesting Constants for WaterWallet

export const IS_LPCD = 135.0;
export const POTABLE_LPCD = 70.0;
export const NON_POTABLE_LPCD = 65.0;
export const DEMAND_BUFFER_FACTOR = 1.10;
export const UFW_LOSS_FACTOR = 0.15;

export const RUNOFF_COEFFICIENT = 0.90;
export const ROOF_RUNOFF_COEFFICIENTS = {
  concrete: 0.90,
  metal: 0.90,
  gravel: 0.45,
  tiles: 0.75,
};

export const USABILITY_FACTOR = 0.80;
export const YIELD_FACTOR = RUNOFF_COEFFICIENT * USABILITY_FACTOR;

export const DEFAULT_WATER_TARIFF_PER_KL = 15.0;
export const DEFAULT_INSTALLATION_COST = 250000.0;
export const DEFAULT_TANK_CAPACITY_LITRES = 50000.0;
export const DEFAULT_ANALYSIS_YEARS = 10;

// Regional fallback climatological normals (MMR / Mumbai standard IMD 15-year baseline)
export const MMR_FALLBACK_MONTHLY_RAINFALL = [
  1.2, 1.5, 2.8, 1.8, 35.4, 465.2, 820.5, 560.8, 385.6, 92.4, 9.8, 2.6
];

// Historical percentiles [P10, P50, P90] for Thane/MMR (mm)
export const THANE_RAIN_PERCENTILES = [
  [0.0, 0.0, 4.24],
  [0.0, 0.0, 1.36],
  [0.0, 0.0, 9.2],
  [0.1, 0.6, 3.36],
  [0.4, 2.4, 13.44],
  [183.24, 339.4, 489.9],
  [373.72, 578.4, 853.32],
  [178.68, 301.8, 523.12],
  [166.26, 324.6, 502.58],
  [14.86, 96.6, 194.82],
  [0.0, 1.1, 39.84],
  [0.0, 0.2, 20.98]
];

export const CANDIDATE_CAPACITIES_L = [5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 70000];
export const MARGINAL_RETURN_FLOOR = 1.5;
export const DEFAULT_RECHARGE_CAPACITY_LITRES_PER_DAY = 10000;
