import { Router } from "express";
import { simulateROI } from "../services/roiEngine.js";
import { runMonteCarlo } from "../services/monteCarlo.js";
import { sizeTanks } from "../services/tankSizer.js";
import { fetchDailyRainfall } from "../services/rainfallApi.js";
import { ROOF_RUNOFF_COEFFICIENTS, USABILITY_FACTOR } from "../constants.js";

const router = Router();

// POST /api/roi/simulate
router.post("/simulate", (req, res) => {
  try {
    const result = simulateROI(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ detail: err.message });
  }
});

// POST /api/roi/monte-carlo
router.post("/monte-carlo", (req, res) => {
  try {
    const runoff_coeff =
      ROOF_RUNOFF_COEFFICIENTS[
        (req.body.roof_surface_type || "concrete").toLowerCase()
      ] ?? 0.90;

    const result = runMonteCarlo({
      ...req.body,
      runoff_coeff,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ detail: err.message });
  }
});

// POST /api/roi/tank-sizer
router.post("/tank-sizer", async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      candidate_capacities_litres,
      daily_demand_litres,
      gross_roof_area_sqm,
      roof_surface_type = "concrete",
      first_flush_fraction = 0.05,
      tanker_rate_per_litre = 0.175,
      tank_cost_per_litre = 4.0,
      fixed_system_cost = 7200.0,
      reliability_target_percent = 40.0,
      recharge_enabled = true,
      recharge_capacity_litres_per_day = 10000.0,
    } = req.body;

    const rainfall_by_year = await fetchDailyRainfall(latitude, longitude);
    const runoff_coefficient =
      ROOF_RUNOFF_COEFFICIENTS[(roof_surface_type || "concrete").toLowerCase()] ??
      0.90;

    const result = sizeTanks({
      rainfall_by_year,
      candidate_capacities_litres,
      daily_demand_litres,
      usable_roof_area_sqm: gross_roof_area_sqm * USABILITY_FACTOR,
      runoff_coefficient,
      first_flush_fraction,
      tanker_rate_per_litre,
      tank_cost_per_litre,
      fixed_system_cost,
      reliability_target_percent,
      recharge_enabled,
      recharge_capacity_litres_per_day,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

export default router;
