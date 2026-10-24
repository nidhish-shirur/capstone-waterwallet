import { Router } from "express";
import { calculateYield } from "../services/yieldEngine.js";
import {
  fetchMonthlyRainfall,
  fetchMonthlyRainfallHistory,
  forecastMonthlyRainfall,
  RAINFALL_START_YEAR,
  RAINFALL_END_YEAR,
} from "../services/rainfallApi.js";

const router = Router();

// POST /api/catchment/calculate
router.post("/calculate", async (req, res) => {
  try {
    const { latitude, longitude, roof_area_sqm, roof_surface_type = "concrete" } = req.body;
    const { monthlyRainfall, source } = await fetchMonthlyRainfall(latitude, longitude);
    const annualRainfall = monthlyRainfall.reduce((a, b) => a + b, 0);

    const monthlyYield = monthlyRainfall.map((r) =>
      calculateYield({
        rain_mm: r,
        roof_area_sqm: Number(roof_area_sqm),
        roof_surface_type,
      })
    );
    const annualYield = monthlyYield.reduce((a, b) => a + b, 0);

    res.json({
      annual_rainfall_mm: Math.round(annualRainfall * 100) / 100,
      monthly_rainfall_mm: monthlyRainfall.map((r) => Math.round(r * 100) / 100),
      annual_yield_litres: Math.round(annualYield * 100) / 100,
      monthly_yield_litres: monthlyYield.map((y) => Math.round(y * 100) / 100),
      historical_start_year: RAINFALL_START_YEAR,
      historical_end_year: RAINFALL_END_YEAR,
      source,
      fallback_used: source !== "open_meteo_archive",
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/catchment/forecast
router.post("/forecast", async (req, res) => {
  try {
    const { latitude, longitude, roof_area_sqm, roof_surface_type = "concrete", periods = 12 } = req.body;
    const { history, source: history_source } = await fetchMonthlyRainfallHistory(latitude, longitude);
    const forecast = forecastMonthlyRainfall(history, periods);

    const monthlyRainfall = forecast.monthly_rainfall_mm;
    const monthlyYield = monthlyRainfall.map((r) =>
      calculateYield({
        rain_mm: r,
        roof_area_sqm: Number(roof_area_sqm),
        roof_surface_type,
      })
    );

    res.json({
      annual_rainfall_mm: Math.round(monthlyRainfall.reduce((a, b) => a + b, 0) * 100) / 100,
      monthly_rainfall_mm: monthlyRainfall,
      annual_yield_litres: Math.round(monthlyYield.reduce((a, b) => a + b, 0) * 100) / 100,
      monthly_yield_litres: monthlyYield.map((y) => Math.round(y * 100) / 100),
      source: "auto_sarima",
      history_source,
      fallback_used: history_source !== "open_meteo_archive",
      model_order: forecast.model_order,
      training_months: forecast.training_months,
      confidence_intervals: forecast.confidence_intervals,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

export default router;
