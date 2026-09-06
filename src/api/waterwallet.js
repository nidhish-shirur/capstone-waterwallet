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
  api.post("/api/societies/baseline", payload).then((r) => r.data);

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
// ROI — multi-year simulation & ML Monte Carlo
// ---------------------------------------------------------------------------

/**
 * @param {{ daily_demand_lpd, annual_yield_litres, tank_capacity_litres?, water_tariff_per_kl?, installation_cost?, years? }} payload
 * @returns {Promise<{ payback_years, ten_year_savings, yearly_breakdown }>}
 */
export const simulateROI = (payload) =>
  api.post("/api/roi/simulate", payload).then((r) => r.data);

/**
 * Runs 1,000-scenario Monte Carlo ROI simulation.
 * @param {{ rooftop_area_m2: number, monthly_demand_kl: number, capex_inr: number, tanker_rate_per_kl?: number, inflation_rate?: number, n_scenarios?: number }} payload
 * @returns {Promise<{ median_breakeven_year: number, prob_breakeven_by_year: object, percentiles: object, n_scenarios: number, never_break_even_pct: number, scenarios_used: string }>}
 */
export const runMonteCarlo = (payload) =>
  api.post("/api/roi/monte-carlo", payload).then((r) => r.data);

// ---------------------------------------------------------------------------
// ML — Dual-tier recommendation & SHAP explanations
// ---------------------------------------------------------------------------

/**
 * Calls Tier 1 Safety Gate & Tier 2 RF Classifier + SHAP.
 * @param {{ rooftop_area: number, borewell: number, borewell_depth: number, soil_perm: number, coastal_km: number, annual_rain_mm: number, peak_day_mm: number }} payload
 * @returns {Promise<{ config: string, confidence: number, source: string, safety_triggered: boolean, safety_reason?: string, shap_values: Array, plain_language: string }>}
 */
export const getMLRecommendation = (payload) =>
  api.post("/api/ml/recommend", payload).then((r) => r.data);

// Database CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Creates a new society in the database.
 * @param {{ name: string, pincode: string, num_flats: number, occupants?: number, roof_surface_type?: string }} payload
 * @returns {Promise<object>}
 */
export const createSociety = (payload) =>
  api.post("/api/societies/", payload).then((r) => r.data);

/**
 * Gets a society and its billing entries from the database.
 * @param {number} id
 * @returns {Promise<object>}
 */
export const getSociety = (id) =>
  api.get(`/api/societies/${id}`).then((r) => r.data);

/**
 * Updates an existing society.
 * @param {number} id
 * @param {object} payload
 * @returns {Promise<object>}
 */
export const updateSociety = (id, payload) =>
  api.put(`/api/societies/${id}`, payload).then((r) => r.data);

/**
 * Saves or updates billing entries for a society.
 * @param {number} id
 * @param {Array} payload
 * @returns {Promise<Array>}
 */
export const saveBillingEntries = (id, payload) =>
  api.post(`/api/societies/${id}/billing`, payload).then((r) => r.data);

/**
 * Saves a computed analysis snapshot for a society.
 * @param {number} id
 * @param {object} payload
 * @returns {Promise<object>}
 */
export const saveSocietyAnalysis = (id, payload) =>
  api.post(`/api/societies/${id}/analyses`, payload).then((r) => r.data);

export default api;
