import { describe, it, expect } from "vitest";
import { tier1SafetyGate, COASTAL_THRESHOLD_KM, BOREWELL_MIN_DEPTH_M } from "../services/tier1Safety.js";

describe("tier1Safety (CGWB / BMC Artificial Groundwater Recharge Rules)", () => {
  it("forces Storage-Only when site is within coastal intrusion zone (<= 2.5 km)", () => {
    const result = tier1SafetyGate({
      coastal_km: 1.8,
      soil_perm: 3,
      borewell: 1,
      borewell_depth: 60,
    });
    expect(result).not.toBeNull();
    expect(result.config).toBe("Storage-Only");
    expect(result.safety_triggered).toBe(true);
    expect(result.reason).toContain("seawater intrusion");
  });

  it("forces Storage-Only when no existing borewell exists (borewell = 0)", () => {
    const result = tier1SafetyGate({
      coastal_km: 8.0,
      soil_perm: 3,
      borewell: 0,
      borewell_depth: 0,
    });
    expect(result).not.toBeNull();
    expect(result.config).toBe("Storage-Only");
    expect(result.reason).toContain("No existing borewell on site");
  });

  it("forces Storage-Only when soil permeability is impermeable clay (class 1)", () => {
    const result = tier1SafetyGate({
      coastal_km: 10.0,
      soil_perm: 1,
      borewell: 1,
      borewell_depth: 50,
    });
    expect(result).not.toBeNull();
    expect(result.config).toBe("Storage-Only");
    expect(result.reason).toContain("impermeable clay");
  });

  it("forces Storage-Only when borewell depth is too shallow (< 30 m)", () => {
    const result = tier1SafetyGate({
      coastal_km: 10.0,
      soil_perm: 3,
      borewell: 1,
      borewell_depth: 22,
    });
    expect(result).not.toBeNull();
    expect(result.config).toBe("Storage-Only");
    expect(result.reason).toContain("below the minimum 30 m");
  });

  it("passes Tier 1 safety check when all physical criteria are satisfied", () => {
    const result = tier1SafetyGate({
      coastal_km: 12.0,
      soil_perm: 3,
      borewell: 1,
      borewell_depth: 45,
    });
    expect(result).toBeNull();
  });
});
