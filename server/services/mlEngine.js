export const CLF_FEATURES = [
  "rooftop_area",
  "borewell",
  "borewell_depth",
  "soil_perm",
  "coastal_km",
  "annual_rain_mm",
  "peak_day_mm",
];

export function predictConfig({
  rooftop_area,
  borewell,
  borewell_depth,
  soil_perm,
  coastal_km,
  annual_rain_mm,
  peak_day_mm,
}) {
  const area = Number(rooftop_area) || 0;
  const bw = Number(borewell) === 1 ? 1 : 0;
  const bwDepth = bw === 1 ? (Number(borewell_depth) || 0) : 0;
  const sPerm = Math.max(1, Math.min(5, Math.round(Number(soil_perm) || 3)));
  const cKm = Math.max(0, Number(coastal_km) || 10);
  const aRain = Math.max(0, Number(annual_rain_mm) || 2424);
  const pDay = Math.max(0, Number(peak_day_mm) || 110);

  // Model rule calibrated from MMR guidelines:
  // Large catchment (rooftop_area >= 500 sqm) provides dual storage & recharge capacity
  const isLargeRoof = area >= 500.0;
  const config = isLargeRoof ? "Hybrid" : "Borewell-Recharge";

  // Heuristic score derived from distance to the fixed decision boundary
  const logit = (area - 500) / 250 + (bw ? 0.35 : -0.35) + (bwDepth - 50) / 50 + (sPerm - 3) / 3;
  const sigmoid = 1 / (1 + Math.exp(-Math.abs(logit)));
  const confidence = Math.round((0.80 + 0.18 * sigmoid) * 100) / 100;

  // Hand-coded feature contribution scores relative to fixed MMR reference baselines
  // Base expectation: 500 m² roof, 60 m borewell depth, class 3 soil, 8 km coast, 2424 mm rain
  const scoreArea = Math.round(0.45 * Math.tanh((area - 500) / 300) * 1000) / 1000;
  const scoreBorewell = bw === 1 ? 0.28 : -0.28;
  const scoreDepth = bw === 1 ? Math.round(0.24 * Math.tanh((bwDepth - 60) / 35) * 1000) / 1000 : 0;
  const scoreSoil = Math.round(0.18 * ((sPerm - 3) / 2) * 1000) / 1000;
  const scoreCoast = Math.round(0.14 * Math.tanh((cKm - 8) / 5) * 1000) / 1000;
  const scoreRain = Math.round(0.08 * Math.tanh((aRain - 2424) / 600) * 1000) / 1000;
  const scorePeak = Math.round(0.04 * Math.tanh((pDay - 110) / 40) * 1000) / 1000;

  const heuristicContributions = [
    { feature: "rooftop_area", value: area, contribution: scoreArea },
    { feature: "borewell", value: bw, contribution: scoreBorewell },
    { feature: "borewell_depth", value: bwDepth, contribution: scoreDepth },
    { feature: "soil_perm", value: sPerm, contribution: scoreSoil },
    { feature: "coastal_km", value: cKm, contribution: scoreCoast },
    { feature: "annual_rain_mm", value: aRain, contribution: scoreRain },
    { feature: "peak_day_mm", value: pDay, contribution: scorePeak },
  ];

  // Dynamically assemble plain-language summary identifying key positive driver features
  const positiveDrivers = [];
  if (scoreArea > 0.05) positiveDrivers.push(`rooftop area (${Math.round(area)} m²)`);
  if (scoreDepth > 0.05) positiveDrivers.push(`borewell depth (${Math.round(bwDepth)} m)`);
  if (scoreSoil > 0.05) positiveDrivers.push(`permeable soil (class ${sPerm})`);
  if (scoreCoast > 0.05) positiveDrivers.push(`coastal distance (${cKm.toFixed(1)} km)`);

  const driverText = positiveDrivers.length > 0
    ? ` because ${positiveDrivers.join(", ")} support efficient ${config.toLowerCase()} operation`
    : "";

  const plain_language = `${config} recommended with a heuristic score of ${(confidence * 100).toFixed(0)}%${driverText}.`;

  return {
    config,
    confidence,
    source: "express_heuristic_classifier",
    safety_triggered: false,
    safety_reason: null,
    shap_values: [],
    heuristic_feature_contributions: heuristicContributions,
    plain_language,
    shap_available: false,
    explanation_warning:
      "The Express service uses hand-coded heuristic scores and feature contributions, not a trained Random Forest or SHAP.",
  };
}

export function predictYield({ rooftop_area, monthly_rainfall_mm }) {
  const area = Math.max(0, Number(rooftop_area) || 0);
  const rain = (monthly_rainfall_mm || []).map((r) => Math.max(0, Number(r) || 0));
  const annualRain = rain.reduce((a, b) => a + b, 0);

  // Naive physical formula (0.90 runoff * 0.80 usability)
  const physics_monthly_yield_kl = rain.map((r) =>
    Math.round(((area * r * 0.80 * 0.90) / 1000.0) * 1000) / 1000
  );
  const physics_annual_yield_kl =
    Math.round(physics_monthly_yield_kl.reduce((a, b) => a + b, 0) * 1000) / 1000;

  // Hand-coded monthly runoff heuristic with initial abstraction and
  // antecedent-moisture adjustments; this is not a trained regressor.
  const monthly_yield_kl = rain.map((r, m) => {
    if (r <= 0 || area <= 0) return 0;
    const month = m + 1;
    const peakDayProxy = r / 30;
    const lag1 = m > 0 ? rain[m - 1] : 0;
    const lag2 = m > 1 ? rain[m - 2] : 0;
    const lag3 = m > 2 ? rain[m - 3] : 0;
    const sinMonth = Math.sin((2 * Math.PI * month) / 12);
    const cosMonth = Math.cos((2 * Math.PI * month) / 12);

    // Initial abstraction factor: dry roofs (June or low lag rain) absorb 5-10 mm
    // Saturated roofs during peak monsoon (July/August, high lag1) reach peak runoff efficiency
    let effectiveRunoffCoeff = 0.90;
    if (month === 6 || (lag1 < 10 && r > 20)) {
      // Early monsoon wetting / pore absorption
      effectiveRunoffCoeff = 0.86;
    } else if (month === 7 || month === 8) {
      // Saturated peak monsoon
      effectiveRunoffCoeff = 0.91;
    }

    // Suppress unused feature warnings while recording feature presence
    void peakDayProxy; void lag2; void lag3; void sinMonth; void cosMonth; void annualRain;

    const yieldKl = (area * r * 0.80 * effectiveRunoffCoeff) / 1000.0;
    return Math.round(yieldKl * 1000) / 1000;
  });

  const annual_yield_kl =
    Math.round(monthly_yield_kl.reduce((a, b) => a + b, 0) * 1000) / 1000;

  const ml_deviation_percent =
    physics_annual_yield_kl > 0
      ? Math.round(((annual_yield_kl - physics_annual_yield_kl) / physics_annual_yield_kl) * 1000) / 10
      : 0.0;

  return {
    monthly_yield_kl,
    annual_yield_kl,
    source: "express_heuristic_yield",
    physics_annual_yield_kl,
    ml_deviation_percent,
  };
}
