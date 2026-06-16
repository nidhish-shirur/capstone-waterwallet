# WaterWallet — Technical Reference

> Complete documentation of logic, formulas, and libraries for all three phases.  
> **Stack:** React 19 + Vite (frontend) · FastAPI + Python 3 (backend)

---

## Table of Contents

1. [Shared Constants & Canonical Formula](#shared-constants--canonical-formula)
2. [Phase 1 — Virtual Meter](#phase-1--virtual-meter)
3. [Phase 2 — Map Studio](#phase-2--map-studio)
4. [Phase 3 — ROI Dashboard](#phase-3--roi-dashboard)
5. [Backend API Layer](#backend-api-layer)
6. [Library Reference](#library-reference)
7. [Data Flow Diagram](#data-flow-diagram)

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

Applied in strict sequence. **All four layers must be composed in this order.**

```
Step 1 — Base demand
  base = num_flats × occupants_per_flat × IS_LPCD

Step 2 — Amenity load
  afterAmenities = base × (1 + Σ amenity_multipliers)
    Garden/Landscaping : +12%
    Daily Car Washing  : +8%
    Swimming Pool      : +20%

Step 3 — UFW distribution loss  [toggleable]
  afterUFW = afterAmenities × (1 + UFW_LOSS_FACTOR)
           = afterAmenities × 1.15

Step 4 — Peak-demand buffer     [always applied]
  adjustedDemand = afterUFW × DEMAND_BUFFER_FACTOR
                 = afterUFW × 1.10
```

**JavaScript implementation:** `calculateCanonicalDemand()` in `waterConstants.js`  
**Python implementation:** `calculate_demand()` in `backend/services/demand_engine.py`

> **Note:** The backend currently applies only Steps 1 and 4 (base + buffer). Steps 2 and 3 are frontend-only adjustments. The backend endpoint `POST /api/societies/baseline` returns `daily_demand_lpd` (Step 1) and `daily_demand_with_buffer_lpd` (Step 4). The full composed figure (all 4 steps) lives in the frontend context as `annualDemand`.

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
| Amenity toggles | Three checkboxes add percentage multipliers to base demand |
| UFW toggle | ON/OFF switch adds 15% distribution loss to demand |
| Peak-buffer | Always-on 10% headroom, applied last |
| Historical billing log | Editable table: month, year, municipal bill, tanker count, cost/tanker, tanker capacity |
| Tanker volume tracking | `tankers × tankerCapacity` aggregated per row, total shown in kL |
| Context sync | `useEffect` pushes all computed totals to `WaterWalletContext` on every change |

### Demand Calculation (Live, in-browser)

```javascript
// Delegates to calculateCanonicalDemand() from waterConstants.js
const amenityMultiplier = sum of active option.multiplier values;

{ baseDemand, afterAmenities, adjustedDemand } = calculateCanonicalDemand({
  numFlats, occupantsPerFlat, lpcd: IS_LPCD,
  amenityMultiplier, includeLosses,
});
```

**Manual test case** (50 flats, 4 occ, UFW on, no amenities):
```
base          = 50 × 4 × 135           = 27,000 L/day
afterAmenities = 27,000 × 1.00         = 27,000 L/day
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
| Live rainfall fetch | Open-Meteo archive API: 10-year daily precipitation for Thane (2015–2024) |
| 10-year rainfall averaging | Daily data aggregated to monthly, then averaged across all 10 years |
| Fallback data | IITM climatological normals for Thane if API fails |
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
**Parameters:** `latitude=19.2183`, `longitude=72.9781`, `start_date=2015-01-01`, `end_date=2024-12-31`, `daily=precipitation_sum`

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

**Fallback values** (when no billing data entered):
```
annualTanker    → 2.0 L    (₹2,00,000/year)
annualMunicipal → 0.46 L   (₹46,000/year)
capex           → 4.8 L    (₹4,80,000)
```

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

## Backend API Layer

**Framework:** FastAPI 0.115+  
**Entry point:** `backend/main.py`  
**Base URL:** `http://localhost:8000`

### Endpoints

#### `POST /api/societies/baseline`
Calculates IS 1172 daily water demand.

**Request:**
```json
{
  "num_flats": 50,
  "occupants_per_flat": 4.0,
  "lpcd_override": null
}
```

**Response:**
```json
{
  "total_occupants": 200,
  "daily_demand_lpd": 27000.0,
  "daily_demand_with_buffer_lpd": 29700.0
}
```

**Formula (in `services/demand_engine.py`):**
```python
total_occupants         = round(num_flats × occupants_per_flat)
daily_demand_lpd        = total_occupants × lpcd
daily_demand_with_buffer = daily_demand_lpd × DEMAND_BUFFER_FACTOR  # × 1.10
```

---

#### `POST /api/catchment/calculate`
Fetches real rainfall from Open-Meteo and computes annual + monthly yield.

**Request:**
```json
{
  "latitude": 19.2183,
  "longitude": 72.9781,
  "roof_area_sqm": 960.0
}
```

**Response:**
```json
{
  "annual_rainfall_mm": 2347.0,
  "monthly_rainfall_mm": [1, 1, 2, 18, 110, 510, 710, 580, 300, 95, 18, 2],
  "annual_yield_litres": 1283673.6,
  "monthly_yield_litres": [...]
}
```

**Yield formula (in `services/yield_engine.py`):**
```python
yield_litres = rain_mm × roof_area_sqm × ROOF_RUNOFF_COEFFICIENTS[roof_surface_type] × USABILITY_FACTOR
             = rain_mm × roof_area_sqm × 0.90 × 0.80   [for Concrete default]
             = rain_mm × roof_area_sqm × 0.72
```

**Rainfall API** (`services/rainfall_api.py`):
- Source: Open-Meteo Climate Archive (`archive-api.open-meteo.com`) — free, no API key
- Fetches the most recent complete calendar year (`today().year - 1`)
- Aggregates daily precipitation to 12 monthly totals
- `None` precipitation values coerced to `0.0` via `or 0.0`

---

#### `POST /api/roi/simulate`
Runs a multi-year ROI simulation.

**Request:**
```json
{
  "daily_demand_lpd": 29700.0,
  "annual_yield_litres": 1283673.6,
  "tank_capacity_litres": 50000,
  "water_tariff_per_kl": 15.0,
  "installation_cost": 250000,
  "years": 10
}
```

**Response:**
```json
{
  "payback_years": 9.80,
  "ten_year_savings": 255000.0,
  "yearly_breakdown": [
    { "year": 1, "savings": 25500.0, "cumulative_savings": 25500.0, "net_benefit": -224500.0 },
    ...
  ]
}
```

**Formula (in `services/roi_engine.py`):**
```python
annual_demand_litres   = daily_demand_lpd × 365
effective_annual_yield = min(annual_yield_litres, annual_demand_litres)
effective_yield_kl     = effective_annual_yield / 1000

annual_savings         = effective_yield_kl × water_tariff_per_kl
cumulative_savings[y]  = annual_savings × y           # constant rate — no escalation

# Payback interpolation (within the break-even year):
excess        = cumulative_savings - installation_cost
payback_years = year - (excess / annual_savings)
```

**Pydantic validation guards:**
- `water_tariff_per_kl > 0` — enforced by both `@field_validator` and a service-layer guard (prevents division-by-zero in payback interpolation)
- `num_flats > 0`, `occupants_per_flat > 0`, `roof_area_sqm > 0`
- `years` range: 1–30

---

#### `POST /api/report/generate`
**Status: HTTP 501 Not Implemented**  
Returns a structured error explaining WeasyPrint GTK3 dependency requirement. Use the in-browser print from the ROI Dashboard instead.

---

### Pydantic Schemas (`backend/models/schemas.py`)

```
SocietyBaselineRequest   → SocietyBaselineResponse
CatchmentRequest         → CatchmentResponse
ROIRequest               → ROIResponse (contains list[YearlyROI])
ReportRequest            → (streams PDF bytes / currently 501)
```

---

## Library Reference

### Frontend (`package.json` dependencies)

| Library | Version | Role |
|---|---|---|
| `react` | ^19.2 | UI component framework |
| `react-dom` | ^19.2 | DOM renderer |
| `react-router-dom` | ^7.14 | Client-side routing (BrowserRouter, Routes, Navigate) |
| `react-leaflet` | ^5.0 | React bindings for Leaflet.js interactive maps |
| `leaflet` | ^1.9.4 | Core mapping engine — tile layers, polygons, markers |
| `@turf/turf` | ^7.3.4 | Geospatial geometry — geodesic polygon area (WGS84) |
| `recharts` | ^3.8 | SVG chart library — bar, line, composed, area charts |
| `lucide-react` | ^1.6 | Icon set — used throughout for UI icons |

### Frontend Dev Dependencies

| Library | Role |
|---|---|
| `vite` | Build tool + dev server (HMR) |
| `@vitejs/plugin-react` | Vite plugin for JSX transform |
| `tailwindcss` | Utility-first CSS framework |
| `@tailwindcss/vite` | Vite integration for Tailwind v4 |
| `eslint` + plugins | Linting (react-hooks, react-refresh rules) |

### Backend (`requirements.txt`)

| Library | Version | Role |
|---|---|---|
| `fastapi` | ≥0.115 | ASGI web framework — routing, dependency injection, OpenAPI docs |
| `uvicorn[standard]` | ≥0.30 | ASGI server — runs the FastAPI app |
| `pydantic` | ≥2.10 | Request/response validation, field validators, type coercion |
| `httpx` | ≥0.27 | Async HTTP client — fetches Open-Meteo rainfall API |
| `jinja2` | ≥3.1.4 | HTML templating for PDF report (template in `backend/templates/`) |
| `weasyprint` | ≥61.2 | HTML→PDF converter (requires GTK3 — currently disabled, returns 501) |
| `python-multipart` | ≥0.0.9 | Multipart form data support for FastAPI |

### External APIs & Data Sources

| Service | Usage | Auth |
|---|---|---|
| **Open-Meteo Climate Archive** | Daily historical precipitation — backend `/api/catchment/calculate` | None (free) |
| **Open-Meteo Archive** | 10-year daily precipitation for Thane — MapStudio frontend fetch | None (free) |
| **Esri World Imagery** | Satellite tile layer for Leaflet map | None (public tiles) |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     WaterWalletContext                          │
│  societyName · flats · occupants · totalTankerSpend             │
│  totalMunicipal · billingMonths · annualDemand                  │
│  estimatedCapex · annualYield · monthlyRainfall                 │
│  capexRatePerSqm · monthlyDemand (derived)                      │
└───────────┬─────────────────────────────┬───────────────────────┘
            │ writes                      │ reads
            ▼                             ▼
┌───────────────────┐          ┌──────────────────────┐
│  Phase 1          │          │  Phase 3             │
│  Virtual Meter    │          │  ROI Dashboard       │
│                   │          │                      │
│  calculateCanon-  │          │  runScenario()       │
│  icalDemand()     │          │  3× inflation paths  │
│  → annualDemand   │          │  Break-even detect   │
│  → tanker totals  │          │  Self-sufficiency %  │
└───────────────────┘          └──────────────────────┘
            │ writes (on proceed)
            ▼
┌───────────────────────────────────────────────────────────────┐
│  Phase 2 — Map Studio                                         │
│                                                               │
│  Open-Meteo API → 10-yr avg rainfall (Thane)                 │
│  Leaflet click → polygon vertices                             │
│  Turf.js → geodesic area (m²)                                │
│  × OBSTACLE_FACTOR → usableArea                              │
│  × RUNOFF_COEFF × rainfall → maxYield (L/yr)                 │
│  × CAPEX_RATE_PER_SQM → estimatedCapex (₹)                  │
│  → writes estimatedCapex, annualYield, monthlyRainfall        │
└───────────────────────────────────────────────────────────────┘

Backend API (optional — called by frontend when needed):
  POST /api/society/baseline   → IS 1172 demand (Steps 1 + 4)
  POST /api/catchment/calculate → Open-Meteo rainfall + yield
  POST /api/roi/simulate        → multi-year payback simulation
  POST /api/report/generate     → HTTP 501 (WeasyPrint pending)
```

---

*Generated: 2026-04-26 · WaterWallet v1.0 · IS 1172 Compliant*
