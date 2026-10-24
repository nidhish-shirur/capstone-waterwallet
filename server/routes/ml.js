import { Router } from "express";
import { tier1SafetyGate } from "../services/tier1Safety.js";
import { predictConfig, predictYield } from "../services/mlEngine.js";

const router = Router();

// POST /api/ml/recommend
router.post("/recommend", (req, res) => {
  try {
    const {
      rooftop_area,
      borewell,
      borewell_depth,
      soil_perm,
      coastal_km,
      annual_rain_mm,
      peak_day_mm,
    } = req.body;

    // 1. Tier 1 Safety Gate
    const safetyResult = tier1SafetyGate({
      coastal_km,
      soil_perm,
      borewell,
      borewell_depth,
    });

    if (safetyResult) {
      return res.json({
        config: safetyResult.config,
        confidence: 1.0,
        source: safetyResult.source,
        safety_triggered: true,
        safety_reason: safetyResult.reason,
        shap_values: [],
        plain_language: safetyResult.reason,
        shap_available: false,
        explanation_warning:
          "SHAP is not used when the safety gate forces the recommendation.",
      });
    }

    // 2. Tier 2 ML Classifier & SHAP
    const result = predictConfig({
      rooftop_area,
      borewell,
      borewell_depth,
      soil_perm,
      coastal_km,
      annual_rain_mm,
      peak_day_mm,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// POST /api/ml/yield
router.post("/yield", (req, res) => {
  try {
    const { rooftop_area_m2, monthly_rainfall_mm } = req.body;
    const result = predictYield({
      rooftop_area: rooftop_area_m2,
      monthly_rainfall_mm,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

export default router;
