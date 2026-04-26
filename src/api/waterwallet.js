import axios from "axios";

// ---------------------------------------------------------------------------
// Base client — all requests go to the FastAPI backend
// ---------------------------------------------------------------------------
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// ---------------------------------------------------------------------------
// Society — demand calculation (IS 1172)
// ---------------------------------------------------------------------------

/**
 * @param {{ num_flats: number, occupants_per_flat?: number, lpcd_override?: number }} payload
 * @returns {Promise<{ total_occupants: number, daily_demand_lpd: number, daily_demand_with_buffer_lpd: number }>}
 */
export const fetchSocietyBaseline = (payload) =>
  api.post("/api/society/baseline", payload).then((r) => r.data);

// ---------------------------------------------------------------------------
// Geospatial — rainfall fetch + yield calculation
// ---------------------------------------------------------------------------

/**
 * @param {{ latitude: number, longitude: number, roof_area_sqm: number }} payload
 * @returns {Promise<{ annual_rainfall_mm, monthly_rainfall_mm, annual_yield_litres, monthly_yield_litres }>}
 */
export const fetchCatchmentData = (payload) =>
  api.post("/api/catchment/calculate", payload).then((r) => r.data);

// ---------------------------------------------------------------------------
// ROI — multi-year simulation
// ---------------------------------------------------------------------------

/**
 * @param {{ daily_demand_lpd, annual_yield_litres, tank_capacity_litres?, water_tariff_per_kl?, installation_cost?, years? }} payload
 * @returns {Promise<{ payback_years, ten_year_savings, yearly_breakdown }>}
 */
export const simulateROI = (payload) =>
  api.post("/api/roi/simulate", payload).then((r) => r.data);

// ---------------------------------------------------------------------------
// Report — PDF generation
// ---------------------------------------------------------------------------

/**
 * Fetches the generated PDF as a Blob and triggers a browser download.
 * @param {{ society_data, catchment_data, roi_data, society_name? }} payload
 */
export const downloadReport = async (payload) => {
  const response = await api.post("/api/report/generate", payload, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "waterwallet-report.pdf");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default api;
