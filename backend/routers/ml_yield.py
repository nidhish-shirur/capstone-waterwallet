"""
Router: POST /api/ml/yield
===========================
Predicts monthly rainwater yield (KL) using the trained RF Regressor.

If the model pkl file is not found (i.e., train_models.py hasn't been run yet),
the endpoint falls back gracefully to the physics formula and indicates this
in the response via `source: "physics_formula"`.
"""

from fastapi import APIRouter
from models.schemas import MLYieldRequest, MLYieldResponse
from services import ml_engine

router = APIRouter()


@router.post("/yield", response_model=MLYieldResponse)
def ml_yield(payload: MLYieldRequest) -> MLYieldResponse:
    """
    Predict monthly rainwater yield using the RF Regressor.
    Falls back to the physics formula if model files are not found.
    """
    result = ml_engine.predict_yield(
        rooftop_area        = payload.rooftop_area_m2,
        monthly_rainfall_mm = payload.monthly_rainfall_mm,
    )

    return MLYieldResponse(
        monthly_yield_kl = result["monthly_yield_kl"],
        annual_yield_kl  = result["annual_yield_kl"],
        source           = result["source"],
    )
