"""
ML Engine — WaterWallet
========================
Loads the trained joblib models at startup and provides two inference
functions used by the API routers:

  1. predict_config(site_features) → classification + SHAP
  2. predict_yield(rooftop_area, monthly_rainfall) → RF yield regression

Models are loaded once at module import time (singleton pattern).
If the pkl files do not exist yet, a clear RuntimeError is raised with
instructions to run the training script first.
"""

import os
import joblib
import numpy as np
from typing import Optional

# ---------------------------------------------------------------------------
# Model paths
# ---------------------------------------------------------------------------
_ML_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "ml_models"))

_CLASSIFIER_PATH   = os.path.join(_ML_DIR, "waterwallet_config_classifier.pkl")
_YIELD_MODEL_PATH  = os.path.join(_ML_DIR, "waterwallet_yield_model.pkl")
_LABEL_ENC_PATH    = os.path.join(_ML_DIR, "waterwallet_label_encoder.pkl")

# Features in the exact order the models were trained with
CLF_FEATURES = [
    "rooftop_area",
    "borewell",
    "borewell_depth",
    "soil_perm",
    "coastal_km",
    "annual_rain_mm",
    "peak_day_mm",
]

YIELD_FEATURES = [
    "rooftop_area",
    "month",
    "rain_mm",
    "annual_rain_mm",
    "peak_day",
    "lag1_rain",
    "lag2_rain",
    "lag3_rain",
    "sin_month",
    "cos_month",
]


# ---------------------------------------------------------------------------
# Lazy-loaded singletons
# ---------------------------------------------------------------------------
_clf       = None
_yield_rf  = None
_le        = None
_shap_exp  = None


def _load_models():
    """Load all three models once and cache them."""
    global _clf, _yield_rf, _le, _shap_exp

    if _clf is not None:
        return  # already loaded

    for path, name in [
        (_CLASSIFIER_PATH,  "Configuration classifier"),
        (_YIELD_MODEL_PATH, "Yield regressor"),
        (_LABEL_ENC_PATH,   "Label encoder"),
    ]:
        if not os.path.exists(path):
            raise RuntimeError(
                f"{name} not found at: {path}\n"
                "Run `python backend/ml_models/train_models.py` first to train and "
                "save the models."
            )

    _clf      = joblib.load(_CLASSIFIER_PATH)
    _yield_rf = joblib.load(_YIELD_MODEL_PATH)
    _le       = joblib.load(_LABEL_ENC_PATH)

    # SHAP TreeExplainer — loaded lazily so shap import error doesn't break the server
    try:
        import shap
        _shap_exp = shap.TreeExplainer(_clf)
    except ImportError:
        _shap_exp = None


def _build_shap_explanation(
    shap_values_3d_or_list,
    feature_values: list,
    pred_class_idx: int,
) -> list[dict]:
    """
    Convert raw SHAP output to a list of {feature, value, shap} dicts.
    Handles both modern (3D array) and legacy (list of arrays) SHAP formats.
    """
    sv = shap_values_3d_or_list
    if isinstance(sv, np.ndarray) and sv.ndim == 3:
        # Modern SHAP: shape (n_samples, n_features, n_classes)
        contrib = sv[0, :, pred_class_idx]
    else:
        # Legacy SHAP: list of arrays, one per class
        contrib = sv[pred_class_idx][0]

    return [
        {
            "feature": feat,
            "value":   round(float(feature_values[i]), 4),
            "shap":    round(float(contrib[i]), 4),
        }
        for i, feat in enumerate(CLF_FEATURES)
    ]


