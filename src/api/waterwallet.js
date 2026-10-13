import axios from "axios";

// ---------------------------------------------------------------------------
// Base client — all requests go to the FastAPI backend
// ---------------------------------------------------------------------------
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      // Could dispatch an event or redirect here, but we'll let the context handle it
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const login = (email, password) =>
  api.post("/api/auth/login", { email, password }).then((r) => r.data);

export const register = (email, password) =>
  api.post("/api/auth/register", { email, password }).then((r) => r.data);

export const fetchCurrentUser = () =>
  api.get("/api/auth/me").then((r) => r.data);

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

export const fetchRainfallForecast = (payload) =>
  api.post("/api/catchment/forecast", payload).then((r) => r.data);

/**
 * @param {{ rooftop_area_m2: number, monthly_rainfall_mm: Array }} payload
 * @returns {Promise<{ monthly_yield_kl: Array, annual_yield_kl: number, source: string }>}
 */
export const getMLYield = (payload) =>
  api.post("/api/ml/yield", payload).then((r) => r.data);

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
 * @param {{ rooftop_area_m2: number, monthly_demand_kl: number, capex_inr: number, monthly_rainfall_mm?: number[], tank_capacity_litres?: number, rainfall_reduction_percent?: number, tanker_rate_per_kl?: number, annual_tanker_volume_litres?: number, water_tariff_per_kl?: number, inflation_rate?: number, n_scenarios?: number }} payload
 * @returns {Promise<{ median_breakeven_year: number, prob_breakeven_by_year: object, percentiles: object, n_scenarios: number, never_break_even_pct: number, scenarios_used: string, is_site_specific: boolean }>}
 */
export const runMonteCarlo = (payload) =>
  api.post("/api/roi/monte-carlo", payload).then((r) => r.data);

/**
 * Runs the daily historical tank water-balance simulator.
 * Overflow is environmental/recharge or design-loss accounting, never savings.
 */
export const sizeTank = (payload) =>
  api.post("/api/roi/tank-sizer", payload).then((r) => r.data);

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

/**
 * Generates a plain-language advisory from validated dashboard metrics.
 * @param {object} payload
 * @returns {Promise<{summary: string, recommendations: string[], risks: string[], assumptions: string[]}>}
 */
export const getWaterAdvisory = (payload) =>
  api.post("/api/advisory/water", payload).then((r) => r.data);

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
 * Gets a persisted society and its historical billing entries from PostgreSQL.
 * This is a temporary read-only path while the normal CRUD routes use the
 * in-memory store.
 * @param {number} id
 * @returns {Promise<object>}
 */
export const getSocietyFromDatabase = (id) =>
  api.get(`/api/societies/${id}/database`).then((r) => r.data);

/**
 * Gets only historical billing entries persisted for a society.
 * @param {number} id
 * @returns {Promise<Array>}
 */
export const fetchHistoricalBilling = (id) =>
  api.get(`/api/societies/${id}/billing`).then((r) => r.data);

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

export const getLatestSocietyAnalysis = (id) =>
  api.get(`/api/societies/${id}/analyses/latest`).then((r) => r.data);

/**
 * Gets all societies for the current user.
 * @returns {Promise<Array>}
 */
export const fetchSocieties = () =>
  api.get("/api/societies/").then((r) => r.data);

/**
 * Gets societies persisted in PostgreSQL for the temporary Phase 1 loader.
 * @returns {Promise<Array>}
 */
export const fetchDatabaseSocieties = () =>
  api.get("/api/societies/database").then((r) => r.data);

export default api;
