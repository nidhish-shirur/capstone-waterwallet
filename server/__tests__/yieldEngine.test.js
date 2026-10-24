import { describe, it, expect } from "vitest";
import { calculateYield } from "../services/yieldEngine.js";

describe("yieldEngine (Catchment & Runoff Physics)", () => {
  it("calculates yield with concrete surface (0.90 runoff, 0.80 usability)", () => {
    // 1000 sqm roof * 100 mm rain * 0.90 coeff * 0.80 usability = 72,000 Litres
    const yld = calculateYield({
      rain_mm: 100,
      roof_area_sqm: 1000,
      roof_surface_type: "concrete",
    });
    expect(yld).toBe(72000);
  });

  it("calculates yield for different surface materials according to runoff standards", () => {
    const metalYield = calculateYield({
      rain_mm: 100,
      roof_area_sqm: 1000,
      roof_surface_type: "metal",
    });
    expect(metalYield).toBe(72000); // 0.90

    const tilesYield = calculateYield({
      rain_mm: 100,
      roof_area_sqm: 1000,
      roof_surface_type: "tiles",
    });
    expect(tilesYield).toBe(60000); // 0.75 * 0.80 * 100,000 = 60,000

    const gravelYield = calculateYield({
      rain_mm: 100,
      roof_area_sqm: 1000,
      roof_surface_type: "gravel",
    });
    expect(gravelYield).toBe(36000); // 0.45 * 0.80 * 100,000 = 36,000
  });

  it("safely handles 0 or negative rainfall / area without negative yield", () => {
    expect(calculateYield({ rain_mm: 0, roof_area_sqm: 500 })).toBe(0);
    expect(calculateYield({ rain_mm: -50, roof_area_sqm: 500 })).toBe(0);
    expect(calculateYield({ rain_mm: 100, roof_area_sqm: -200 })).toBe(0);
  });
});