def _plain_language_explanation(
    config: str, shap_rows: list[dict]
) -> str:
    """
    Build a plain English explanation of the recommendation using the top SHAP drivers.
    """
    positive = [
        r for r in sorted(shap_rows, key=lambda x: x["shap"], reverse=True)
        if r["shap"] > 0.01
    ]

    FEATURE_LABELS = {
        "borewell":       "borewell presence",
        "borewell_depth": "borewell depth ({value:.0f} m)",
        "rooftop_area":   "rooftop area ({value:.0f} m²)",
        "soil_perm":      "soil permeability class {value:.0f}",
        "coastal_km":     "coastal distance ({value:.0f} km)",
        "annual_rain_mm": "annual rainfall ({value:.0f} mm)",
        "peak_day_mm":    "peak daily rainfall ({value:.1f} mm)",
    }

    drivers = []
    for r in positive[:3]:
        template = FEATURE_LABELS.get(r["feature"], r["feature"])
        drivers.append(template.format(value=r["value"]))

    if not drivers:
        return f"{config} is the recommended configuration for this site."

    driver_str = ", ".join(drivers[:-1])
    if len(drivers) > 1:
        driver_str += f", and {drivers[-1]}"
    else:
        driver_str = drivers[0]

    return f"{config} recommended because {driver_str} support this configuration."


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def predict_config(
    rooftop_area: float,
    borewell: int,
    borewell_depth: float,
    soil_perm: int,
    coastal_km: float,
    annual_rain_mm: float,
    peak_day_mm: float,
) -> dict:
    """
    Run the RF classifier for RWH configuration.

    Returns:
        {
          "config": "Hybrid",
          "confidence": 0.96,
          "source": "rf_classifier",
          "safety_triggered": False,
          "safety_reason": None,
          "shap_values": [...],
          "plain_language": "Hybrid recommended because ..."
        }
    """
    _load_models()

    feature_values = [
        rooftop_area, float(borewell), borewell_depth,
        float(soil_perm), coastal_km, annual_rain_mm, peak_day_mm,
    ]
    X = np.array([feature_values])

    pred_enc   = int(_clf.predict(X)[0])
    pred_label = _le.inverse_transform([pred_enc])[0]
    proba      = _clf.predict_proba(X)[0]
    confidence = float(proba[pred_enc])

    # SHAP
    shap_rows = []
    if _shap_exp is not None:
        try:
            sv = _shap_exp.shap_values(X)
            shap_rows = _build_shap_explanation(sv, feature_values, pred_enc)
        except Exception:
            pass  # SHAP failure is non-fatal

    plain = _plain_language_explanation(pred_label, shap_rows)

    return {
        "config":           pred_label,
        "confidence":       round(confidence, 4),
        "source":           "rf_classifier",
        "safety_triggered": False,
        "safety_reason":    None,
        "shap_values":      shap_rows,
        "plain_language":   plain,
    }


def predict_yield(
    rooftop_area: float,
    monthly_rainfall_mm: list[float],
) -> dict:
    """
    Predict monthly yield (KL) using the RF Regressor.
    Falls back to the physics formula if model not loaded.

    Args:
        rooftop_area:         Usable rooftop area in m².
        monthly_rainfall_mm:  List of 12 monthly rainfall values (mm).

    Returns:
        {
          "monthly_yield_kl": [float × 12],
          "annual_yield_kl": float,
          "source": "rf_regressor" | "physics_formula"
        }
    """
    try:
        _load_models()
    except RuntimeError:
        # Fall back to physics formula
        return _physics_yield_fallback(rooftop_area, monthly_rainfall_mm)

    rain = np.array(monthly_rainfall_mm, dtype=float)
    annual_rain = rain.sum()
    lag1 = np.roll(rain, 1); lag1[0]  = 0.0
    lag2 = np.roll(rain, 2); lag2[:2] = 0.0
    lag3 = np.roll(rain, 3); lag3[:3] = 0.0

    months     = np.arange(1, 13, dtype=float)
    sin_month  = np.sin(2 * np.pi * months / 12)
    cos_month  = np.cos(2 * np.pi * months / 12)
    peak_day   = rain  # simplified: peak ≈ monthly total / 30 × scale

    X_rows = np.column_stack([
        np.full(12, rooftop_area),  # rooftop_area
        months,                      # month
        rain,                        # rain_mm
        np.full(12, annual_rain),    # annual_rain_mm
        peak_day / 30.0,             # peak_day (approx)
        lag1,                        # lag1_rain
        lag2,                        # lag2_rain
        lag3,                        # lag3_rain
        sin_month,                   # sin_month
        cos_month,                   # cos_month
    ])

    monthly_kl = _yield_rf.predict(X_rows).clip(0)
    return {
        "monthly_yield_kl": [round(float(v), 3) for v in monthly_kl],
        "annual_yield_kl":  round(float(monthly_kl.sum()), 3),
        "source":           "rf_regressor",
    }


def _physics_yield_fallback(
    rooftop_area: float,
    monthly_rainfall_mm: list[float],
    usability: float = 0.80,
    runoff: float = 0.90,
) -> dict:
    """Physics formula fallback when model files are missing."""
    rain = np.array(monthly_rainfall_mm, dtype=float)
    monthly_kl = rooftop_area * np.maximum(rain, 0) * usability * runoff / 1000.0
    return {
        "monthly_yield_kl": [round(float(v), 3) for v in monthly_kl],
        "annual_yield_kl":  round(float(monthly_kl.sum()), 3),
        "source":           "physics_formula",
    }
