"""
ML Model Training Script — WaterWallet
========================================
Run this ONCE to train all models and save them as joblib pkl files.

Usage:
    cd D:\\VESIT\\Capstone\\backend
    python ml_models/train_models.py

What this script does:
  1. Fetches 15 years of real daily rainfall from Open-Meteo
     for Thane (lat 19.22, lon 72.97), 2010–2024.
  2. Aggregates to monthly data.
  3. Trains 3 models and saves them:
     a. RF Yield Regressor  → waterwallet_yield_model.pkl
     b. RF Config Classifier→ waterwallet_config_classifier.pkl
     c. LabelEncoder        → waterwallet_label_encoder.pkl
  4. Saves the P10/P50/P90 monthly percentile table → thane_rain_percentiles.csv
     (used by the Monte Carlo simulation).

This mirrors the logic in WaterWallet_ml_updated.ipynb (Cells 1–21).
"""

import os
import sys
import csv
import json
import urllib.request
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import joblib
import sklearn

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    r2_score,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HERE     = os.path.dirname(os.path.abspath(__file__))
OUT_DIR  = HERE  # save pkl files alongside this script

CLASSIFIER_PKL = os.path.join(OUT_DIR, "waterwallet_config_classifier.pkl")
YIELD_PKL      = os.path.join(OUT_DIR, "waterwallet_yield_model.pkl")
LABEL_ENC_PKL  = os.path.join(OUT_DIR, "waterwallet_label_encoder.pkl")
METADATA_JSON  = os.path.join(OUT_DIR, "model_metadata.json")
PERCENTILE_CSV = os.path.join(OUT_DIR, "thane_rain_percentiles.csv")

# ---------------------------------------------------------------------------
# Constants (match the Colab notebook)
# ---------------------------------------------------------------------------
LAT  = 19.22
LON  = 72.97
START_DATE = "2010-01-01"
END_DATE   = "2024-12-31"

ROOFTOP_AREA_M2   = 710.0   # Thane reference society
USABILITY_FACTOR  = 0.80
RUNOFF_COEFF      = 0.90
MONTHLY_DEMAND_KL = 43.0    # ~1433 residents × 135 LPCD × 30 / 1000

N_SYNTHETIC   = 600
RANDOM_STATE  = 42
TRAINING_METRICS = {}


# ---------------------------------------------------------------------------
# Step 1 — Fetch Open-Meteo rainfall data
# ---------------------------------------------------------------------------
def fetch_rainfall() -> pd.DataFrame:
    print("Fetching rainfall data from Open-Meteo...")
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={LAT}&longitude={LON}"
        f"&start_date={START_DATE}&end_date={END_DATE}"
        f"&daily=precipitation_sum"
        f"&timezone=Asia%2FKolkata"
    )
    with urllib.request.urlopen(url, timeout=60) as resp:
        data = json.loads(resp.read())

    daily = pd.DataFrame({
        "date":    pd.to_datetime(data["daily"]["time"]),
        "rain_mm": data["daily"]["precipitation_sum"],
    })
    daily["rain_mm"] = daily["rain_mm"].fillna(0).clip(lower=0)
    daily["year"]    = daily["date"].dt.year
    daily["month"]   = daily["date"].dt.month
    print(f"  Fetched {len(daily)} daily records ({START_DATE} to {END_DATE}).")
    return daily


# ---------------------------------------------------------------------------
# Step 2 — Aggregate to monthly
# ---------------------------------------------------------------------------
def aggregate_monthly(daily: pd.DataFrame) -> pd.DataFrame:
    monthly = (
        daily.groupby(["year", "month"])
        .agg(
            rain_mm  = ("rain_mm", "sum"),
            peak_day = ("rain_mm", "max"),
        )
        .reset_index()
    )
    monthly["date"] = pd.to_datetime(
        monthly["year"].astype(str) + "-" + monthly["month"].astype(str).str.zfill(2) + "-01"
    )
    return monthly.sort_values("date").reset_index(drop=True)


