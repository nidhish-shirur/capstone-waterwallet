import { describe, it, expect } from "vitest";
import { sizeTanks, simulateTankYear } from "../services/tankSizer.js";

describe("tankSizer (Daily Historical Simulation & Knee-Point Optimization)", () => {
  it("simulates a single year with water balance, useful water, and overflow", () => {
    // 365 daily rainfall entries (300 dry days, 65 rainy days with 30mm)
    const dailyRain = new Array(365).fill(0);
    for (let i = 150; i < 215; i++) {
      dailyRain[i] = 30.0;
    }

    const yearResult = simulateTankYear({
      rainfall_mm: dailyRain,
      tank_capacity_litres: 10000,
      daily_demand_litres: 5000,
      usable_roof_area_sqm: 400,
      runoff_coefficient: 0.90,
      first_flush_fraction: 0.05,
      year: 2024,
      recharge_enabled: true,
      recharge_capacity_litres_per_day: 10000,
    });

    expect(yearResult.year).toBe(2024);
    expect(yearResult.useful_water_litres).toBeGreaterThan(0);
    expect(yearResult.total_inflow_litres).toBeGreaterThan(0);
    expect(yearResult.reliability_percent).toBeGreaterThan(0);
    expect(yearResult.reliability_percent).toBeLessThanOrEqual(100);
  });

  it("evaluates candidates and identifies selected capacity with selection reason", () => {
    const rainfallByYear = {
      2023: new Array(365).fill(2.0),
      2024: new Array(366).fill(3.0),
    };

    const result = sizeTanks({
      rainfall_by_year: rainfallByYear,
      candidate_capacities_litres: [5000, 10000, 20000],
      daily_demand_litres: 2000,
      usable_roof_area_sqm: 300,
      reliability_target_percent: 30,
    });

    expect(result.candidates.length).toBe(3);
    expect(result.selected_candidate).toBeDefined();
    expect(result.selection_reason).toBeDefined();
    expect(result.selected_candidate.capacity_litres).toBeGreaterThan(0);
  });
});
