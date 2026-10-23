# WaterWallet — Technical Reference

> Complete documentation of logic, formulas, algorithms, machine learning models, and API specifications across all application layers.  
> **Stack:** React 19 + Vite (frontend) · FastAPI + Python 3 + Scikit-Learn + SHAP (backend)

---

## Table of Contents

1. [Shared Constants & Canonical Formula](#shared-constants--canonical-formula)
2. [Phase 1 — Virtual Meter](#phase-1--virtual-meter)
3. [Phase 2 — Map Studio](#phase-2--map-studio)
4. [Phase 3 — ROI Dashboard](#phase-3--roi-dashboard)
5. [Machine Learning & Decision Support System](#machine-learning--decision-support-system)
   - [Dual-Tier Architecture](#dual-tier-architecture)
   - [Tier 1 — Hard Hydrogeological Safety Gate](#tier-1--hard-hydrogeological-safety-gate)
   - [Tier 2 — RF System Classifier & SHAP Explainability](#tier-2--rf-system-classifier--shap-explainability)
   - [RF Monthly Yield Regressor & Physics Fallback](#rf-monthly-yield-regressor--physics-fallback)
   - [1,000-Scenario Monte Carlo ROI Engine](#1000-scenario-monte-carlo-roi-engine)
6. [Backend API Layer & Endpoints](#backend-api-layer--endpoints)
7. [Pydantic Schemas & Data Validation](#pydantic-schemas--data-validation)
8. [Library Reference](#library-reference)
9. [Data Flow Diagram](#data-flow-diagram)

---

## Shared Constants & Canonical Formula

**File:** `src/utils/waterConstants.js` · **Mirror:** `backend/models/constants.py`

These constants are the single source of truth for every demand calculation across both frontend and backend.

| Constant | Value | Source / Rationale |
|---|---|---|
| `IS_LPCD` | `135 L/person/day` | IS 1172 — Code of Basic Requirements for Water Supply, residential with flush toilet + bath |
| `UFW_LOSS_FACTOR` | `0.15` (15%) | CPHEEO norms — Unaccounted-For Water: pipe leakage, metering error, unregistered connections |
| `DEMAND_BUFFER_FACTOR` | `1.10` (10%) | IS 1172 §4 — peak-hour surge and modelling uncertainty headroom |
| `RUNOFF_COEFFICIENT` | `0.90` | Unified RCC (reinforced concrete) roof runoff fraction (concrete default) |
| `USABILITY_FACTOR` | `0.80` | Roof area after deducting equipment, shading, service zones |
| `YIELD_FACTOR` | `0.90 × 0.80 = 0.72` | Combined: fraction of rainfall that becomes usable harvested water |
| `SEASONAL_WEIGHTS` | 12-element array | CPHEEO urban demand norms for peninsular India — relative monthly demand multipliers |

### Canonical Daily Demand Formula

Applied in strict sequence. **All three layers must be composed in this order.**

```
Step 1 — Base demand
  base = num_flats × occupants_per_flat × IS_LPCD

Step 2 — UFW distribution loss  [toggleable]
  afterUFW = base × (1 + UFW_LOSS_FACTOR)
           = base × 1.15

Step 3 — Peak-demand buffer     [always applied]
  adjustedDemand = afterUFW × DEMAND_BUFFER_FACTOR
                 = afterUFW × 1.10
```

**JavaScript implementation:** `calculateCanonicalDemand()` in `waterConstants.js`  
**Python implementation:** `calculate_demand()` in `backend/services/demand_engine.py`

> **Note:** The frontend and backend demand calculations are fully synchronized. The backend endpoint `POST /api/societies/baseline` returns `daily_demand_lpd` and `daily_demand_with_buffer_lpd` calculated with UFW losses and peak buffer matching the canonical formula. The annualised figure lives in the frontend context as `annualDemand`.

### Seasonal Demand Weights

```
Index:    0    1    2    3    4    5    6    7    8    9    10   11
Month:   Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
Weight: 0.90 0.90 1.10 1.20 1.20 0.90 0.80 0.80 0.90 1.00 0.95 0.95
```

Monthly demand is normalized dynamically:
```
monthlyDemand[i] = annualDemand × (SEASONAL_WEIGHTS[i] / Σ SEASONAL_WEIGHTS)
```
Sum of weights = 11.4. Normalization ensures monthly values always integrate back to `annualDemand`.

---

## Phase 1 — Virtual Meter

**File:** `src/views/VirtualMeter.jsx`  
**Purpose:** Capture society parameters, compute baseline water demand, and log historical billing data.

### Functionality

| Feature | Description |
|---|---|
| Society profiling | Name, number of flats, average occupants per flat |
| Live demand calculator | Recalculates instantly on every input change via `useMemo` |
| UFW toggle | ON/OFF switch adds 15% distribution loss to demand |
| Peak-buffer | Always-on 10% headroom, applied last |
| Historical billing log | Editable table: month, year, municipal bill, tanker count, cost/tanker, tanker capacity |
| Tanker volume tracking | `tankers × tankerCapacity` aggregated per row, total shown in kL |
| Context sync | `useEffect` pushes all computed totals to `WaterWalletContext` on every change |

### Demand Calculation (Live, in-browser)

```javascript
// Delegates to calculateCanonicalDemand() from waterConstants.js
const { baseDemand, adjustedDemand } = calculateCanonicalDemand({
  numFlats, occupantsPerFlat, lpcd: IS_LPCD, includeLosses,
});
```

**Manual test case** (50 flats, 4 occ, UFW on):
```
base          = 50 × 4 × 135           = 27,000 L/day
afterUFW      = 27,000 × 1.15          = 31,050 L/day
adjustedDemand = 31,050 × 1.10         = 34,155 L/day  ✓
annualDemand  = 34,155 × 365           = 12,466,575 L/year
```

### Billing Aggregation

```javascript
totalTankerSpend = Σ (row.tankers × row.costPerTanker)
totalMunicipal   = Σ row.bill
totalTankerVolume = Σ (row.tankers × row.tankerCapacity)   // in litres
avgMonthly       = (totalTankerSpend + totalMunicipal) / billingRows.length
```

### Context Outputs (pushed to `WaterWalletContext`)

| Field | Description |
|---|---|
| `societyName` | String label for reports |
| `flats` | Number of residential units |
| `occupants` | Average occupants per flat |
| `totalTankerSpend` | Total ₹ spent on private tankers across all logged months |
| `totalMunicipal` | Total ₹ in municipal bills across all logged months |
| `billingMonths` | Number of rows in the billing log |
| `annualDemand` | `adjustedDemand × 365` in litres — canonical annual demand |

### State Management

- Component-local state: `flats`, `occupants`, `amenities`, `includeLosses`, `smartMeters`, `billingRows`
- All billing row mutations use immutable array patterns (`map`, `filter`) via `updateRow` / `deleteRow`
- Row IDs use a `useRef` counter (prevents stale closures across re-renders)

---

## Phase 2 — Map Studio

**File:** `src/views/MapStudio.jsx`  
**Purpose:** Satellite map polygon tracer — user draws rooftop boundary to derive catchment area, harvestable yield, and project capex.

### Functionality

| Feature | Description |
|---|---|
| Interactive satellite map | Esri World Imagery tile layer, zoom 18, centered on Thane |
| Click-to-trace polygon | Each map click adds a vertex; ≥3 points forms a closeable polygon |
| Live area calculation | Turf.js computes geodesic polygon area in m² on every vertex change |
| Usable area deduction | 20% obstacle factor applied to gross traced area |
| Yield calculation | `usableArea × annualRainfall × runoffCoeff` |
| Parametric capex | `usableArea × ₹600/m²` (MMR DSR rate) |
| Live rainfall fetch | Open-Meteo archive API: daily precipitation for the traced centroid over the rolling 15 complete calendar years |
| Rainfall forecast | Auto-SARIMA (`pmdarima`, seasonal period 12) forecasts the next 12 months; response metadata identifies the rainfall-history source |
| 15-year rainfall averaging | Daily data aggregated to monthly, then averaged across all 15 years |
| Fallback data | Monthly catchment responses identify the regional climatology fallback; forecast responses identify synthetic regional history |
| Monsoon dependency score | % of annual yield that falls in Jun–Sep (JJAS monsoon) |
| Seasonal chart | Bar chart of monthly rainfall (mm) + line chart of monthly demand (kL) |

### Geospatial Area Calculation

```javascript
// Points stored as [lat, lng] pairs — must be converted to [lng, lat] for GeoJSON
const turfCoords = points.map(([lat, lng]) => [lng, lat]);
turfCoords.push(turfCoords[0]);           // close the ring
const area = turf.area(turf.polygon([turfCoords]));   // m², geodesic (WGS84)
```

### Yield & Capex Formulas

```
usableArea     = tracedArea × OBSTACLE_FACTOR
               = tracedArea × 0.80

maxYield (L/yr) = usableArea × annualRainfall_mm × RUNOFF_COEFF
               = usableArea × annualRainfall × 0.90
  [Note: 1 mm rain on 1 m² = 1 litre — unit identity]

estimatedCapex (₹) = usableArea × CAPEX_RATE_PER_SQM
                   = usableArea × 600
```

**Constants used in MapStudio (imported from waterConstants.js):**

| Constant | Value | Note |
|---|---|---|
| `OBSTACLE_FACTOR` | `0.80` | Same as backend `USABILITY_FACTOR` |
| `ROOF_RUNOFF_COEFFICIENTS` | `concrete: 0.90, metal: 0.90, gravel: 0.45, tiles: 0.75` | Dynamic runoff coefficient by surface type |
| `CAPEX_RATE_PER_SQM` | `₹600` | MMR parametric DSR rate |

### Rainfall API Integration

**Endpoint:** `https://archive-api.open-meteo.com/v1/archive`  
**Parameters:** traced centroid latitude/longitude, rolling 15 complete calendar years, `daily=precipitation_sum`

```javascript
// Aggregate to monthly totals per year, then average across years
const yearMonthTotals = {};
times.forEach((dateStr, i) => {
  const yr  = dateStr.slice(0, 4);
  const mon = parseInt(dateStr.slice(5, 7), 10) - 1;   // 0-indexed
  yearMonthTotals[yr][mon] += (precip[i] || 0);
});
avgMonthly[m] = Σ yearMonthTotals[yr][m]  /  numYears;
```

**Fallback (IITM Thane normals, mm/month):**
```
[1, 1, 2, 18, 110, 510, 710, 580, 300, 95, 18, 2]   → Total: 2,347 mm/yr
```

### Monsoon Dependency Score

```
monsoonPct = (Σ monthlyMm[5,6,7,8] / Σ monthlyMm[0..11]) × 100
```
- Monsoon months: June (idx 5), July (6), August (7), September (8)
- Score ≥ 80% → amber warning (tank sizing is critical)
- Score < 80% → green (well-distributed yield)

### Context Outputs (pushed to `WaterWalletContext`)

| Field | Value |
|---|---|
| `estimatedCapex` | `usableArea × 600` in ₹ |
| `annualYield` | `maxYield` in litres/year |
| `monthlyRainfall` | 12-element array of avg monthly mm |
| `annualDemand` | Re-synced from `flats × occupants × 135 × 365` |

---

## Phase 3 — ROI Dashboard

**File:** `src/views/ROIDashboard.jsx`  
**Purpose:** 10-year what-if scenario comparator — models cost of doing nothing vs. investing in RWH under three tanker inflation trajectories.

### Functionality

| Feature | Description |
|---|---|
| Three-scenario matrix | Conservative (6%), Current (8%), High-Risk (12%) tanker inflation rates |
| Cumulative cost curves | Year-by-year cost of doing nothing vs. cost with RWH, plotted as line + area chart |
| Break-even detection | First year where `cumulativeRWH < cumulativeDoNothing`, per scenario |
| Break-even reference lines | Vertical dashed lines on chart at each scenario's break-even year |
| KPI summary cards | 10-year bleed range, RWH project budget, break-even range |
| Capex sensitivity slider | ₹400–₹800/m² range; recalculates capex and all scenarios live |
| Self-sufficiency badge | Rooftop yield as % of annual demand; teal ≥50%, amber <50% |
| PDF report | Opens browser print dialog with a fully self-contained HTML report |

### ROI Engine (pure function, no API call)

```javascript
function runScenario({ annualTanker, annualMunicipal, capex, gamma }) {
  const municipalInflation = 0.05;   // 5% per year — fixed
  const rwhAmc             = 0.03;   // 3% of capex per year — annual maintenance cost

  for year 1 → 10:
    thisYearTanker    = annualTanker    × (1 + gamma)^(year-1)
    thisYearMunicipal = annualMunicipal × (1 + municipalInflation)^(year-1)
    thisYearRwhMaint  = capex × rwhAmc

    cumulativeDoNothing += (thisYearTanker + thisYearMunicipal)

    ### Daily Tank Sizer

    `POST /api/roi/tank-sizer` fetches Open-Meteo daily precipitation for the rolling 15 complete calendar years
    and simulates each complete calendar year independently for every candidate tank
    capacity. The request must provide the traced gross roof area, coordinates, roof
    surface type, and eligible daily non-potable demand. The service applies the
    existing `0.80` obstacle/usability factor exactly once.

    The dashboard's planning default uses **65 litres per person per day (LPCD)**
    for non-potable demand, the midpoint of the 60–70 LPCD source range. It displays
    the resulting daily demand beside reliability so the denominator is auditable;
    this remains a planning assumption until society-specific flushing and gardening
    measurements are entered.

    The accounting is intentionally separated:

    - **Useful water** is water consumed by demand from the tank and is the only
      volume used to calculate tanker savings.
    - **Recharge overflow** is reported as an environmental/regulatory benefit when
      recharge is enabled; it never increases rupee savings.
    - **Lost overflow** is reported as a design inefficiency when recharge is not
      enabled.

    If Open-Meteo does not return complete daily years, the endpoint returns an
    explicit unavailable error. It never fabricates daily rainfall values or silently
    falls back to monthly averages.

    The candidate list includes a zero-litre "do nothing" baseline. A zero-capacity
    candidate cannot serve demand, so it receives zero useful water, zero reliability,
    zero financial savings, and no payback. Leap years (2012, 2016, 2020, and 2024)
    are simulated over 366 daily records; reliability uses the actual record length.
    cumulativeRWH       += (thisYearMunicipal + thisYearRwhMaint)
    // Note: RWH path still pays municipal bills (partial supply supplement)
    // capex is baked into cumulativeRWH at year 0 as starting value

  breakEven = first year where cumulativeRWH < cumulativeDoNothing
}
```

**Scenario parameters:**

| Scenario | Tanker inflation `γ` | Line color |
|---|---|---|
| Conservative | 6% / year | Amber `#f59e0b` |
| Current | 8% / year | Red `#dc2626` |
| High-Risk | 12% / year | Purple `#7c3aed` |

All three scenarios share the same `cumulativeRWH` curve — the RWH cost path is independent of tanker inflation.

### Input Annualisation

Billing data from Phase 1 is converted to ₹ Lakhs/year for the chart:

```javascript
months          = billingMonths || 1
annualTanker    = ((totalTankerSpend / months) × 12) / 100000   [₹ Lakhs]
annualMunicipal = ((totalMunicipal   / months) × 12) / 100000   [₹ Lakhs]
capex           = adjustedCapex / 100000                         [₹ Lakhs]
```

When billing data is absent, zero is preserved for tanker and municipal spend.
The municipal tariff falls back explicitly to ₹15/kL only when a valid municipal
volume and bill are unavailable.

### Capex Sensitivity Slider

```javascript
tracedAreaProxy = estimatedCapex / 600        // reverse-derives usable area from stored capex
adjustedCapex   = tracedAreaProxy × capexRatePerSqm   // recomputes at slider rate
```

Slider range: ₹400–₹800/m², step ₹50. Default: ₹600/m² (MMR DSR).

### Self-Sufficiency Badge

```javascript
pct = Math.min(100, Math.round((annualYield / annualDemand) × 100))
// annualYield  — from Map Studio (litres/year)
// annualDemand — from Virtual Meter via context (litres/year)
isGood = pct >= 50
```

### PDF Report Generation

The "Download PDF Report" button uses the browser's native print-to-PDF:
1. Builds a fully self-contained HTML string (inline CSS, no external deps)
2. Opens `window.open('', '_blank')`
3. Writes the HTML into the new tab
4. Calls `window.print()` after 400 ms delay (allows browser to render)

Content included: society header, financial KPI summary, break-even table (3 scenarios), self-sufficiency data, 10-year year-by-year projection table.

> The backend `POST /api/report/generate` endpoint currently returns **HTTP 501** — WeasyPrint requires GTK3 system libraries not yet installed. The in-browser print path above is the active report feature.

---

## Machine Learning & Decision Support System

**Files:** `backend/services/tier1_safety.py`, `backend/services/ml_engine.py`, `backend/services/monte_carlo.py`, `backend/ml_models/train_models.py`

### Dual-Tier Architecture

WaterWallet implements a physics-informed dual-tier decision engine for recommending RWH configurations:

```
                      ┌────────────────────────────────────────┐
                      │        Input Site Parameters           │
                      │ coastal_km, soil_perm, borewell, depth │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    Tier 1: Hard Safety Gate            │
                      │    (Hydrogeological Rules Check)       │
                      └───────────┬────────────────┬───────────┘
                                  │                │
                        Violated  │                │ Passed
                                  ▼                ▼
                 ┌──────────────────────┐  ┌──────────────────────┐
                 │ Force "Storage-Only" │  │ Tier 2: RF Classifier│
                 │ confidence = 1.0     │  │ + SHAP Explainability│
                 └──────────────────────┘  └──────────────────────┘
```

### Tier 1 — Hard Hydrogeological Safety Gate

**File:** `backend/services/tier1_safety.py`

Safety rules take absolute precedence over machine learning model probabilities. If physical or geological constraints render groundwater recharge unsafe or impossible, Tier 1 forces a **Storage-Only** recommendation with `confidence = 1.0` and `safety_triggered = True`.

| Rule ID | Hydrogeological Condition | Action | Rationale & Reference |
|---|---|---|---|
| `RULE_1` | `coastal_km ≤ 2.5 km` | Force `Storage-Only` | CGWB / BMC guideline: Artificial recharge near coastline causes seawater intrusion into coastal aquifers. |
| `RULE_2` | `soil_perm == 1 AND borewell == 0` | Force `Storage-Only` | Class 1 soil (clay/hard rock) lacks permeability. Without an injection borewell, surface recharge is physically infeasible. |
| `RULE_3` | `borewell == 1 AND borewell_depth < 30 m` | Force `Storage-Only` | Shallow borewells (<30 m) inject runoff into unconfined topsoil aquifers, risking contamination. Minimum 30 m depth required. |

### Tier 2 — RF System Classifier & SHAP Explainability

**File:** `backend/services/ml_engine.py`  
**Trained Model:** `waterwallet_config_classifier.pkl` (Random Forest Classifier)

When Tier 1 passes, the payload is evaluated by a Random Forest Classifier trained on hydrogeological survey datasets.

**Input Features (7):**
1. `rooftop_area` (m²)
2. `borewell` (0 or 1)
3. `borewell_depth` (m)
4. `soil_perm` (Class 1–5)
5. `coastal_km` (km)
6. `annual_rain_mm` (mm)
7. `peak_day_mm` (mm)

**Target Configurations:**
- `Storage-Only`
- `Borewell-Recharge`
- `Hybrid`

**SHAP Attribution & Plain Language Generation:**
- Generates feature contribution weights using `shap.TreeExplainer`.
- Evaluates class probability distribution and outputs positive driver features.
- Constructs an intuitive, plain-English summary (e.g., *"Hybrid recommended because rooftop area (960 m²), borewell depth (45 m), and coastal distance (6 km) support this configuration."*).

### RF Monthly Yield Regressor & Physics Fallback

**File:** `backend/services/ml_engine.py`  
**Trained Model:** `waterwallet_yield_model.pkl` (Random Forest Regressor)

Predicts monthly harvestable yield (KL) by incorporating rainfall dynamics, seasonality, and precipitation lags.

**Input Features (10):**
`rooftop_area`, `month`, `rain_mm`, `annual_rain_mm`, `peak_day`, `lag1_rain`, `lag2_rain`, `lag3_rain`, `sin_month`, `cos_month`

**Physics Fallback Mechanism:**
If `waterwallet_yield_model.pkl` is absent or uninitialized, the engine automatically falls back to the deterministic runoff equation:

$$\text{Yield (KL)} = \frac{\text{rooftop\_area} \times \text{rain\_mm} \times \text{usability\_factor} \times \text{runoff\_coeff}}{1000}$$

Where defaults are `usability_factor = 0.80` and `runoff_coeff = 0.90`. Response header sets `source: "physics_formula"`.

### 1,000-Scenario Monte Carlo ROI Engine

**File:** `backend/services/monte_carlo.py`

Replaces static payback estimates with probabilistic risk modeling.

1. **Sampling:** Performs $N = 1,000$ iterations by uniformly sampling monthly rainfall between historical $P_{10}$ and $P_{90}$ monthly precipitation distributions derived from Thane climatological archives (`thane_rain_percentiles.csv`).
2. **Yield & Demand Gating:** Computes monthly yield per sample and applies a hard monthly demand cap:
   $$\text{Usable Yield}_m = \min(\text{Yield}_m, \text{Demand}_m)$$
3. **Financial Escalation:** Simulates 10-year cash flows applying compound annual tanker inflation ($\gamma = 8\%$) vs. fixed maintenance costs ($\text{AMC} = 3\% \text{ of Capex}$).
4. **Output Metrics:** Returns cumulative break-even probability distributions across Years 1–10 (e.g., *"72% chance of break-even by Year 3, 91% by Year 4"*), median break-even year, $P_{10}/P_{50}/P_{90}$ percentiles, and risk percentage of never breaking even within 10 years.

---

## Backend API Layer & Endpoints

**Framework:** FastAPI 0.115+  
**Entry Point:** `backend/main.py`  
**Base URL:** `http://localhost:8000`

### Endpoints Overview

| Method | Path | Description | Router Tag |
|---|---|---|---|
| `GET` | `/` | Service health check | Root |
| `POST` | `/api/societies/baseline` | IS 1172 canonical daily demand calculation | Societies |
| `POST` | `/api/societies` | Save new society profile (DB CRUD) | Societies |
| `GET` | `/api/societies/{id}` | Fetch society details & billing history | Societies |
| `POST` | `/api/societies/{id}/billing` | Add billing entry row (DB CRUD) | Societies |
| `POST` | `/api/catchment/calculate` | Open-Meteo historical rainfall + yield | Geospatial |
| `POST` | `/api/catchment/forecast` | Auto-SARIMA 12-month rainfall forecast + yield | Geospatial |
| `POST` | `/api/roi/simulate` | Deterministic 10-year ROI simulation | ROI |
| `POST` | `/api/roi/monte-carlo` | 1,000-scenario Monte Carlo ROI simulation | ROI |
| `POST` | `/api/ml/recommend` | Dual-tier RWH config recommendation + SHAP | ML — Recommend |
| `POST` | `/api/ml/yield` | Random Forest monthly yield prediction | ML — Yield |
| `POST` | `/api/report/generate` | Server-side PDF report generator (HTTP 501) | Report |

---

### Detailed Endpoint Specifications

#### `POST /api/societies/baseline`
Calculates IS 1172 daily water demand with optional distribution losses and peak buffer.

**Request Payload:**
```json
{
  "num_flats": 50,
  "occupants_per_flat": 4.0,
  "lpcd_override": null,
  "include_losses": true
}
```

**Response:**
```json
{
  "total_occupants": 200,
  "base_demand_lpd": 27000.0,
  "daily_demand_lpd": 31050.0,
  "daily_demand_with_buffer_lpd": 34155.0
}
```

---

#### `POST /api/catchment/calculate`
Fetches historical precipitation from Open-Meteo API and calculates annual & monthly harvestable yield.

**Request Payload:**
```json
{
  "latitude": 19.2183,
  "longitude": 72.9781,
  "roof_area_sqm": 960.0,
  "roof_surface_type": "concrete"
}
```

#### `POST /api/catchment/forecast`
Fetches chronological monthly rainfall totals from Open-Meteo, selects a seasonal
ARIMA configuration using AIC through `pmdarima.auto_arima`, and forecasts the
next 12 months. The forecasted rainfall is converted to rooftop yield using the
same runoff and usability factors as the historical catchment endpoint.

If Auto-SARIMA is unavailable or cannot fit the series, the frontend retains the
historical-average result from `/api/catchment/calculate`.

**Response:**
```json
{
  "annual_rainfall_mm": 2347.0,
  "monthly_rainfall_mm": [1.0, 1.0, 2.0, 18.0, 110.0, 510.0, 710.0, 580.0, 300.0, 95.0, 18.0, 2.0],
  "annual_yield_litres": 1617840.0,
  "monthly_yield_litres": [691.2, 691.2, 1382.4, 12441.6, 75924.0, 351864.0, 489888.0, 399936.0, 207360.0, 65520.0, 12441.6, 1382.4]
}
```

---

#### `POST /api/roi/simulate`
Executes a deterministic multi-year payback analysis.

**Request Payload:**
```json
{
  "daily_demand_lpd": 34155.0,
  "annual_yield_litres": 1617840.0,
  "tank_capacity_litres": 50000,
  "water_tariff_per_kl": 15.0,
  "installation_cost": 250000.0,
  "years": 10,
  "tariff_escalation_rate": 0.05
}
```

**Response:**
```json
{
  "payback_years": 9.8,
  "total_period_savings": 255000.0,
  "ten_year_savings": 255000.0,
  "yearly_breakdown": [
    { "year": 1, "savings": 25500.0, "cumulative_savings": 25500.0, "net_benefit": -224500.0 }
  ]
}
```

---

#### `POST /api/roi/monte-carlo`
Runs 1,000 stochastic simulations sampling rainfall between $P_{10}$ and $P_{90}$ percentiles.

**Request Payload:**
```json
{
  "rooftop_area_m2": 960.0,
  "monthly_demand_kl": 1000.0,
  "capex_inr": 480000.0,
  "tanker_rate_per_kl": 800.0,
  "inflation_rate": 0.08,
  "n_scenarios": 1000
}
```

**Response:**
```json
{
  "median_breakeven_year": 3,
  "mean_breakeven_year": 3.12,
  "prob_breakeven_by_year": {
    "1": 0.02,
    "2": 0.45,
    "3": 0.72,
    "4": 0.91,
    "5": 0.98,
    "6": 1.0,
    "7": 1.0,
    "8": 1.0,
    "9": 1.0,
    "10": 1.0
  },
  "percentiles": { "p10": 2, "p50": 3, "p90": 4 },
  "n_scenarios": 1000,
  "never_break_even_pct": 0.0,
  "scenarios_used": "percentile_table"
}
```

---

#### `POST /api/ml/recommend`
Evaluates physical safety constraints (Tier 1) followed by RF Classifier inference with SHAP explanations (Tier 2).

**Request Payload:**
```json
{
  "rooftop_area": 960.0,
  "borewell": 1,
  "borewell_depth": 45.0,
  "soil_perm": 3,
  "coastal_km": 6.5,
  "annual_rain_mm": 2347.0,
  "peak_day_mm": 180.0
}
```

**Response (Tier 2 ML path):**
```json
{
  "config": "Hybrid",
  "confidence": 0.96,
  "source": "rf_classifier",
  "safety_triggered": false,
  "safety_reason": null,
  "shap_values": [
    { "feature": "rooftop_area", "value": 960.0, "shap": 0.3214 },
    { "feature": "borewell_depth", "value": 45.0, "shap": 0.2105 }
  ],
  "plain_language": "Hybrid recommended because rooftop area (960 m²), borewell depth (45 m), and coastal distance (7 km) support this configuration."
}
```

**Response (Tier 1 Safety Gate Triggered path):**
```json
{
  "config": "Storage-Only",
  "confidence": 1.0,
  "source": "tier1_safety_gate",
  "safety_triggered": true,
  "safety_reason": "Site is only 1.8 km from the coast. CGWB guidelines require a minimum of 2.5 km from the coastline before groundwater recharge is safe. Recharge at this location risks seawater intrusion into aquifers.",
  "shap_values": [],
  "plain_language": "Site is only 1.8 km from the coast. CGWB guidelines require a minimum of 2.5 km from the coastline before groundwater recharge is safe. Recharge at this location risks seawater intrusion into aquifers."
}
```

---

#### `POST /api/ml/yield`
Predicts monthly yield using Random Forest Regressor, with physics fallback.

**Request Payload:**
```json
{
  "rooftop_area_m2": 960.0,
  "monthly_rainfall_mm": [1.0, 1.0, 2.0, 18.0, 110.0, 510.0, 710.0, 580.0, 300.0, 95.0, 18.0, 2.0]
}
```

**Response:**
```json
{
  "monthly_yield_kl": [0.691, 0.691, 1.382, 12.442, 75.924, 351.864, 489.888, 399.936, 207.36, 65.52, 12.442, 1.382],
  "annual_yield_kl": 1619.532,
  "source": "rf_regressor"
}
```

---

## Pydantic Schemas & Data Validation

**File:** `backend/models/schemas.py`

Key Pydantic models enforcing structural, numeric, and domain-level integrity:

| Schema Name | Role | Critical Validation Constraints |
|---|---|---|
| `SocietyBaselineRequest` | Demand payload | `num_flats > 0`, `occupants_per_flat > 0`, `lpcd_override ≤ 1000` |
| `CatchmentRequest` | Geospatial payload | `latitude ∈ [-90, 90]`, `longitude ∈ [-180, 180]`, `roof_area_sqm > 0` |
| `ROIRequest` | Simulation payload | `water_tariff_per_kl > 0` (custom `@field_validator` prevents zero-division) |
| `MonteCarloRequest` | Stochastic ROI payload | `n_scenarios ∈ [100, 5000]`, `inflation_rate ∈ [0, 0.5]` |
| `MLRecommendRequest` | ML System payload | `borewell ∈ [0, 1]`, `soil_perm ∈ [1, 5]`, `coastal_km > 0` |
| `MLYieldRequest` | ML Yield payload | `monthly_rainfall_mm` length enforced strictly to 12 elements |
| `SHAPValue` | Feature attribution | Captures `feature`, input `value`, and `shap` contribution score |

---

## Library Reference

### Frontend Dependencies (`package.json`)

| Library | Version | Role |
|---|---|---|
| `react` | ^19.2 | Core UI component framework |
| `react-dom` | ^19.2 | DOM renderer |
| `react-router-dom` | ^7.14 | Client-side SPA routing (`BrowserRouter`, `Routes`) |
| `react-leaflet` | ^5.0 | React components for Leaflet maps |
| `leaflet` | ^1.9.4 | Mapping tile renderer & vector polygon tracer |
| `@turf/turf` | ^7.3.4 | Geospatial measurement (geodesic WGS84 area calculation) |
| `recharts` | ^3.8 | SVG charting engine (Composed line/bar, area charts) |
| `lucide-react` | ^1.6 | Visual icon set |

### Frontend Dev Dependencies

| Library | Role |
|---|---|
| `vite` | Next-gen frontend toolchain & dev server |
| `@vitejs/plugin-react` | Fast Refresh JSX plugin |
| `tailwindcss` | Utility-first styling engine (v4) |
| `@tailwindcss/vite` | Tailwind CSS v4 Vite integration |
| `eslint` | Code quality and React Hooks linter |

### Backend Dependencies (`backend/requirements.txt`)

| Library | Version | Role |
|---|---|---|
| `fastapi` | ≥0.115.0 | Modern high-performance ASGI API framework |
| `uvicorn[standard]` | ≥0.30.0 | High-performance ASGI server |
| `pydantic` | ≥2.10.0 | Data parsing, type coercion, and validation |
| `scikit-learn` | ≥1.4.0 | Machine learning model training & inference (`RandomForest`) |
| `shap` | ≥0.44.0 | TreeExplainer model interpretability & feature attributions |
| `joblib` | ≥1.3.0 | Model serialization (`.pkl` loading) |
| `numpy` | ≥1.26.0 | Array manipulation & numerical calculations |
| `pandas` | ≥2.2.0 | Tabular data processing for ML feature pipelines |
| `httpx` | ≥0.27.0 | Async HTTP client for Open-Meteo rainfall API |
| `jinja2` | ≥3.1.4 | Templating engine for PDF reports |
| `sqlalchemy` | ≥2.0.0 | ORM database interface |
| `alembic` | ≥1.13.0 | Relational database schema migrations |
| `weasyprint` | ≥61.2 | HTML-to-PDF compiler (requires GTK3 runtime) |

---

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 WaterWalletContext                                     │
│  societyName · flats · occupants · totalTankerSpend · totalMunicipal · billingMonths   │
│  annualDemand · estimatedCapex · annualYield · monthlyRainfall · capexRatePerSqm       │
└───────────────┬───────────────────────────────┬───────────────────────────────┬────────┘
                │ writes                        │ reads                         │ reads
                ▼                               ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
│ Phase 1 — Virtual Meter       │ │ Phase 2 — Map Studio          │ │ Phase 3 — ROI Dashboard       │
│                               │ │                               │ │                               │
│ calculateCanonicalDemand()    │ │ Open-Meteo API (10-yr rainfall)│ │ runScenario() (3 cost paths)  │
│ → base, adjusted demand       │ │ Leaflet rooftop polygon trace │ │ Break-even detection          │
│ → billing aggregation         │ │ Turf.js geodesic m² area      │ │ Self-sufficiency ratio        │
│ → syncs annualDemand          │ │ → syncs capex, yield, rain    │ │ In-browser PDF report printer │
└───────────────────────────────┘ └───────────────────────────────┘ └───────────────────────────────┘
                │                               │                               │
                └───────────────────────────────┼───────────────────────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FastAPI Backend API Layer                                │
│                                                                                        │
│  POST /api/societies/baseline   ➜ IS 1172 demand engine (demand_engine.py)             │
│  POST /api/catchment/calculate  ➜ Open-Meteo API & yield calculation (yield_engine.py) │
│  POST /api/roi/simulate         ➜ Deterministic multi-year payback (roi_engine.py)     │
│  POST /api/roi/monte-carlo      ➜ 1,000-scenario stochastic ROI (monte_carlo.py)       │
│  POST /api/ml/recommend         ➜ Tier 1 Hydrogeology Gate (tier1_safety.py)            │
│                                   ➜ Tier 2 RF Classifier + SHAP (ml_engine.py)          │
│  POST /api/ml/yield             ➜ RF Regressor monthly yield prediction (ml_engine.py) │
│  POST /api/report/generate      ➜ HTTP 501 (WeasyPrint GTK3 pending)                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

*Updated: 2026-09-02 · WaterWallet v2.0 · Physics-Informed ML & Decision Support System*
