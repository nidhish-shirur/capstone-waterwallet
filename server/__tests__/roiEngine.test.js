import { describe, it, expect } from "vitest";
import { simulateROI } from "../services/roiEngine.js";

describe("roiEngine (10-Year Financial Simulation)", () => {
  it("calculates positive payback period for realistic housing society scenario", () => {
    const result = simulateROI({
      daily_demand_lpd: 15000,
      annual_yield_litres: 1200000,
      installation_cost: 200000,
      years: 10,
      tariff_escalation_rate: 0.08,
      annual_tanker_spend: 180000,
      annual_tanker_volume_litres: 1200000,
      annual_municipal_spend: 40000,
      water_tariff_per_kl: 15.0,
    });

    expect(result.yearly_breakdown.length).toBe(10);
    expect(result.payback_years).toBeGreaterThan(0);
    expect(result.payback_years).toBeLessThan(10);
    expect(result.total_period_savings).toBeGreaterThan(0);

    // Verify AMC is accounted for: each year's net_savings should reflect gross savings minus 3% of capex
    const year1 = result.yearly_breakdown[0];
    const amc = 200000 * 0.03; // 6,000
    expect(year1.savings).toBe(180000 - amc);
    expect(year1.cumulative_savings).toBe(year1.savings);
  });

  it("handles zero municipal water tariff without throwing error", () => {
    const result = simulateROI({
      daily_demand_lpd: 10000,
      annual_yield_litres: 800000,
      water_tariff_per_kl: 0,
      installation_cost: 150000,
      years: 10,
      annual_tanker_spend: 150000,
      annual_tanker_volume_litres: 800000,
      annual_municipal_spend: 0,
    });

    expect(result.yearly_breakdown.length).toBe(10);
    expect(Number.isFinite(result.total_period_savings)).toBe(true);
  });

  it("handles scenario where payback is not achieved within horizon", () => {
    const result = simulateROI({
      daily_demand_lpd: 1000,
      annual_yield_litres: 10000,
      installation_cost: 500000,
      years: 10,
      annual_tanker_spend: 5000,
      annual_tanker_volume_litres: 10000,
      annual_municipal_spend: 1000,
      water_tariff_per_kl: 10.0,
    });

    expect(result.payback_years).toBeNull();
  });
});
