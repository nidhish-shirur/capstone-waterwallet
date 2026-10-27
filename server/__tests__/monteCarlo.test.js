import { describe, it, expect } from "vitest";
import { runMonteCarlo } from "../services/monteCarlo.js";

describe("monteCarlo (Probabilistic Break-Even Distribution)", () => {
  it("runs 1000 scenarios and computes valid percentiles and probabilities", () => {
    const result = runMonteCarlo({
      rooftop_area_m2: 800,
      monthly_demand_kl: 300,
      capex_inr: 250000,
      tank_capacity_litres: 20000,
      n_scenarios: 500,
      tanker_rate_per_kl: 175,
      annual_tanker_volume_litres: 1000000,
    });

    expect(result.n_scenarios).toBe(500);
    expect(result.percentiles).toHaveProperty("p10");
    expect(result.percentiles).toHaveProperty("p50");
    expect(result.percentiles).toHaveProperty("p90");
    expect(typeof result.never_break_even_pct).toBe("number");
    expect(result.prob_breakeven_by_year).toHaveProperty("1");
    expect(result.prob_breakeven_by_year).toHaveProperty("10");

    // Cumulative probabilities must be non-decreasing
    for (let yr = 2; yr <= 10; yr++) {
      expect(result.prob_breakeven_by_year[String(yr)]).toBeGreaterThanOrEqual(
        result.prob_breakeven_by_year[String(yr - 1)]
      );
    }
  });

  it("uses the local ₹175/KL midpoint when no tanker rate is supplied", () => {
    const input = {
      rooftop_area_m2: 800,
      monthly_demand_kl: 300,
      capex_inr: 250000,
      tank_capacity_litres: 20000,
      n_scenarios: 100,
      annual_tanker_volume_litres: 1000000,
    };

    expect(runMonteCarlo(input)).toEqual(
      runMonteCarlo({ ...input, tanker_rate_per_kl: 175 })
    );
  });

  it("handles site-specific monthly rainfall input correctly", () => {
    const customRain = [0, 0, 0, 15, 120, 550, 750, 600, 320, 80, 10, 0];
    const result = runMonteCarlo({
      rooftop_area_m2: 600,
      monthly_demand_kl: 250,
      capex_inr: 200000,
      monthly_rainfall_mm: customRain,
      n_scenarios: 200,
    });

    expect(result.is_site_specific).toBe(true);
    expect(result.scenarios_used).toBe("phase2_monthly_rainfall");
  });

  it("safely handles edge cases like 0 demand or small capex", () => {
    const result = runMonteCarlo({
      rooftop_area_m2: 500,
      monthly_demand_kl: 0,
      capex_inr: 0,
      n_scenarios: 100,
    });

    expect(result).toBeDefined();
    expect(Number.isFinite(result.never_break_even_pct)).toBe(true);
  });
});
