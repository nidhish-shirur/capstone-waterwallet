// ---------------------------------------------------------------------------
// Number formatting helpers for WaterWallet UI
// ---------------------------------------------------------------------------

/**
 * Format a litre value into a human-readable string.
 *   12345678 → "12,345.68 kL"
 *   450      → "450 L"
 */
export function formatLitres(litres) {
  if (litres >= 1_000) {
    return `${(litres / 1_000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} kL`;
  }
  return `${litres.toLocaleString("en-IN", { maximumFractionDigits: 0 })} L`;
}

/**
 * Format a currency value in Indian Rupees.
 *   250000 → "₹2,50,000"
 */
export function formatRupees(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a rainfall depth.
 *   1234.5 → "1,234.5 mm"
 */
export function formatRainfall(mm) {
  return `${mm.toLocaleString("en-IN", { maximumFractionDigits: 1 })} mm`;
}

/**
 * Format a roof area.
 *   500 → "500 m²"
 */
export function formatArea(sqm) {
  return `${sqm.toLocaleString("en-IN", { maximumFractionDigits: 0 })} m²`;
}

/**
 * Abbreviate large numbers for chart axes.
 *   1500000 → "15L"   (Indian lakh)
 *   250000  → "2.5L"
 *   5000    → "5K"
 */
export function formatChartValue(value) {
  if (value >= 1_00_000) return `${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000)    return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
