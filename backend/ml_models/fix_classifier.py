"""
Quick fix: re-run only the classifier training to save missing pkl files.
The yield model was already saved in the previous run.
"""
import os, warnings
warnings.filterwarnings("ignore")
import json, urllib.request
import numpy as np, pandas as pd, joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score

HERE = os.path.dirname(os.path.abspath(__file__))

# ── Fetch rainfall data ───────────────────────────────────────────────────────
url = (
    "https://archive-api.open-meteo.com/v1/archive"
    "?latitude=19.22&longitude=72.97"
    "&start_date=2010-01-01&end_date=2024-12-31"
    "&daily=precipitation_sum&timezone=Asia%2FKolkata"
)
print("Fetching rainfall data...")
with urllib.request.urlopen(url, timeout=60) as resp:
    data = json.loads(resp.read())

daily = pd.DataFrame({"date": pd.to_datetime(data["daily"]["time"]),
                       "rain_mm": data["daily"]["precipitation_sum"]})
daily["rain_mm"] = daily["rain_mm"].fillna(0).clip(lower=0)
daily["year"]    = daily["date"].dt.year
daily["month"]   = daily["date"].dt.month

monthly = (daily.groupby(["year","month"])
           .agg(rain_mm=("rain_mm","sum"), peak_day=("rain_mm","max"))
           .reset_index())
print(f"Monthly data: {len(monthly)} rows")

# ── Statistics for synthetic sampling ─────────────────────────────────────────
ann    = monthly.groupby("year")["rain_mm"].sum()
mu, sd = float(ann.mean()), float(ann.std())
pk     = float(monthly["peak_day"].mean())

# ── Synthetic dataset ─────────────────────────────────────────────────────────
np.random.seed(42)
N = 600

def classify_rwh(row):
    coastal    = row["coastal_km"] < 3
    has_bw     = row["borewell"] == 1
    deep_bw    = row["borewell_depth"] > 80
    good_soil  = row["soil_perm"] >= 3
    large_roof = row["rooftop_area"] > 600
    if coastal: return "Storage-Only"
    if has_bw and good_soil and large_roof: return "Hybrid"
    if has_bw and deep_bw and good_soil: return "Borewell-Recharge"
    if has_bw and large_roof: return "Hybrid"
    return "Storage-Only"

bw  = np.random.choice([0,1], N, p=[0.40,0.60])
bwd = np.where(bw, np.random.randint(30,200,N), 0).astype(float)

df = pd.DataFrame({
    "rooftop_area":   np.random.randint(150,1800,N).astype(float),
    "borewell":       bw.astype(float),
    "borewell_depth": bwd,
    "soil_perm":      np.random.choice([1,2,3,4,5],N,p=[0.08,0.22,0.40,0.22,0.08]).astype(float),
    "coastal_km":     np.random.randint(1,35,N).astype(float),
    "annual_rain_mm": np.random.normal(mu,sd,N).clip(1200,3500).round(0),
    "peak_day_mm":    np.random.normal(pk,18,N).clip(15,180).round(1),
})
df["config"] = df.apply(classify_rwh, axis=1)
print("Class dist:", df["config"].value_counts().to_dict())

# ── Train ──────────────────────────────────────────────────────────────────────
FEATS = ["rooftop_area","borewell","borewell_depth","soil_perm","coastal_km","annual_rain_mm","peak_day_mm"]
le    = LabelEncoder()
X     = df[FEATS].values
y     = le.fit_transform(df["config"].values)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

clf = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
clf.fit(Xtr, ytr)
acc = accuracy_score(yte, clf.predict(Xte))
print(f"Test accuracy: {acc:.4f}")

# Validate real case
rx = np.array([[710.0,1.0,95.0,3.0,25.0,mu,pk]])
pe = clf.predict(rx)[0]
pl = le.inverse_transform([pe])[0]
cf = clf.predict_proba(rx)[0][pe]
print(f"Thane prediction: {pl} ({cf:.1%}) - Expert: Hybrid - Match: {pl=='Hybrid'}")

# ── Save ───────────────────────────────────────────────────────────────────────
joblib.dump(clf, os.path.join(HERE, "waterwallet_config_classifier.pkl"))
joblib.dump(le,  os.path.join(HERE, "waterwallet_label_encoder.pkl"))
print("Saved: waterwallet_config_classifier.pkl")
print("Saved: waterwallet_label_encoder.pkl")
print("Done.")
