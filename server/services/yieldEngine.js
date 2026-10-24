import { ROOF_RUNOFF_COEFFICIENTS, USABILITY_FACTOR } from "../constants.js";

export function calculateYield({ rain_mm, roof_area_sqm, roof_surface_type = "concrete" }) {
  const rain = Math.max(0, Number(rain_mm) || 0);
  const area = Math.max(0, Number(roof_area_sqm) || 0);
  const coeff = ROOF_RUNOFF_COEFFICIENTS[(roof_surface_type || "concrete").toLowerCase()] ?? 0.90;
  const yield_litres = rain * area * coeff * USABILITY_FACTOR;
  return Math.round(yield_litres * 100) / 100;
}
