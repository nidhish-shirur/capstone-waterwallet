import { THANE_RAIN_PERCENTILES } from "../constants.js";

const TANKER_COST_PER_KL = 175.0;
const INFLATION_RATE = 0.08;
const AMC_RATE = 0.03;
const ROI_YEARS = 10;
const N_SCENARIOS = 1000;

// Simple LCG pseudo-random number generator for reproducible sampling
function createRng(seed = 42) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function runMonteCarlo({
  rooftop_area_m2,
  monthly_demand_kl,
  capex_inr,
  tank_capacity_litres = 50000,
  rainfall_reduction_percent = 0,
  tanker_rate_per_kl = TANKER_COST_PER_KL,
  annual_tanker_volume_litres = 0,
  water_tariff_per_kl = 15.0,
  inflation_rate = INFLATION_RATE,
  n_scenarios = N_SCENARIOS,
  monthly_rainfall_mm = null,
  usability_factor = 0.80,
  runoff_coeff = 0.90,
  seed = 42,
}) {
  const rng = createRng(Number(seed) || 42);
  const scenarioSource = monthly_rainfall_mm ? "phase2_monthly_rainfall" : "percentile_table";
  const validDemandKl = Math.max(0.1, Number(monthly_demand_kl) || 1.0);
  const validCapex = Math.max(1000, Number(capex_inr) || 100000);
  const validArea = Math.max(1, Number(rooftop_area_m2) || 100);
  const validTankerVol = Math.max(0, Number(annual_tanker_volume_litres) || 0);
  const validTankerRate = Math.max(0, Number(tanker_rate_per_kl) || TANKER_COST_PER_KL);
  const validTariff = Math.max(0, Number(water_tariff_per_kl) || 15.0);

  const breakevenYears = [];

  for (let s = 0; s < n_scenarios; s++) {
    // 1. Sample 12 monthly rainfall values
    const monthlyRainMm = [];
    for (let m = 0; m < 12; m++) {
      if (monthly_rainfall_mm && monthly_rainfall_mm.length === 12) {
        const val = monthly_rainfall_mm[m];
        const low = Math.max(0.0, val * 0.8);
        const high = val * 1.2;
        monthlyRainMm.push(low + rng() * (high - low));
      } else {
        const [p10, , p90] = THANE_RAIN_PERCENTILES[m];
        monthlyRainMm.push(p10 + rng() * (p90 - p10));
      }
    }

    // 2. Physics yield formula
    const monthlyYieldKl = monthlyRainMm.map((rain) => {
      let kl = (validArea * Math.max(rain, 0) * usability_factor * runoff_coeff) / 1000.0;
      kl *= 1 - rainfall_reduction_percent / 100.0;
      return kl;
    });

    // 3. Monthly tank water balance
    let tankLevelLitres = 0.0;
    const monthlyDemandLitres = validDemandKl * 1000.0;
    let annualUsableLitres = 0.0;

    for (const monthlyInflowKl of monthlyYieldKl) {
      const availableLitres = tankLevelLitres + monthlyInflowKl * 1000.0;
      const servedLitres = Math.min(availableLitres, monthlyDemandLitres);
      annualUsableLitres += servedLitres;
      tankLevelLitres = Math.min(
        Math.max(0.0, availableLitres - servedLitres),
        tank_capacity_litres
      );
    }
    const baseAnnualUsableKl = annualUsableLitres / 1000.0;

    // 4. 10-year ROI loop with inter-annual climate variability
    const annualOpex = validCapex * AMC_RATE;
    const annualDemandLitres = validDemandKl * 1000 * 12;
    let cumulative = -validCapex;
    let breakeven = null;

    let currentTankerRate = validTankerRate;
    let currentTariff = validTariff;

    for (let yr = 1; yr <= ROI_YEARS; yr++) {
      // Inter-annual climate variance: ±15% natural cycle around sample trajectory
      const climateFactor = 0.85 + rng() * 0.30;
      const yrUsableKl = Math.min(
        annualDemandLitres / 1000.0,
        baseAnnualUsableKl * climateFactor
      );

      const offsetTankerKl = Math.min(yrUsableKl, validTankerVol / 1000.0);
      const offsetMunicipalKl = Math.min(
        Math.max(0.0, yrUsableKl - offsetTankerKl),
        Math.max(0.0, annualDemandLitres - validTankerVol) / 1000.0
      );

      const grossSavings =
        offsetTankerKl * currentTankerRate + offsetMunicipalKl * currentTariff;
      const net = grossSavings - annualOpex;
      const prevCumulative = cumulative;
      cumulative += net;

      if (breakeven === null && cumulative >= 0) {
        const deficit = -prevCumulative;
        const fraction = net > 0 ? deficit / net : 0.0;
        breakeven = Math.round(((yr - 1) + fraction) * 100) / 100;
      }

      currentTankerRate *= 1 + inflation_rate;
      currentTariff *= 1.05;
    }

    breakevenYears.push(breakeven !== null ? breakeven : ROI_YEARS + 1);
  }

  breakevenYears.sort((a, b) => a - b);
  const validYears = breakevenYears.filter((y) => y <= ROI_YEARS);

  const probByYear = {};
  for (let yr = 1; yr <= ROI_YEARS; yr++) {
    const count = breakevenYears.filter((y) => y <= yr).length;
    probByYear[String(yr)] = Math.round((count / n_scenarios) * 10000) / 10000;
  }

  const getPercentile = (arr, p) => {
    if (arr.length === 0) return null;
    const idx = (p / 100) * (arr.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return Math.round((arr[lower] * (1 - weight) + arr[upper] * weight) * 100) / 100;
  };

  const medianBe = validYears.length > 0 ? getPercentile(validYears, 50) : null;
  const meanBe =
    validYears.length > 0
      ? Math.round(
          (validYears.reduce((a, b) => a + b, 0) / validYears.length) * 100
        ) / 100
      : null;

  return {
    median_breakeven_year: medianBe,
    mean_breakeven_year: meanBe,
    prob_breakeven_by_year: probByYear,
    percentiles: {
      p10: getPercentile(breakevenYears, 10),
      p50: getPercentile(breakevenYears, 50),
      p90: getPercentile(breakevenYears, 90),
    },
    n_scenarios,
    never_break_even_pct:
      Math.round(((n_scenarios - validYears.length) / n_scenarios) * 1000) / 10,
    scenarios_used: scenarioSource,
    is_site_specific: monthly_rainfall_mm !== null,
  };
}