# ---------------------------------------------------------------------------
# Step 3 — Save P10/P50/P90 monthly percentile table for Monte Carlo
# ---------------------------------------------------------------------------
def save_percentile_table(monthly: pd.DataFrame):
    print("Saving monthly percentile table (P10/P50/P90)...")
    rows = []
    for m in range(1, 13):
        grp = monthly.loc[monthly["month"] == m, "rain_mm"]
        rows.append({
            "month": m,
            "p10":   round(float(grp.quantile(0.10)), 2),
            "p50":   round(float(grp.quantile(0.50)), 2),
            "p90":   round(float(grp.quantile(0.90)), 2),
        })

    with open(PERCENTILE_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["month", "p10", "p50", "p90"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Saved: {PERCENTILE_CSV}")


# ---------------------------------------------------------------------------
# Step 4 — Physics yield formula (vectorised)
# ---------------------------------------------------------------------------
def calculate_yield_kl(rainfall_mm, area=ROOFTOP_AREA_M2):
    """Yield in KL = Area × max(rain,0) × usability × runoff / 1000"""
    return area * np.maximum(rainfall_mm, 0) * USABILITY_FACTOR * RUNOFF_COEFF / 1000.0


# ---------------------------------------------------------------------------
# Step 5 — Train RF Yield Regressor
# ---------------------------------------------------------------------------
def train_yield_model(monthly: pd.DataFrame) -> tuple:
    """
    1,800-sample dataset: 10 rooftop sizes × 180 months (full monthly series).
    Features: rooftop_area, month, rain_mm, annual_rain_mm, peak_day_proxy,
              lag1_rain, lag2_rain, lag3_rain, sin_month, cos_month.
    Target: yield_kl (physics formula — RF learns the physics relationship).
    Train: 2010–2021 (1,440 rows). Test: 2022–2024 (360 rows).
    """
    print("\nTraining RF Yield Regressor...")

    rooftop_sizes = [200, 300, 400, 500, 600, 700, 800, 1000, 1200, 1500]
    rows = []

    for area in rooftop_sizes:
        m = monthly.copy()
        # Lag features
        m["lag1_rain"] = m["rain_mm"].shift(1).fillna(0)
        m["lag2_rain"] = m["rain_mm"].shift(2).fillna(0)
        m["lag3_rain"] = m["rain_mm"].shift(3).fillna(0)

        # Annual rain (rolling 12-month sum for each row's year)
        yr_totals = m.groupby("year")["rain_mm"].transform("sum")
        m["annual_rain_mm"] = yr_totals

        m["sin_month"] = np.sin(2 * np.pi * m["month"] / 12)
        m["cos_month"] = np.cos(2 * np.pi * m["month"] / 12)
        m["rooftop_area"] = float(area)
        # The API receives monthly totals, not daily observations. Keep this
        # feature available at inference by using the same monthly proxy.
        m["peak_day_proxy"] = m["rain_mm"] / 30.0
        m["yield_kl"] = calculate_yield_kl(m["rain_mm"], area)
        rows.append(m)

    df = pd.concat(rows, ignore_index=True)

    FEATURES = [
        "rooftop_area", "month", "rain_mm", "annual_rain_mm",
        "peak_day_proxy", "lag1_rain", "lag2_rain", "lag3_rain",
        "sin_month", "cos_month",
    ]

    train_df = df[df["year"] <= 2021]
    test_df  = df[df["year"] >= 2022]

    X_train = train_df[FEATURES].values
    y_train = train_df["yield_kl"].values
    X_test  = test_df[FEATURES].values
    y_test  = test_df["yield_kl"].values

    rf = RandomForestRegressor(
        n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1
    )
    rf.fit(X_train, y_train)

    preds = rf.predict(X_test)
    mae   = mean_absolute_error(y_test, preds)
    r2    = r2_score(y_test, preds)
    print(f"  RF Yield Regressor — MAE: {mae:.2f} KL  R²: {r2:.4f}")
    TRAINING_METRICS["yield"] = {
        "mae_kl": round(float(mae), 4),
        "r2": round(float(r2), 4),
    }

    joblib.dump(rf, YIELD_PKL)
    print(f"  Saved: {YIELD_PKL}")
    return rf, mae, r2


# ---------------------------------------------------------------------------
# Step 6 — Generate synthetic site dataset + train RF Classifier
# ---------------------------------------------------------------------------
def classify_rwh(row) -> str:
    """
    Engineering labeling function (BMC RWH Guidelines 2007, revised 2019).
    Maps site features to one of: Storage-Only, Borewell-Recharge, Hybrid.
    """
    coastal    = row["coastal_km"] <= 2.5
    has_bw     = row["borewell"] == 1
    deep_bw    = row["borewell_depth"] >= 30.0
    good_soil  = row["soil_perm"] >= 2
    large_roof = row["rooftop_area"] >= 500.0

    if coastal or not has_bw or not deep_bw or not good_soil:
        return "Storage-Only"
    if large_roof:
        return "Hybrid"
    return "Borewell-Recharge"


def train_classifier(monthly: pd.DataFrame) -> tuple:
    print("\nTraining RF Configuration Classifier...")

    # Statistics from real Open-Meteo data for synthetic sampling
    annual_totals = monthly.groupby("year")["rain_mm"].sum()
    real_ann_mean = float(annual_totals.mean())
    real_ann_std  = float(annual_totals.std())
    real_peak_mean = float(monthly["peak_day"].mean())

    np.random.seed(RANDOM_STATE)
    N = N_SYNTHETIC

    borewell       = np.random.choice([0, 1], N, p=[0.40, 0.60])
    borewell_depth = np.where(borewell, np.random.randint(30, 200, N), 0).astype(float)

    site_df = pd.DataFrame({
        "rooftop_area":   np.random.randint(150, 1800, N).astype(float),
        "borewell":       borewell.astype(float),
        "borewell_depth": borewell_depth,
        "soil_perm":      np.random.choice(
            [1, 2, 3, 4, 5], N, p=[0.08, 0.22, 0.40, 0.22, 0.08]
        ).astype(float),
        "coastal_km":     np.random.randint(1, 35, N).astype(float),
        "annual_rain_mm": np.random.normal(real_ann_mean, real_ann_std, N)
                              .clip(1200, 3500).round(0),
        "peak_day_mm":    np.random.normal(real_peak_mean, 18, N)
                              .clip(15, 180).round(1),
    })
    site_df["config"] = site_df.apply(classify_rwh, axis=1)

    print(f"  Class distribution:\n{site_df['config'].value_counts().to_string()}")

    CLF_FEATURES = [
        "rooftop_area", "borewell", "borewell_depth",
        "soil_perm", "coastal_km", "annual_rain_mm", "peak_day_mm",
    ]

    le    = LabelEncoder()
    X_clf = site_df[CLF_FEATURES].values
    y_enc = le.fit_transform(site_df["config"].values)

    X_train, X_test, y_train, y_test = train_test_split(
        X_clf, y_enc, test_size=0.2, random_state=RANDOM_STATE, stratify=y_enc
    )

    base_clf = RandomForestClassifier(
        n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1
    )
    rf_clf = CalibratedClassifierCV(base_clf, method="sigmoid", cv=5)
    rf_clf.fit(X_train, y_train)

    predictions = rf_clf.predict(X_test)
    acc = accuracy_score(y_test, predictions)
    balanced_acc = balanced_accuracy_score(y_test, predictions)
    macro_f1 = f1_score(y_test, predictions, average="macro")
    matrix = confusion_matrix(y_test, predictions).tolist()
    print(f"  RF Classifier — Accuracy: {acc:.4f}")
    print(f"  Balanced accuracy: {balanced_acc:.4f}  Macro F1: {macro_f1:.4f}")
    print(f"  Confusion matrix: {matrix}")
    print(f"  Classes: {list(le.classes_)}")

    # Real case validation
    real_case_features = np.array([[710.0, 1.0, 95.0, 3.0, 25.0, real_ann_mean, real_peak_mean]])
    pred_enc   = rf_clf.predict(real_case_features)[0]
    pred_label = le.inverse_transform([pred_enc])[0]
    proba      = rf_clf.predict_proba(real_case_features)[0]
    confidence = proba[pred_enc]
    expert_gt  = "Hybrid"
    match      = "[OK] CORRECT" if pred_label == expert_gt else "[MISMATCH]"
    print(f"\n  Real Thane case validation:")
    print(f"    Expert ground truth : {expert_gt}")
    print(f"    Model prediction    : {pred_label} ({confidence:.1%} confidence)")
    print(f"    Result              : {match}")

    joblib.dump(rf_clf, CLASSIFIER_PKL)
    joblib.dump(le, LABEL_ENC_PKL)
    print(f"\n  Saved: {CLASSIFIER_PKL}")
    print(f"  Saved: {LABEL_ENC_PKL}")

    metadata = {
        "training_version": 1,
        "trained_at_utc": pd.Timestamp.utcnow().isoformat(),
        "sklearn_version": sklearn.__version__,
        "random_state": RANDOM_STATE,
        "classifier": {
            "type": "CalibratedClassifierCV(RandomForestClassifier)",
            "features": CLF_FEATURES,
            "samples": int(len(site_df)),
            "metrics": {
                "accuracy": round(float(acc), 4),
                "balanced_accuracy": round(float(balanced_acc), 4),
                "macro_f1": round(float(macro_f1), 4),
                "confusion_matrix": matrix,
            },
        },
        "yield_regressor": {
            "type": "RandomForestRegressor",
            "features": [
                "rooftop_area", "month", "rain_mm", "annual_rain_mm",
                "peak_day_proxy", "lag1_rain", "lag2_rain", "lag3_rain",
                "sin_month", "cos_month",
            ],
            "training_years": "2010-2021",
            "test_years": "2022-2024",
            "metrics": TRAINING_METRICS.get("yield", {}),
        },
    }
    with open(METADATA_JSON, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"  Saved: {METADATA_JSON}")

    return rf_clf, le, acc


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("WaterWallet — ML Model Training")
    print("=" * 60)

    daily   = fetch_rainfall()
    monthly = aggregate_monthly(daily)

    save_percentile_table(monthly)
    train_yield_model(monthly)
    train_classifier(monthly)

    print("\n" + "=" * 60)
    print("All models trained and saved successfully.")
    print(f"Output directory: {OUT_DIR}")
    print("=" * 60)
