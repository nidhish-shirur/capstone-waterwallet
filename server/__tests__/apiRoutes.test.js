import { describe, it, expect } from "vitest";
import { calculateDemand } from "../services/demandEngine.js";
import { predictConfig, predictYield } from "../services/mlEngine.js";
import { tier1SafetyGate } from "../services/tier1Safety.js";
import { forecastMonthlyRainfall } from "../services/rainfallApi.js";

describe("apiRoutes integration & logic checks", () => {
  it("validates baseline demand payload calculations", () => {
    const baseline = calculateDemand({
      num_flats: 48,
      occupants_per_flat: 3.5,
      include_losses: true,
    });
    expect(baseline.daily_demand_lpd).toBe(28690);
    expect(baseline.potable_demand_lpd).toBe(14876);
    expect(baseline.non_potable_demand_lpd).toBe(13814);
  });

  it("evaluates Tier 2 ML configuration and dynamic SHAP contributions", () => {
    const mlRec1 = predictConfig({
      rooftop_area: 800,
      borewell: 1,
      borewell_depth: 45,
      soil_perm: 3,
      coastal_km: 8.0,
      annual_rain_mm: 2400,
      peak_day_mm: 110,
    });

    expect(mlRec1.config).toBe("Hybrid");
    expect(mlRec1.confidence).toBeGreaterThan(0.85);
    expect(mlRec1.shap_values.length).toBe(7);
    expect(mlRec1.plain_language).toContain("Hybrid recommended");

    // Dynamic SHAP check: varying area and depth must change the computed Shapley values
    const mlRec2 = predictConfig({
      rooftop_area: 350,
      borewell: 1,
      borewell_depth: 95,
      soil_perm: 4,
      coastal_km: 12.0,
      annual_rain_mm: 2600,
      peak_day_mm: 130,
    });

    const shapArea1 = mlRec1.shap_values.find(s => s.feature === "rooftop_area").shap;
    const shapArea2 = mlRec2.shap_values.find(s => s.feature === "rooftop_area").shap;
    expect(shapArea1).toBeGreaterThan(shapArea2);

    const shapDepth1 = mlRec1.shap_values.find(s => s.feature === "borewell_depth").shap;
    const shapDepth2 = mlRec2.shap_values.find(s => s.feature === "borewell_depth").shap;
    expect(shapDepth2).toBeGreaterThan(shapDepth1);
  });

  it("evaluates Tier 1 safety trigger precedence over ML", () => {
    const safety = tier1SafetyGate({
      coastal_km: 1.5,
      soil_perm: 3,
      borewell: 1,
      borewell_depth: 45,
    });

    expect(safety).not.toBeNull();
    expect(safety.config).toBe("Storage-Only");
    expect(safety.safety_triggered).toBe(true);
  });

  it("evaluates ML yield regressor output format with physical depression storage", () => {
    const rain = [1, 1, 2, 18, 110, 510, 710, 580, 300, 95, 18, 2];
    const yieldRes = predictYield({
      rooftop_area: 500,
      monthly_rainfall_mm: rain,
    });

    expect(yieldRes.monthly_yield_kl.length).toBe(12);
    expect(yieldRes.annual_yield_kl).toBeGreaterThan(0);
    expect(yieldRes.physics_annual_yield_kl).toBeGreaterThan(0);
    // Yield accounts for initial abstraction wetting and saturation dynamics
    expect(typeof yieldRes.ml_deviation_percent).toBe("number");
  });

  it("verifies forecastMonthlyRainfall produces structured model_order and empirical variance bounds", () => {
    // 15 years of seasonal rainfall
    const mockHistory = [];
    for (let yr = 0; yr < 15; yr++) {
      for (const m of [0, 0, 1, 15, 90, 480, 720, 550, 310, 80, 10, 1]) {
        mockHistory.push(m * (0.9 + (yr % 5) * 0.05));
      }
    }
    const forecast = forecastMonthlyRainfall(mockHistory, 12);

    expect(forecast.monthly_rainfall_mm.length).toBe(12);
    expect(forecast.model_order).toHaveProperty("order");
    expect(forecast.model_order).toHaveProperty("seasonal_order");
    expect(Array.isArray(forecast.model_order.order)).toBe(true);
    expect(forecast.confidence_intervals.length).toBe(12);
    expect(forecast.confidence_intervals[6].upper).toBeGreaterThan(forecast.monthly_rainfall_mm[6]);
    expect(forecast.confidence_intervals[6].lower).toBeLessThan(forecast.monthly_rainfall_mm[6]);
  });
});
