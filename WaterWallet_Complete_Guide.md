# WaterWallet — Complete Project Guide
### A Physics-Informed ML Decision-Support System for Rainwater Harvesting
**VESIT Capstone 2025–26 | Guide: Dr. Mrs. Gresha Bhatia**
**Team: Nidhish Shirur · Neha Bhatia · Diksha Bagwe**

---

## Table of Contents

1. [The Problem — Why This Project Exists](#1-the-problem)
2. [The Solution — What WaterWallet Does](#2-the-solution)
3. [Who Uses It](#3-who-uses-it)
4. [How It Works — The Full Workflow](#4-how-it-works)
5. [The Three Phases of the Web App](#5-the-three-phases)
6. [The Machine Learning Layer](#6-the-machine-learning-layer)
7. [The Deep Learning Component](#7-the-deep-learning-component)
8. [The Financial Engine](#8-the-financial-engine)
9. [System Architecture](#9-system-architecture)
10. [Tech Stack Explained](#10-tech-stack-explained)
11. [Data Sources](#11-data-sources)
12. [Key Engineering Standards Used](#12-key-engineering-standards-used)
13. [ML Models — Summary](#13-ml-models-summary)
14. [Key Results](#14-key-results)
15. [What Makes This Different](#15-what-makes-this-different)
16. [Honest Limitations](#16-honest-limitations)
17. [Future Scope](#17-future-scope)
18. [File Structure](#18-file-structure)

---

## 1. The Problem

### The Water Crisis in Mumbai

Mumbai and its surrounding districts (Thane, Kalyan, Navi Mumbai) receive
heavy rainfall every monsoon — sometimes over 2,000 mm per year. Yet,
paradoxically, housing societies in these areas run out of water every
summer. Why?

Because most of the rainwater flows away as runoff into drains and the sea.
Meanwhile, municipal water supply is unreliable, groundwater is depleting,
and societies are forced to buy water from private tankers at **INR 800
per kilolitre** — an unregulated, expensive, and unsustainable solution.

### The Tanker Dependency Problem

A typical 50-flat housing society in Thane might spend:
- **INR 3–5 lakh per year** on private water tankers
- This cost increases every year because tanker prices are unregulated
- Over 10 years, that is INR 40–50 lakh — spent entirely on a temporary fix

### The Obvious Solution Nobody Is Using

**Rainwater Harvesting (RWH)** — collecting rooftop rainwater in a tank
or recharging it into a borewell — can eliminate or drastically reduce
tanker dependency. The BMC (Brihanmumbai Municipal Corporation) has
**mandated RWH for buildings over 500 sq m since 2019**.

A real case study from Bengaluru: a 52-flat apartment spent INR 1.6 lakh
on an RWH system and saved **INR 3 lakh every year**. Break-even in under
2 years.

### So Why Is Nobody Doing It?

The obstacle is not technical. It is **decisional**. Society committees
(volunteer residents, not engineers) face these barriers:

1. **"Which system should we build?"** — Storage tank? Borewell recharge?
   Both? Nobody tells them.
2. **"Will it actually save money?"** — They have no way to calculate ROI.
3. **"What will the break-even be?"** — One bad monsoon could shift it by
   years. Nobody accounts for this.
4. **"We can't afford consultants"** — A civil engineer costs money before
   any decision is even made.

**WaterWallet exists to remove all four barriers.**

---

## 2. The Solution

WaterWallet is a **web-based, zero-hardware decision-support platform**.

A society secretary sits down, spends 10–15 minutes entering information
about their building and billing history, draws their rooftop on a
satellite map, and walks away with:

- A site-specific recommendation: *"You should build a Hybrid system
  (storage + borewell recharge)"*
- An explanation: *"Because your borewell is 95m deep and your soil is
  laterite — both support recharge"*
- A financial projection: *"You will break even between Year 2 and Year 4
  depending on monsoon performance"*
- A downloadable PDF report to present to the committee

No civil engineer visit. No IoT sensors. No hardware costs before
a decision is made.

### The Core Idea: Physics + Machine Learning

WaterWallet does not replace engineering formulas with black-box AI.
Instead:

- **Physics formulas** (IS:1172, runoff coefficient, demand-gating)
  handle what is mathematically certain
- **Machine Learning** handles what is uncertain or too complex for
  simple rules:
  - How much rain will fall next year? (SARIMA time-series model)
  - Which RWH system suits this specific site? (Random Forest classifier)
  - What is the realistic range of financial outcomes? (Monte Carlo simulation)

This combination is called a **physics-informed ML system**.

---

## 3. Who Uses It

**Primary user:** Society secretary or management committee member.
Non-technical person. Volunteer resident with a day job.

**What they know:** Their building details, their water bills, their
borewell depth (roughly).

**What they do not know:** Hydrology, civil engineering, financial
modelling, soil science.

**The system is designed so they never need to know any of that.**

---

## 4. How It Works — The Full Workflow

```
Society secretary opens WaterWallet
            ↓
STEP 1 — Virtual Meter
  Enter: flats, occupants, amenities, past water bills, tanker logs
  Output: baseline daily water demand, annual tanker expenditure
            ↓
STEP 2 — Map Studio
  Draw rooftop polygon on satellite map
  System fetches real rainfall data for that exact location
  Output: catchment area, maximum harvestable yield, estimated cost
            ↓
ML LAYER runs automatically
  Tier 1 Safety Gate: is the site safe for recharge?
  Tier 2 Classifier: Storage-Only / Borewell-Recharge / Hybrid?
  SHAP: why did the model make that recommendation?
            ↓
STEP 3 — ROI Dashboard
  10-year financial simulation with three inflation scenarios
  Monte Carlo: 1,000 yield scenarios → probability of break-even by year
  Sensitivity analysis: which variable affects break-even most?
            ↓
Download PDF report → present to committee → vote
```

---

## 5. The Three Phases of the Web App

### Phase 1 — Virtual Meter

**Purpose:** Establish how much water the society needs and how much
they are currently spending.

**Inputs:**
- Number of flats and average occupants
- Water-heavy amenities (garden, car wash, swimming pool)
- Past municipal water bills (month by month)
- Past private tanker purchases (volume and cost per month)

**Calculations:**
```
Base daily demand = Flats × Occupants × 135 litres
                   (135 LPCD = IS:1172 Indian Standard)
After UFW factor  = Base × 1.15  (15% pipe losses, CPHEEO standard)
Final demand      = After UFW × 1.10  (10% safety buffer)
```

**Outputs:**
- Daily and annual water demand in kilolitres
- Annual "tanker bleed" — total money spent on private tankers
- Monthly billing log with high-stress months highlighted

**Override option:** If the society has real metered consumption data,
they can bypass the IS:1172 formula entirely and enter actual figures.

---

### Phase 2 — Map Studio

**Purpose:** Calculate how much rainwater the rooftop can actually collect.

**How it works:**
1. User opens an interactive satellite map (Leaflet.js + ESRI imagery)
2. User clicks around their rooftop to draw a polygon
3. Turf.js calculates the polygon area in square metres using the
   Shoelace coordinate geometry algorithm
4. The system fetches real historical daily rainfall for those exact
   GPS coordinates from the Open-Meteo Archive API (free, no key needed)

**Physics yield formula:**
```
Yield (litres) = Area × 0.80 × (Rainfall_mm ÷ 1000) × 0.90 × 1000

Where:
  0.80 = Usability factor (20% of roof is unusable — tanks, solar panels,
         lift rooms, AC units)
  0.90 = Runoff coefficient (10% of rain evaporates or is absorbed
         before reaching the downpipe on concrete rooftops)
```

**Outputs:**
- Gross rooftop area and usable catchment area
- Maximum harvestable yield per year (litres and kilolitres)
- Monthly yield distribution showing monsoon concentration
- Parametric Capex estimate based on MMR District Schedule of Rates

**Offline caching:** A service worker (`sw.js`) caches the satellite
map tiles for the Thane region so the map loads instantly on repeat visits
and works on slow connections.

---

### Phase 3 — ROI Dashboard

**Purpose:** Show the committee exactly when their investment pays off —
and how certain that timeline is.

**How the basic ROI works:**
```
For each year from 1 to 10:
  Tanker savings = Annual yield × INR 800/KL × (1 + 0.08)^(year-1)
                   [tanker costs inflate at 8% per year]
  Maintenance    = Capex × 0.03
                   [3% Annual Maintenance Contract]
  Net position   = Cumulative savings − Capex − Cumulative maintenance
  Break-even     = First year where Net position ≥ 0
```

**The problem with a single break-even year:** It assumes one fixed
rainfall figure. If the monsoon is weak, break-even could be Year 5
instead of Year 3. The committee deserves to know this.

**The ML upgrade:** The Monte Carlo ROI simulation samples 1,000 possible
yield scenarios and runs the break-even for each, producing a probability
distribution: *"72% chance of break-even by Year 3, 91% by Year 4."*

**Outputs:**
- Three ROI curves (6%, 8%, 12% inflation scenarios)
- Monte Carlo break-even probability distribution
- Sensitivity analysis (which input variable affects break-even most)
- Configuration recommendation card with SHAP explanation
- Safety checklist (for recharge configurations)
- Downloadable PDF report

---

## 6. The Machine Learning Layer

The ML layer runs between Phase 2 and Phase 3. It does three things.

### ML Task 1 — Rainfall Forecasting (Time Series)

**The problem:** To predict future yield, we need to predict future
rainfall. The Open-Meteo API gives us historical data. We need to
forecast the next 12 months.

**Three models compared:**

| Model | What it does | MAE (mm) | Result |
|---|---|---|---|
| Same-Month Baseline | Predicts this month = same month last year | 72.75 | Naive baseline |
| Auto-SARIMA | Seasonal ARIMA, order selected by AIC | **68.62** | ✓ Selected |
| Random Forest (recursive) | Lag features, recursive forecast | 136.46 | Worse than baseline |

**Why Random Forest fails here:** With only 144 training months and
a zero-inflated monsoon distribution (near-zero for 8 months, extreme
for 4 months), the Random Forest collapses toward the mean during dry
months and fails to predict the monsoon spike. This is a valid,
honest negative result — not all ML beats classical statistics.

**Why Auto-SARIMA wins:** SARIMA explicitly models seasonal patterns
(m=12 for monthly data) and the AIC criterion selects the optimal
parameter combination from the data, avoiding manual tuning.

**Data used:** 15 years of real daily precipitation from Open-Meteo
for Thane (lat 19.22, lon 72.97), 2010–2025. Aggregated to 180 monthly
observations. Temporal split: train 2010–2021 (144 months), test
2022–2025 (48 months).

---

### ML Task 2 — RWH Configuration Classifier (Multi-Class Classification)

**The problem:** Every existing system tells every society to build a
storage tank. But the right system depends on the site. A society with
a 95m borewell in laterite soil should recharge groundwater, not just
store water in a tank.

**The four possible configurations (simplified to three):**
- **Storage-Only** — underground/overhead tank, no recharge
- **Borewell-Recharge** — rooftop water filtered and injected into
  existing borewell
- **Hybrid** — storage tank + overflow to borewell recharge (best of both)

**The dual-tier architecture:**

**Tier 1 — Hard Safety Gate (runs first, always):**
Before the ML classifier even runs, three physical safety checks are
enforced. No model confidence can override these:
1. If coastal distance ≤ 2.5 km → Force Storage-Only
   (recharge risks seawater intrusion into aquifers)
2. If soil permeability class = 1 (hard rock) AND no borewell →
   Force Storage-Only (recharge physically impossible)
3. If borewell depth < 30m → Force Storage-Only
   (too shallow for safe injection)

**Tier 2 — Random Forest Classifier (runs only if Tier 1 passes):**

Input features (7):

| Feature | What it captures |
|---|---|
| rooftop_area | How much water can be collected |
| borewell | Whether injection infrastructure exists |
| borewell_depth | Whether the aquifer is deep enough |
| soil_perm | Whether the ground can absorb recharge |
| coastal_km | Seawater intrusion risk |
| annual_rain_mm | How much water is available |
| peak_day_mm | Whether intense bursts cause overflow |

Training data: 600 synthetic site samples generated from BMC and
CPHEEO engineering guidelines. Clearly disclosed as synthetic.
Annual rainfall values drawn from the real Open-Meteo distribution.

Results:

| Model | Test Accuracy | 5-fold CV | CV Std Dev |
|---|---|---|---|
| Decision Tree (baseline) | 1.000 | 0.995 | 0.007 |
| **Random Forest (selected)** | **1.000** | **0.997** | **0.003** |

Real case study validation: The model predicted **Hybrid with 96.0%
confidence** for the actual Thane society (24-month field dataset).
Expert assessment: Hybrid. **Result: ✓ CORRECT.**

**Why ML instead of just using the rules directly?**

Three empirical tests prove ML adds value over static if-else rules:

1. **Noise stability:** When user inputs have ±10% measurement error
   (realistic for estimated borewell depth), the ML classifier's
   recommendation changes less often than the static rule system.
   ML is more stable under uncertainty.

2. **Boundary continuity:** At the coastal distance threshold, the
   static rule creates a cliff — 2.49 km gets one recommendation,
   2.51 km gets a completely different one. The ML classifier produces
   a smooth probability curve, communicating uncertainty instead of
   making an arbitrary binary jump.

3. **Latency:** Both systems run in under 15 ms. ML adds no overhead.

**SHAP Explainability:**
For every prediction, SHAP (SHapley Additive exPlanations) decomposes
the recommendation into per-feature contributions. For the Thane society:

| Feature | Value | SHAP | Meaning |
|---|---|---|---|
| borewell | Yes | +0.172 | Strongest driver toward Hybrid |
| borewell_depth | 95m | +0.162 | Confirms aquifer access |
| rooftop_area | 710 m² | +0.161 | Justifies storage component |
| coastal_km | 25 km | +0.044 | No intrusion risk |
| peak_day_mm | 51.1 mm | −0.002 | Minor negative correction |

The dashboard shows this as plain language: *"Hybrid recommended
because borewell presence, borewell depth (95m), and rooftop area
(710 m²) support this configuration."*

---

### ML Task 3 — ROI Sensitivity Analysis (Gradient Boosting + SHAP)

**The problem:** Which input variable most affects the break-even year?
If a committee asks "what if tanker prices rise 12% instead of 8%?",
we should have a quantitative answer.

**Method:**
1. Generate 10,000 synthetic ROI scenarios by randomly sampling all
   financial and hydrological inputs (tanker inflation 5–14%, Capex
   INR 2–9 lakh, rainfall 1200–3000 mm, etc.)
2. Run the break-even loop for every scenario
3. Train a Gradient Boosting Regressor to predict break-even year
   from scenario inputs (R² > 0.90 on 5-fold CV)
4. Apply SHAP to rank which inputs matter most

**Finding:** Tanker inflation rate is the dominant sensitivity variable.
A 2-percentage-point increase shifts the median break-even by
approximately 0.7–0.9 years. This tells committees that locking in
decisions while tanker prices are still moderate is financially optimal.

---

## 7. The Deep Learning Component

**Why it was added:** Academic requirement to evaluate a DL approach.

**What was built:** A Multi-Layer Perceptron (MLP) neural network
for the yield prediction task (predicting monthly yield from rooftop
area and rainfall features).

**Architecture:**
```
Input layer    (10 features)
Dense(64, ReLU) + Dropout(0.2)
Dense(32, ReLU) + Dropout(0.2)
Dense(16, ReLU)
Output Dense(1) — yield in KL
```
Trained with Adam optimiser, MSE loss, early stopping (patience=20).
Features standardised with StandardScaler fit on training data only.

**Dataset:** 1,080 samples — 10 rooftop sizes × 180 months.
Same temporal split as other models.

**Result:** MLP underperforms Random Forest.

| Model | MAE (KL) | R² |
|---|---|---|
| Random Forest | Lower | Higher |
| MLP Neural Net | Higher | Lower |

**Why this is a valid academic finding, not a failure:**
On small (1,080-sample) tabular datasets, ensemble methods like
Random Forest consistently outperform neural networks. The MLP needs
far more data to learn the same feature interactions that Random
Forest captures through ensemble averaging. Reporting this honestly
demonstrates understanding of when to use DL vs. classical ML —
which is more academically valuable than forcing DL to win.

---

## 8. The Financial Engine

### Historical Scenarios (P10 / P50 / P90)

Three real historical years are selected from the 2010–2025 data
representing dry (P10), typical (P50), and wet (P90) annual rainfall:

| Scenario | Year | Rainfall | Potential Yield | Usable Yield | Year-1 Savings |
|---|---|---|---|---|---|
| P10 (Dry) | 2018 | 1330.7 mm | 747.3 KL | 365.9 KL | INR 2,92,701 |
| P50 (Typical) | 2017 | 1983.6 mm | 1114.0 KL | 519.4 KL | INR 4,15,500 |
| P90 (Wet) | 2019 | 2395.9 mm | 1345.5 KL | 515.9 KL | INR 4,12,715 |

**Counter-intuitive finding:** P90 usable yield (515.9 KL) is *lower*
than P50 usable yield (519.4 KL) despite 412 mm more annual rainfall.
Reason: 2019 had extreme July–August bursts that far exceeded the
100 KL monthly demand cap, generating large overflow. 2017 distributed
rainfall more evenly across fringe monsoon months, maximising storage
utilisation. Static annual calculators miss this entirely.

### Demand-Gating

```
Usable yield = min(Potential yield, Monthly demand cap)
```

Overflow when yield exceeds demand does not contribute to financial
savings in a Storage-Only system. For Hybrid systems, overflow is
routed to borewell recharge, creating a second savings pathway.

### Monte Carlo ROI Simulation

1,000 yield scenarios are sampled from the P10–P90 monthly rainfall
distribution. Break-even is calculated for each. Output:
- *"Median break-even: Year 2"*
- *"91% probability of break-even by Year 4"*

This is a credible risk communication artifact for a non-technical
committee — honest, actionable, and grounded in 15 years of real data.

### AMC Correction

An earlier version of the code had `ANNUAL_OPEX_INR = 0`, which
accidentally excluded the 3% Annual Maintenance Contract from the
financial model. This has been corrected to `CAPEX × 0.03`.

---

## 9. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  VirtualMeter.jsx → MapStudio.jsx → ROIDashboard.jsx            │
│  WaterWalletContext (global state) → Axios API calls            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (JSON)
┌──────────────────────────▼──────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
│                                                                  │
│  /api/societies/baseline  → demand_engine.py (IS:1172)          │
│  /api/catchment/calculate → yield_engine.py  (physics)          │
│  /api/ml/yield            → RF yield model   (joblib)           │
│  /api/ml/recommend        → Tier1 gate + RF classifier (joblib) │
│  /api/roi/simulate        → roi_engine.py    (Monte Carlo)      │
│  /api/report/generate     → pdf_generator.py (WeasyPrint)       │
│                                                                  │
│  SQLAlchemy ORM → PostgreSQL                                     │
│  httpx (async) → Open-Meteo API                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      ML MODELS (joblib)                          │
│  waterwallet_yield_model.pkl      (Random Forest Regressor)     │
│  waterwallet_config_classifier.pkl(Random Forest Classifier)    │
│  waterwallet_label_encoder.pkl    (LabelEncoder)                │
│  thane_rain_percentiles.csv       (P10/P50/P90 per month)       │
└─────────────────────────────────────────────────────────────────┘
```

### State Flow (Frontend)

```
VirtualMeter → societyName, flats, occupants, totalSpend,
               billingMonths, annualDemand, siteParams
MapStudio    → estimatedCapex, annualYield, monthlyRainfall,
               polygonArea, coordinates
ROIDashboard ← reads ALL of above → runs ROI + ML → renders charts
```

---

## 10. Tech Stack Explained

### Frontend

| Technology | Role | Why chosen |
|---|---|---|
| React 19 + Vite | UI framework | Real-time state updates without page reload |
| React Context API | State management | Simpler than Redux for this scope |
| Tailwind CSS v4 | Styling | Fast, consistent, no class conflicts |
| React-Leaflet v5 | Interactive map | Free, no API key, satellite imagery |
| ESRI World Imagery | Satellite tiles | High resolution, free non-commercial |
| Turf.js v7 | Polygon area | Geodesic area calculation from GPS coords |
| Recharts v3 | Charts | Built for React, real-time re-renders |
| Axios | HTTP client | Clean API wrapper with interceptors |
| Service Worker | Offline caching | Map tiles cached for fast repeat loads |

### Backend

| Technology | Role | Why chosen |
|---|---|---|
| FastAPI | API framework | Async, auto-docs, Pydantic validation |
| Uvicorn (ASGI) | Web server | Handles concurrent requests asynchronously |
| Pydantic v2 | Input validation | Catches bad data before calculations run |
| SQLAlchemy v2 | ORM | Python objects instead of raw SQL |
| PostgreSQL | Database | Reliable, supports complex queries |
| Alembic | DB migrations | Schema changes without data loss |
| httpx | Async HTTP client | Calls Open-Meteo without blocking server |
| WeasyPrint | PDF generation | HTML → PDF server-side |
| Jinja2 | HTML templating | Fills society data into PDF template |
| joblib | Model persistence | Save/load trained ML models |

### ML / Data Science

| Technology | Role |
|---|---|
| scikit-learn | Random Forest, Decision Tree, cross-validation, metrics |
| pmdarima | Auto-ARIMA parameter selection by AIC |
| statsmodels | SARIMA model fitting |
| SHAP | Feature attribution (TreeSHAP) |
| TensorFlow / Keras | MLP neural network |
| pandas / numpy | Data manipulation |
| matplotlib / seaborn | Charts and visualisations |
| Open-Meteo API | Real historical rainfall (free, no key) |

---

## 11. Data Sources

| Data | Source | Real or Synthetic | Used for |
|---|---|---|---|
| Daily rainfall 2010–2025 | Open-Meteo Archive API | **Real** | Rainfall models, yield prediction, Monte Carlo |
| Groundwater levels | CGWB Thane district reports | **Real** | Validates recharge urgency |
| Soil classification (MMR) | NBSS&LUP soil map | **Real** | Soil permeability lookup for classifier |
| 24-month billing data | Thane society (field collection) | **Real** | Calibration, real case study validation |
| IS:1172 LPCD standard | Bureau of Indian Standards | **Real** | Demand calculation |
| CPHEEO UFW factor (15%) | CPHEEO Manual | **Real** | UFW toggle in Virtual Meter |
| MMR DSR rates | Maharashtra Govt. Schedule | **Real** | Parametric Capex estimation |
| Classifier training samples | Generated from engineering rules | **Synthetic (disclosed)** | Training the RF classifier |

---

## 12. Key Engineering Standards Used

| Standard | What it says | How we use it |
|---|---|---|
| **IS:1172:1993** | Urban residents need 135 litres per person per day | Baseline daily demand formula |
| **CPHEEO Manual** | 15% of water in distribution systems is unaccounted | UFW toggle in Virtual Meter |
| **Runoff coefficient** | Concrete rooftops deliver 90% of rainfall to collection | Yield formula multiplier |
| **BMC RWH Guidelines 2007** | RWH mandatory for buildings >500 m², configuration guidance | Classifier labeling rules |
| **CGWB coastal guidelines** | Minimum 2.5 km from coast for safe groundwater recharge | Tier 1 safety gate threshold |
| **NBSS&LUP soil classification** | Soil permeability classes 1–5 for MMR sub-districts | Feature input for classifier |
| **MMR DSR** | Cost per sq m for RWH civil work in Mumbai region | Capex estimation formula |

---

## 13. ML Models — Summary

| # | Model | Task | Type | Data | Key Result |
|---|---|---|---|---|---|
| 1 | Same-Month Baseline | Rainfall forecast | Statistical | Real (180 months) | MAE 72.75 mm — naive baseline |
| 2 | Auto-SARIMA | Rainfall forecast | Time series | Real (144 train, 48 test) | MAE 68.62 mm — **selected** |
| 3 | Random Forest (recursive) | Rainfall forecast | ML | Real | MAE 136.46 mm — worse than baseline |
| 4 | Random Forest Regressor | Yield prediction | ML | Real rainfall + physics | MAE 7.85 KL, R²=0.976 |
| 5 | MLP Neural Network | Yield prediction | Deep Learning | Same as above | Worse than RF — valid negative result |
| 6 | Decision Tree | Site configuration | ML baseline | 600 synthetic | CV 0.995 ± 0.007 |
| 7 | Random Forest Classifier | Site configuration | ML | 600 synthetic | CV 0.997 ± 0.003 — **selected** |
| 8 | SHAP (TreeSHAP) | Explainability | XAI | Applied to RF Classifier | Confirms physically coherent attribution |
| 9 | Gradient Boosting + SHAP | ROI sensitivity | ML | 10,000 synthetic scenarios | Tanker inflation = top break-even driver |
| 10 | Monte Carlo Simulation | Probabilistic ROI | Statistical | Real rainfall percentiles | P(break-even ≤ Yr 3) from 1,000 scenarios |

---

## 14. Key Results

### Rainfall Forecasting
- Auto-SARIMA: **MAE 68.62 mm** on 48-month holdout (2022–2025)
- Random Forest worse than naive baseline — confirms SARIMA is correct choice

### Site Configuration Classifier
- Random Forest: **5-fold CV 0.997 ± 0.003**
- Real Thane society: predicted **Hybrid with 96.0% confidence** — matches expert ✓

### Yield Prediction
- Random Forest: **MAE 7.85 KL, R² 0.976** — 87% better than Linear Regression

### Financial Projection (Thane pilot, 780 m² rooftop)
- P50 scenario Year-1 savings: **INR 4,15,500**
- P50 break-even: **Year 2**
- Probability of break-even by Year 4: from Monte Carlo simulation

### Counter-Intuitive Finding
- P90 (wet year) usable yield: 515.9 KL
- P50 (typical year) usable yield: 519.4 KL
- P90 usable yield is *lower* despite 412 mm more rain — due to overflow

---

## 15. What Makes This Different

| Problem | Existing Tools | WaterWallet |
|---|---|---|
| Scale | Built for municipal grids | Built for standalone apartments |
| Hardware | Require expensive IoT sensors | Zero hardware — billing data only |
| Configuration | Always recommend storage tank | Site-specific: Storage / Recharge / Hybrid |
| Financial output | Single break-even year | Probability distribution from Monte Carlo |
| Explainability | None | SHAP feature attribution in plain language |
| Safety | No checks | Tier 1 hard safety gate for coastal/soil risks |
| Rainfall | Static annual figure | Auto-SARIMA on 15 years of real data |
| DL evaluation | N/A | MLP evaluated, RF confirmed as better choice |

---

## 16. Honest Limitations

1. **Synthetic classifier training data** — The 600 training samples
   are generated from engineering rules, not real labeled observations.
   The model recovers those rules well, but real-world generalisation is
   validated on only one case study. Collecting 30–50 real MMR sites
   with expert-assessed configurations is the highest priority next step.

2. **Single real validation case** — One correct prediction is encouraging
   but not statistically sufficient for broad claims.

3. **Rainfall model geographic scope** — Auto-SARIMA is fitted for Thane
   coordinates only. Other MMR locations need their own fitted models.

4. **Recharge savings not yet in Monte Carlo** — The overflow-to-recharge
   benefit for Hybrid configurations is not yet integrated into the Monte
   Carlo financial simulation.

5. **Pre-consultation boundary** — WaterWallet is a feasibility and
   decision-support tool. It does not replace a licensed civil engineer
   for final implementation and does not produce construction drawings.

6. **Sewage proximity filter** — Cannot be implemented because BMC does
   not publish a free sewer network GIS dataset.

---

## 17. Future Scope

1. Collect real labeled site data from 30–50 MMR housing societies to
   replace synthetic classifier training data
2. Extend rainfall and yield models to 5–8 additional MMR coordinates
3. Integrate the borewell overflow-recharge savings pathway into the
   Monte Carlo ROI simulation
4. Add CGWB real-time groundwater level data via API
5. Deploy as a publicly accessible SaaS platform
6. Add borewell condition dropdown for the fourth Tier 1 safety check
7. Multi-city expansion beyond MMR

---

## 18. File Structure

```
waterwallet/
│
├── backend/
│   ├── main.py                    # FastAPI entry point + CORS
│   ├── config.py                  # Pydantic environment config
│   ├── database.py                # SQLAlchemy engine + session
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/                   # Database migrations
│   ├── models/
│   │   ├── constants.py           # IS_LPCD, UFW, SAFETY_CHECKLIST
│   │   ├── db_models.py           # SQLAlchemy table models
│   │   └── schemas.py             # Pydantic request/response schemas
│   ├── routers/
│   │   ├── societies.py           # POST /api/societies/baseline
│   │   ├── geospatial.py          # POST /api/catchment/calculate
│   │   ├── ml_yield.py            # POST /api/ml/yield
│   │   ├── ml_recommend.py        # POST /api/ml/recommend
│   │   ├── roi.py                 # POST /api/roi/simulate
│   │   └── report.py              # POST /api/report/generate
│   ├── services/
│   │   ├── demand_engine.py       # IS:1172 demand calculation
│   │   ├── yield_engine.py        # Physics yield formula
│   │   ├── rainfall_api.py        # Open-Meteo async client
│   │   ├── tier1_safety.py        # Hydrogeological safety gate
│   │   ├── roi_engine.py          # Monte Carlo ROI simulation
│   │   └── pdf_generator.py       # WeasyPrint report rendering
│   ├── ml_models/                 # Saved joblib model files
│   │   ├── waterwallet_yield_model.pkl
│   │   ├── waterwallet_config_classifier.pkl
│   │   ├── waterwallet_label_encoder.pkl
│   │   └── thane_rain_percentiles.csv
│   └── templates/                 # Jinja2 HTML for PDF
│
├── public/
│   └── sw.js                      # Service Worker (map tile caching)
│
└── src/                           # React frontend
    ├── App.jsx
    ├── main.jsx
    ├── api/
    │   └── waterwallet.js         # Axios API wrappers
    ├── utils/
    │   ├── waterConstants.js      # IS_LPCD, UFW, soil type map
    │   ├── mapPrefetch.js         # Tile prefetcher
    │   └── formatters.js          # INR currency formatter
    ├── context/
    │   └── WaterWalletContext.jsx # Global state provider
    ├── components/
    │   ├── Sidebar.jsx            # 3-step wizard navigation
    │   └── Topbar.jsx
    └── views/
        ├── VirtualMeter.jsx       # Step 1
        ├── MapStudio.jsx          # Step 2
        └── ROIDashboard.jsx       # Step 3

Colab Notebook:
  waterwallet_ml_updated.py        # All 24 ML cells
  ├── Cells 1–2   : Setup + Open-Meteo data fetch
  ├── Cells 3–7   : Rainfall model comparison (Baseline, SARIMA, RF)
  ├── Cells 8–9   : Yield engine + historical scenarios
  ├── Cell 10     : Monte Carlo ROI simulation
  ├── Cell 11     : ROI sensitivity (Gradient Boosting + SHAP)
  ├── Cell 12     : Tier 1 safety gate
  ├── Cells 13–14 : Synthetic site data + real case study
  ├── Cells 15–19 : EDA + Decision Tree + Random Forest + confusion matrix
  ├── Cells 20    : MLP neural network (DL component)
  ├── Cell 21     : SHAP explainability
  ├── Cell 22     : Three benchmarking tests
  ├── Cell 23     : Real case study validation
  └── Cell 24     : Final summary + dashboard chart
```

---

*WaterWallet — turning monsoon rain into financial proof.*
*VESIT Capstone 2025–26*
