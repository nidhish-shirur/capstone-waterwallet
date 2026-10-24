import { describe, it, expect } from "vitest";
import { calculateDemand } from "../services/demandEngine.js";

describe("demandEngine (IS 1172 Residential Benchmark)", () => {
  it("calculates baseline demand with IS 1172 standard (135 LPCD, 15% UFW, 10% buffer)", () => {
    const result = calculateDemand({
      num_flats: 48,
      occupants_per_flat: 3.5,
      include_losses: true,
    });

    expect(result.total_occupants).toBe(168);
    // Base demand: 168 * 135 = 22,680 L/day
    expect(result.base_demand_lpd).toBe(22680);
    // After 15% UFW: 22680 * 1.15 = 26,082 L/day
    // With 10% peak buffer: 26,082 * 1.10 = 28,690.2 -> 28,690 L/day
    expect(result.daily_demand_lpd).toBe(28690);

    // Potable ratio = 70 / 135 -> ~14,876 L/day
    // Non-potable ratio = 65 / 135 -> ~13,814 L/day
    expect(result.potable_demand_lpd + result.non_potable_demand_lpd).toBe(28690);
    expect(result.potable_demand_lpd).toBe(14876);
    expect(result.non_potable_demand_lpd).toBe(13814);
  });

  it("calculates demand without UFW losses when include_losses is false", () => {
    const result = calculateDemand({
      num_flats: 50,
      occupants_per_flat: 4,
      include_losses: false,
    });

    expect(result.total_occupants).toBe(200);
    // Base: 200 * 135 = 27,000
    expect(result.base_demand_lpd).toBe(27000);
    // Without UFW: 27000 * 1.10 buffer = 29,700
    expect(result.daily_demand_lpd).toBe(29700);
  });

  it("handles edge cases (zero/negative/NaN) by applying safe floor minimums", () => {
    const zeroResult = calculateDemand({ num_flats: 0, occupants_per_flat: -2 });
    expect(zeroResult.total_occupants).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(zeroResult.daily_demand_lpd)).toBe(true);

    const nanResult = calculateDemand({ num_flats: "invalid", occupants_per_flat: null });
    expect(nanResult.total_occupants).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(nanResult.daily_demand_lpd)).toBe(true);
  });
});
