"""
Router: POST /api/ml/recommend
================================
Runs the dual-tier RWH configuration recommendation:

  Tier 1 — Hard Safety Gate  (always runs first)
  Tier 2 — RF Classifier + SHAP  (only if Tier 1 passes)

The response always includes:
  - config: recommended system type
  - confidence: model probability (1.0 when safety gate forces the decision)
  - safety_triggered: whether Tier 1 overrode the ML model
  - shap_values: per-feature SHAP contributions (empty if safety triggered)
  - plain_language: human-readable explanation
"""

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException
from models.schemas import MLRecommendRequest, MLRecommendResponse, SHAPValue
from services.tier1_safety import tier1_safety_gate
from services import ml_engine

router = APIRouter()


@router.post("/recommend", response_model=MLRecommendResponse)
def ml_recommend(payload: MLRecommendRequest) -> MLRecommendResponse:
    """
    Dual-tier RWH configuration recommendation.

    Tier 1 (safety gate) runs first. If any physical constraint fails,
    it forces Storage-Only without calling the ML model.
    Tier 2 (Random Forest + SHAP) runs only when Tier 1 passes.
    """
    # ── Tier 1: Hard Safety Gate ─────────────────────────────────────────────
    safety_result = tier1_safety_gate(
        coastal_km    = payload.coastal_km,
        soil_perm     = payload.soil_perm,
        borewell      = payload.borewell,
        borewell_depth = payload.borewell_depth,
    )

    if safety_result is not None:
        # Safety gate fired — return forced recommendation
        return MLRecommendResponse(
            config            = safety_result["config"],
            confidence        = 1.0,
            source            = safety_result["source"],
            safety_triggered  = True,
            safety_reason     = safety_result["reason"],
            shap_values       = [],
            plain_language    = safety_result["reason"],
        )

    # ── Tier 2: RF Classifier + SHAP ─────────────────────────────────────────
    try:
        result = ml_engine.predict_config(
            rooftop_area   = payload.rooftop_area,
            borewell       = payload.borewell,
            borewell_depth = payload.borewell_depth,
            soil_perm      = payload.soil_perm,
            coastal_km     = payload.coastal_km,
            annual_rain_mm = payload.annual_rain_mm,
            peak_day_mm    = payload.peak_day_mm,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )

    return MLRecommendResponse(
        config           = result["config"],
        confidence       = result["confidence"],
        source           = result["source"],
        safety_triggered = result["safety_triggered"],
        safety_reason    = result["safety_reason"],
        shap_values      = [SHAPValue(**s) for s in result["shap_values"]],
        plain_language   = result["plain_language"],
    )
