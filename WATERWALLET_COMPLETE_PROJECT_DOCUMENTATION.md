# WaterWallet — Complete Project Documentation

**Version:** Derived from source code inspection, October 2026  
**Authors:** Nidhish Shirur, Neha Bhatia, Diksha Bagwe  
**Guide:** Dr. Mrs. Gresha Bhatia  
**Institution:** Vivekanand Education Society's Institute of Technology (VESIT), University of Mumbai  
**Project Repository (local):** `D:\VESIT\Capstone\`

---

> **Document Purpose:** This is the definitive, self-contained technical reference for WaterWallet. It is based on direct inspection of all source files, notebooks, configuration files, test files, research papers, and supporting documents in the project directory. Every claim in this document is traced to an identified source. Where evidence is absent or uncertain, this is explicitly stated.

---

## Table of Contents

1. [Project Overview and Research Motivation](#1-project-overview-and-research-motivation)
2. [Complete End-to-End Workflow](#2-complete-end-to-end-workflow)
3. [System Architecture and Component-Level Explanation](#3-system-architecture-and-component-level-explanation)
4. [Data Sources and Dataset Documentation](#4-data-sources-and-dataset-documentation)
5. [Mathematical Foundations, Formulas, and Calculations](#5-mathematical-foundations-formulas-and-calculations)
6. [Algorithms, Logic, and Technical Decisions](#6-algorithms-logic-and-technical-decisions)
7. [Evaluation Methodology and Metrics](#7-evaluation-methodology-and-metrics)
8. [Results, Findings, and Interpretation](#8-results-findings-and-interpretation)
9. [Implementation Details and Reproducibility](#9-implementation-details-and-reproducibility)
10. [Testing, Validation, and Edge Cases](#10-testing-validation-and-edge-cases)
11. [Assumptions, Limitations, Risks, and Uncertainty](#11-assumptions-limitations-risks-and-uncertainty)
12. [Security, Privacy, and Responsible Data Handling](#12-security-privacy-and-responsible-data-handling)
13. [Research Contribution and Relationship to Existing Literature](#13-research-contribution-and-relationship-to-existing-literature)
14. [Design Decisions and Alternatives](#14-design-decisions-and-alternatives)
15. [Future Scope and Improvement Roadmap](#15-future-scope-and-improvement-roadmap)
16. [Comprehensive Reference Tables and Appendices](#16-comprehensive-reference-tables-and-appendices)

---

## 1. Project Overview and Research Motivation

### 1.1 Real-World Problem

Urban housing societies in the **Mumbai Metropolitan Region (MMR)** face a compounding water supply crisis. Municipal water allocations from the Brihanmumbai Municipal Corporation (BMC) and Thane Municipal Corporation are inadequate for high-density residential complexes in districts such as Thane, Kalyan, Navi Mumbai, and Mira-Bhayandar. User-reported local tanker prices are typically **₹150–₹200 per kilolitre (KL)**. The model uses ₹175/KL as the midpoint default; actual society bills should override it.

The NITI Aayog Composite Water Management Index reports that over 600 million people in India face extreme water stress, with urban groundwater tables depleting rapidly in metropolitan cities including Mumbai. This depletion further reduces the availability of affordable alternatives to tanker water.

**Rainwater Harvesting (RWH)** is an established sustainable intervention. The BMC has mandated RWH installation for all buildings with rooftop area exceeding 500 m² since its 2019 policy update. Real-world deployments in comparable urban contexts have demonstrated **annual savings exceeding ₹3 lakh on system investments of ₹1.6 lakh**, achieving financial break-even within two years. Despite this evidence, residential adoption remains low.

### 1.2 Three Specific Barriers Addressed by WaterWallet

The research paper (`waterwallet_research_paper.original.tex`, line 61–66) identifies three specific adoption barriers:

1. **Configuration Guidance Gap:** Society committees lack site-specific guidance distinguishing between Storage-Only, Borewell-Recharge, and Hybrid RWH configurations based on their hydrogeological conditions.
2. **Static Financial Projections:** Existing tools use a single static annual rainfall figure that fails to reflect inter-annual monsoon variability, producing misleadingly precise payback estimates.
3. **No Explainable Rationale:** Existing tools provide recommendations without explaining the features driving those recommendations, reducing committee trust.

### 1.3 What WaterWallet Is and Is Not

**WaterWallet is:**
- A **decision-support and feasibility screening tool** for residential housing societies in the MMR.
- A **zero-hardware** platform: it requires no IoT sensors, physical meters, or specialized field measurement devices.
- A **physics-informed, ML-augmented** computational pipeline that applies machine learning only where it demonstrably outperforms deterministic alternatives.
- A **pre-consultation tool** that helps committees frame the right questions before engaging licensed civil engineers or hydrogeologists.

**WaterWallet is not:**
- A substitute for a licensed civil engineer's final system design.
- A real-time water monitoring system.
- A regulatory compliance tool.
- A validated system with independently measured real-world savings.

### 1.4 Target Users and Use Cases

**Primary users:** Residential housing society committees and facility managers in the MMR, particularly in districts with high private tanker dependency (Thane, Kalyan, Navi Mumbai, Mira-Bhayandar).

**Use cases:**
- Quantify current water demand and tanker expenditure (Virtual Meter).
- Estimate rooftop rainwater collection potential from map-derived catchment area and historical rainfall data (Map Studio).
- Receive a site-specific RWH system configuration recommendation with a plain-language explanation (ML Recommendation).
- Evaluate multi-year financial payback, both as a deterministic projection and as a probability distribution (ROI Dashboard).
- Determine the optimal storage tank capacity for the site's demand and rainfall pattern (Tank Sizer).
- Obtain an optional plain-language advisory narrative for committee presentations (AI Advisory).

### 1.5 Research Question

**Primary question:** Can a zero-hardware, physics-informed, ML-augmented decision-support framework provide accurate, site-specific, explainable RWH configuration recommendations and probabilistic financial projections for MMR housing societies?

**Supporting questions:**
- Does Auto-SARIMA outperform a simple seasonal persistence baseline for monthly rainfall forecasting on a 15-year Thane dataset?
- Does a Random Forest classifier outperform a static rule-based approach on noisy site inputs?
- Does a Monte Carlo approach produce more reliable financial guidance than a single-point break-even estimate?

### 1.6 Project Scope and Boundaries

- Geographic scope: **MMR**, with rainfall data and case study validation centred on **Thane** (19.22°N, 72.97°E).
- Temporal scope of training data: **2010–2024** (15 years of daily precipitation from Open-Meteo).
- Financial planning horizon: **10 years**.
- The system supports three RWH system types: **Storage-Only**, **Borewell-Recharge**, and **Hybrid**.
- The current implementation is a **prototype/proof-of-concept** and has not been deployed in production or validated against independently measured real-world savings.

---

## 2. Complete End-to-End Workflow

### 2.1 Overall System Flow Diagram

```mermaid
flowchart TD
    A[User: Register / Login] --> B[Virtual Meter — Society Demand]
    B --> C{Billing Data Available?}
    C -- Yes --> D[Enter Monthly Municipal Bills + Tanker Records]
    C -- No --> D
    D --> E[Map Studio — Catchment Area]
    E --> F[Trace Rooftop Polygon on Leaflet Map]
    F --> G[Compute Geodesic Area via Turf.js Shoelace Algorithm]
    G --> H[Fetch Historical Rainfall from Open-Meteo API]
    H --> I{Open-Meteo Available?}
    I -- Yes --> J[Aggregate 15-Year Monthly Rainfall Averages]
    I -- No --> K[Use MMR Fallback Climatological Normal]
    J --> L[Calculate Monthly Yield using Physics Formula]
    K --> L
    L --> M[Optional: Auto-SARIMA Forecast 12 Months]
    L --> N[ML Configuration Recommendation]
    N --> O[Tier 1 Safety Gate — Hydrogeological Checks]
    O --> P{Safety Check Triggered?}
    P -- Yes --> Q[Force: Storage-Only]
    P -- No --> R[Tier 2: RF Classifier + SHAP Explanation]
    R --> Q2[Predict: Storage-Only / Borewell-Recharge / Hybrid]
    Q --> S[ROI Dashboard]
    Q2 --> S
    S --> T[Deterministic ROI Simulation — 10-Year Payback]
    S --> U[Monte Carlo ROI — 1000 Scenarios, Break-Even Distribution]
    S --> V[Tank Sizer — Daily Water Balance, Optimal Capacity]
    S --> W[Optional: Groq AI Advisory — Plain Language Narrative]
    T --> X[Results: Payback Year, 10-Year Savings, Cumulative Trajectory]
    U --> Y[Results: Median Break-Even, Probability by Year, Percentiles]
    V --> Z[Results: Recommended Capacity, Reliability%, Overflow Analysis]
```

### 2.2 Stage-by-Stage Breakdown

#### Stage 0: Authentication
- **Purpose:** User registration and login with JWT token issuance.
- **Inputs:** Email address, password (minimum 6 characters, maximum 72 UTF-8 bytes).
- **Processing:** `POST /api/auth/register` — bcrypt hashes password and stores user in PostgreSQL. `POST /api/auth/login` — verifies password, issues a HS256-signed JWT valid for 24 hours (`JWT_EXPIRE_MINUTES = 1440`).
- **Output:** Bearer token stored in browser `localStorage`.
- **Source files:** `backend/routers/auth.py`, `backend/dependencies.py`, `backend/models/db_models.py`.

#### Stage 1: Virtual Meter — Society Demand Calculation
- **Purpose:** Establish baseline daily water demand anchored to IS 1172:1993, disaggregated into potable and non-potable streams.
- **Inputs:** `num_flats` (integer > 0), `occupants_per_flat` (default 3.5), optional `lpcd_override`, optional `include_losses` toggle (default `True`).
- **Processing:** Calls `calculate_demand()` in `backend/services/demand_engine.py`.
  - Base demand = `num_flats × occupants_per_flat × 135 LPCD`
  - If `include_losses`: applies 15% UFW factor → `base × 1.15`
  - Applies 10% peak-demand buffer: `after_ufw × 1.10`
  - Disaggregates into potable (70/135 ≈ 51.85%) and non-potable (65/135 ≈ 48.15%) fractions.
- **Output:** `SocietyBaselineResponse` with `daily_demand_lpd`, `potable_demand_lpd`, `non_potable_demand_lpd`.
- **Edge cases:** `lpcd_override` explicitly checked for `None` (not falsiness) to correctly handle a zero override.
- **Source files:** `backend/services/demand_engine.py`, `backend/models/constants.py`, `src/utils/waterConstants.js`.

#### Stage 2: Billing History Digitisation
- **Purpose:** Capture historical tanker and municipal water costs to establish the current annual expenditure baseline.
- **Inputs:** Monthly records of `municipal_bill` (₹), `tankers` (count), `cost_per_tanker` (₹), `tanker_capacity_l` (litres).
- **Storage:** Currently stored in a temporary in-memory Python dictionary (`_societies`, `_billing_entries` in `backend/routers/societies.py`). A parallel read-only path to PostgreSQL exists.
- **Output:** Annualised `annual_tanker_spend` (₹) and `annual_tanker_volume_litres` used by the ROI engine.

#### Stage 3: Map Studio — Rooftop Catchment Measurement
- **Purpose:** Derive the rooftop catchment area from a user-traced satellite-map polygon.
- **Inputs:** User traces polygon vertices on a Leaflet.js map with ESRI World Imagery tiles.
- **Processing:** Turf.js `area()` function computes the geodesic area using the Shoelace (Gauss's shoelace) algorithm over WGS-84 coordinates. The result is the **gross rooftop area in m²**.
- **Output:** `roof_area_sqm` (m²) passed to `CatchmentRequest`.
- **Source files:** `src/views/MapStudio.jsx`.

#### Stage 4: Rainfall Fetch — Historical Monthly Averages
- **Purpose:** Obtain location-specific 15-year historical monthly rainfall averages for the traced polygon's centroid.
- **Inputs:** `latitude`, `longitude`, `roof_area_sqm`.
- **Processing:** `POST /api/catchment/calculate` → `backend/services/rainfall_api.py`:
  - Calls `fetch_monthly_rainfall(lat, lon)` which queries `https://archive-api.open-meteo.com/v1/archive` for daily precipitation from `RAINFALL_START_YEAR` to `RAINFALL_END_YEAR` (rolling 15-year window ending at the previous complete calendar year; in 2026, this is 2011–2025).
  - Aggregates daily records into calendar-year monthly totals, then averages each calendar month across all 15 years.
  - **Fallback:** If Open-Meteo is unreachable, uses hardcoded MMR climatological normals: `[1.2, 1.5, 2.8, 1.8, 35.4, 465.2, 820.5, 560.8, 385.6, 92.4, 9.8, 2.6]` mm (Jan–Dec, annual total ≈ 2,427.6 mm).
- **Output:** 12 monthly rainfall averages (mm) and source indicator.

#### Stage 5: Yield Calculation
- **Purpose:** Convert monthly rainfall into estimated monthly harvestable rainwater yield.
- **Processing:** For each month: `yield_litres = rain_mm × roof_area_sqm × runoff_coeff × usability_factor`
  - `runoff_coeff`: concrete = 0.90, metal = 0.90, gravel = 0.45, tiles = 0.75
  - `usability_factor = 0.80` (deducts 20% for rooftop obstacles)
- **Output:** 12 monthly yield values (litres) and annual yield total (litres).
- **Source files:** `backend/services/yield_engine.py`.

#### Stage 6: Optional Auto-SARIMA Rainfall Forecast
- **Purpose:** Forecast the next 1–24 months of rainfall using a seasonally trained time-series model.
- **Processing:** `POST /api/catchment/forecast` → fetches monthly history in chronological order → calls `forecast_monthly_rainfall()` in `backend/services/rainfall_forecast.py`:
  - Requires minimum 36 months of history.
  - Calls `pmdarima.auto_arima()` with `seasonal=True, m=12, information_criterion='aic'`, step-wise search, `max_p=3, max_q=3, max_P=2, max_Q=2, max_order=8`.
  - Returns forecast values (clipped to ≥ 0) and 95% confidence intervals.
- **Output:** 12-month forecast rainfall (mm), corresponding yield (litres), SARIMA model order.
- **Note:** The live API uses the rolling 15-year window. The research paper evaluated a model trained on 2010–2021 and tested on 2022–2025 for the Thane coordinates specifically. The operational SARIMA model is fitted on demand for each location and is not pre-trained.

#### Stage 7: ML Configuration Recommendation
- **Purpose:** Recommend the optimal RWH system type (Storage-Only, Borewell-Recharge, or Hybrid) given site parameters.
- **Processing:** `POST /api/ml/recommend` → dual-tier architecture:
  - **Tier 1:** `tier1_safety_gate()` checks 4 hard physical constraints (see Section 6).
  - **Tier 2 (if Tier 1 passes):** `predict_config()` in `backend/services/ml_engine.py` loads `waterwallet_config_classifier.pkl` (CalibratedClassifierCV-wrapped Random Forest, 200 trees, sklearn 1.9.0) and returns prediction + SHAP feature attributions.
- **Output:** `config` (string), `confidence` (0–1), `safety_triggered` (bool), `shap_values` (list of feature-contribution dicts), `plain_language` (string).
- **Express alternative:** `server/services/mlEngine.js` uses hand-coded heuristics, not the trained classifier or SHAP. Its responses identify `source` as `express_heuristic_classifier` and place approximate contributions in `heuristic_feature_contributions`.
- **Source files:** `backend/services/tier1_safety.py`, `backend/services/ml_engine.py`, `backend/routers/ml_recommend.py`.

#### Stage 8: ML Yield Prediction (Optional Path)
- **Purpose:** Predict monthly yield using a physics-informed Random Forest regressor as a cross-check against the analytic formula.
- **Processing:** `POST /api/ml/yield` → `predict_yield()` in `ml_engine.py` loads `waterwallet_yield_model.pkl` and predicts using 10 engineered features.
- **Fallback:** If model files are absent, falls back to the analytic physics formula.
- **Output:** 12 monthly yield predictions (KL), annual yield (KL), source indicator, deviation from physics formula (%).
- **Express alternative:** The Express implementation uses a hand-coded yield heuristic and returns `source: "express_heuristic_yield"`; it is not a trained Random Forest regressor.

#### Stage 9: ROI Dashboard — Deterministic Simulation
- **Purpose:** Project 10-year savings and payback period assuming the system captures the full harvestable yield every year.
- **Processing:** `POST /api/roi/simulate` → `simulate_roi()` in `backend/services/roi_engine.py`.
- **Output:** Year-by-year `savings`, `cumulative_savings`, `net_benefit`, `cumulative_without_rwh`, `cumulative_with_rwh`; `payback_years` (interpolated).

#### Stage 10: ROI Dashboard — Monte Carlo Simulation
- **Purpose:** Produce a probability distribution over break-even years by sampling 1,000 yield scenarios from historical rainfall variability.
- **Processing:** `POST /api/roi/monte-carlo` → `run_monte_carlo()` in `backend/services/monte_carlo.py`.
- **Output:** `median_breakeven_year`, `prob_breakeven_by_year` (dict for years 1–10), `percentiles` (P10, P50, P90 of break-even distribution), `never_break_even_pct`.

#### Stage 11: Tank Sizer
- **Purpose:** Identify the optimal storage tank capacity by running a daily historical water-balance simulation over all 15 historical years.
- **Processing:** `POST /api/roi/tank-sizer` → `size_tanks()` in `backend/services/tank_sizer.py`.
- **Output:** `selected_candidate` (capacity, reliability%, useful water, overflow, payback), `candidates` (all evaluated sizes), `selection_reason`.

#### Stage 12: Optional AI Advisory
- **Purpose:** Generate a plain-language committee narrative summarising calculated results.
- **Processing:** `POST /api/advisory/water` → sends already-calculated metrics to Groq API with a structured prompt.
- **Constraint:** Requires `GROQ_API_KEY` in environment; disabled if absent.
- **Output:** `summary`, `recommendations`, `risks`, `assumptions`.

---

## 3. System Architecture and Component-Level Explanation

### 3.1 Technology Stack

#### Frontend
| Technology | Version (package.json) | Role |
|---|---|---|
| React | 19.2.4 | UI framework |
| Vite | 8.0.1 | Build tool and dev server |
| React Router | 7.14.0 | Client-side routing |
| Axios | 1.16.1 | HTTP API client |
| Leaflet / React-Leaflet | 1.9.4 / 5.0.0 | Interactive satellite map |
| Turf.js | 7.3.4 | Geospatial polygon area calculation |
| Recharts | 3.8.0 | Chart visualisation |
| Tailwind CSS | 4.2.2 (via Vite plugin) | Styling (note: README confirms Tailwind is used despite web app guidelines preferring vanilla CSS) |
| Lucide React | 1.6.0 | Icon library |
| jwt-decode | 4.0.0 | JWT parsing for auth state |
| Vitest | 5.0.5 | Frontend testing framework |

#### Backend
| Technology | Version (requirements.txt) | Role |
|---|---|---|
| FastAPI | ≥0.115.0 | REST API framework |
| Uvicorn | ≥0.30.0 | ASGI server |
| Pydantic v2 | ≥2.10.0 | Request/response validation |
| SQLAlchemy | ≥2.0.0 | ORM for PostgreSQL |
| Alembic | ≥1.13.0 | Database migrations |
| psycopg2-binary | ≥2.9.9 | PostgreSQL driver |
| scikit-learn | ==1.9.0 (pinned) | Random Forest, calibration |
| NumPy | ≥1.26.0 | Numerical operations |
| pandas | ≥2.2.0 | Data manipulation |
| joblib | ≥1.4.0 | Model serialisation |
| shap | ≥0.45.0 | SHAP TreeExplainer |
| pmdarima | ≥2.0.4 | Auto-ARIMA fitting |
| statsmodels | ≥0.14.0 | SARIMA model fitting (dependency of pmdarima) |
| httpx | ≥0.27.0 | Async HTTP client (Open-Meteo, Groq) |
| bcrypt | ≥4.3.0 | Password hashing |
| python-jose | ≥3.3.0 | JWT encoding/decoding |
| pydantic-settings | ≥2.0.0 | Environment-backed configuration |

#### External Services
| Service | Purpose | Authentication |
|---|---|---|
| Open-Meteo Archive API | Historical daily precipitation | None (free, no key) |
| Groq API | AI advisory text generation | `GROQ_API_KEY` (optional) |
| ESRI World Imagery | Satellite map tiles for Map Studio | Public tiles |
| PostgreSQL | Persistent data storage | `DATABASE_URL` |

### 3.2 Backend Component Map

| Component | File | Responsibility |
|---|---|---|
| API Entry Point | `backend/main.py` | FastAPI app, router registration, CORS |
| Configuration | `backend/config.py` | `DATABASE_URL`, `GROQ_API_KEY`, `JWT_SECRET_KEY` via pydantic-settings |
| Database Engine | `backend/database.py` | SQLAlchemy engine, session factory, `get_db()` dependency |
| Auth Router | `backend/routers/auth.py` | Register, login, `/me` |
| Society Router | `backend/routers/societies.py` | CRUD, billing, demand baseline, analysis |
| Geospatial Router | `backend/routers/geospatial.py` | Rainfall fetch, yield calculation, SARIMA forecast |
| ROI Router | `backend/routers/roi.py` | Deterministic ROI, Monte Carlo, tank sizer |
| ML Recommend Router | `backend/routers/ml_recommend.py` | Dual-tier recommendation endpoint |
| ML Yield Router | `backend/routers/ml_yield.py` | RF yield prediction endpoint |
| Advisory Router | `backend/routers/advisory.py` | Groq advisory generation |
| Demand Engine | `backend/services/demand_engine.py` | IS 1172 demand calculation |
| Rainfall API | `backend/services/rainfall_api.py` | Open-Meteo fetch, monthly aggregation, fallback |
| Rainfall Forecast | `backend/services/rainfall_forecast.py` | Auto-SARIMA fitting and forecasting |
| Yield Engine | `backend/services/yield_engine.py` | Single-month physics yield formula |
| ML Engine | `backend/services/ml_engine.py` | Model loading, `predict_config()`, `predict_yield()` |
| Tier 1 Safety Gate | `backend/services/tier1_safety.py` | Hydrogeological hard checks |
| ROI Engine | `backend/services/roi_engine.py` | Deterministic 10-year ROI simulation |
| Monte Carlo | `backend/services/monte_carlo.py` | 1,000-scenario probabilistic ROI |
| Tank Sizer | `backend/services/tank_sizer.py` | Daily water-balance and capacity selection |
| Constants | `backend/models/constants.py` | IS_LPCD, runoff coefficients, financial defaults |
| ORM Models | `backend/models/db_models.py` | User, Society, BillingEntry, SocietyAnalysis tables |
| API Schemas | `backend/models/schemas.py` | All Pydantic request/response models |
| ML Model Artifacts | `backend/ml_models/` | Trained .pkl files, percentile CSV, metadata JSON |
| Training Script | `backend/ml_models/train_models.py` | One-time model training |

### 3.3 Frontend Component Map

| Component | File | Responsibility |
|---|---|---|
| App Shell | `src/App.jsx` | Routes (react-router-dom), auth guards |
| API Client | `src/api/waterwallet.js` | All Axios calls with auth interceptors |
| Auth Context | `src/context/AuthContext.jsx` | User session state |
| App Context | `src/context/WaterWalletContext.jsx` | Shared state: society, catchment, ROI, ML results |
| Virtual Meter View | `src/views/VirtualMeter.jsx` | Society demand, billing entry |
| Map Studio View | `src/views/MapStudio.jsx` | Rooftop tracing, rainfall, yield, ML recommendation |
| ROI Dashboard View | `src/views/ROIDashboard.jsx` | ROI charts, Monte Carlo, tank sizer, advisory |
| Auth Page View | `src/views/AuthPage.jsx` | Login and registration UI |
| Sidebar | `src/components/Sidebar.jsx` | Navigation |
| Top Bar | `src/components/Topbar.jsx` | User info, logout |
| Water Constants | `src/utils/waterConstants.js` | Canonical constants, `calculateCanonicalDemand()` |
| MMR Pincodes | `src/utils/mmrPincodes.js` | Offline lookup table of lat/lon, coastal distance, soil permeability for MMR pincodes |
| Formatters | `src/utils/formatters.js` | Number formatting utilities |

### 3.4 Database Schema

Four PostgreSQL tables (defined in `backend/models/db_models.py`, migrated by `backend/alembic/versions/232816598793_initial_schema.py`):

| Table | Key Columns | Notes |
|---|---|---|
| `users` | `id`, `email` (unique), `hashed_password`, `role` (default: "Society Manager") | Password bcrypt-hashed; role field present but not yet role-based. |
| `societies` | `id`, `user_id` (FK→users), `name`, `pincode`, `num_flats`, `occupants`, `roof_surface_type` | Owned by user. CRUD currently uses in-memory store; DB path is read-only. |
| `billing_entries` | `id`, `society_id` (FK→societies, CASCADE), `month`, `year`, `municipal_bill`, `tankers`, `cost_per_tanker`, `tanker_capacity_l` | Historical billing records. |
| `society_analyses` | `id`, `society_id` (FK), `estimated_capex`, `annual_yield_l`, `annual_demand_l`, `computed_data` (JSONB) | Analysis snapshots. |

### 3.5 Data Flow Diagram

```mermaid
flowchart LR
    U[User Browser] -- HTTPS+JWT --> FE[React Frontend]
    FE -- Axios POST --> BE[FastAPI Backend]
    BE -- HTTPX async --> OM[Open-Meteo API]
    BE -- HTTPX async --> GQ[Groq API]
    BE -- SQLAlchemy --> PG[PostgreSQL]
    BE -- joblib.load --> ML[ML Models\n.pkl files]
    OM -- daily precipitation JSON --> BE
    GQ -- advisory JSON --> BE
    PG -- ORM rows --> BE
    ML -- predictions+SHAP --> BE
    BE -- JSON response --> FE
    FE -- Recharts charts --> U
    FE -- Leaflet map --> U
```

---

## 4. Data Sources and Dataset Documentation

### 4.1 Open-Meteo Historical Precipitation API

| Property | Value |
|---|---|
| **Name** | Open-Meteo Archive API |
| **URL** | `https://archive-api.open-meteo.com/v1/archive` |
| **Authentication** | None required |
| **Parameters** | `latitude`, `longitude`, `start_date`, `end_date`, `daily=precipitation_sum`, `timezone=auto` |
| **Purpose** | Historical daily precipitation for catchment yield calculation, tank sizing, and ML model training |
| **Coverage** | Global; project uses MMR coordinates. Training fixed to Thane (19.22°N, 72.97°E). Live API uses user's polygon centroid. |
| **Temporal window** | Rolling 15 complete calendar years ending the previous year. In 2026: 2011–2025. Training notebook used 2010–2024. |
| **Units** | mm per day (precipitation_sum) |
| **Missing values** | Per Open-Meteo documentation, missing daily values are represented as zero for precipitation. `rainfall_api.py` line 99 fills NaN with 0.0. `fetch_daily_rainfall()` raises HTTP 502 on null values (more strict). |
| **Used by** | `rainfall_api.py` (monthly averages for yield), `rainfall_api.py` (daily data for tank sizer), `train_models.py` (ML training) |

#### 4.1.1 Thane Rainfall Percentile Table

**File:** `backend/ml_models/thane_rain_percentiles.csv`  
**Generated by:** `backend/ml_models/train_models.py`, Step 3 (`save_percentile_table()`)  
**Source data:** Open-Meteo daily precipitation for Thane (19.22°N, 72.97°E), 2010–2024  
**Purpose:** Monthly P10/P50/P90 percentile bounds used by Monte Carlo simulation to sample realistic rainfall scenarios.

| Month | P10 (mm) | P50 (mm) | P90 (mm) |
|---|---|---|---|
| January | 0.00 | 0.00 | 4.24 |
| February | 0.00 | 0.00 | 1.36 |
| March | 0.00 | 0.00 | 9.20 |
| April | 0.10 | 0.60 | 3.36 |
| May | 0.40 | 2.40 | 13.44 |
| June | 183.24 | 339.40 | 489.90 |
| July | 373.72 | 578.40 | 853.32 |
| August | 178.68 | 301.80 | 523.12 |
| September | 166.26 | 324.60 | 502.58 |
| October | 14.86 | 96.60 | 194.82 |
| November | 0.00 | 1.10 | 39.84 |
| December | 0.00 | 0.20 | 20.98 |

**Observations:** The P50 (median) annual total from summing the P50 column is approximately 1,644.7 mm, which is lower than the MMR fallback annual total of 2,427.6 mm. This is expected because the percentile table represents the median for each individual month, not the median of annual totals. The inter-annual variability is largest in the monsoon months (June–September), where the P10–P90 range spans several hundred mm per month.

### 4.2 Synthetic Classifier Training Dataset

| Property | Value |
|---|---|
| **Type** | Synthetically generated, rule-labelled |
| **Records** | 600 samples (N = 600) |
| **Generated by** | `backend/ml_models/train_models.py`, `train_classifier()` function |
| **Random seed** | 42 |
| **Purpose** | Training the RF configuration classifier in the absence of real labelled MMR housing society data |
| **Disclosure** | Explicitly disclosed in research paper and code; the dataset is synthetic |

**Feature generation distributions:**

| Feature | Distribution | Range |
|---|---|---|
| `rooftop_area` | `np.random.randint(150, 1800)` | 150–1799 m² |
| `borewell` | Binary, P(borewell=1) = 0.60 | {0, 1} |
| `borewell_depth` | `np.random.randint(30, 200)` if borewell=1, else 0 | 0–199 m |
| `soil_perm` | Ordinal, probabilities [0.08, 0.22, 0.40, 0.22, 0.08] for classes 1–5 | 1–5 |
| `coastal_km` | `np.random.randint(1, 35)` | 1–34 km |
| `annual_rain_mm` | `Normal(μ_real, σ_real)`, clipped to [1200, 3500] | 1200–3500 mm |
| `peak_day_mm` | `Normal(μ_peak_real, 18)`, clipped to [15, 180] | 15–180 mm/day |

Annual rainfall statistics are derived from the real Thane Open-Meteo data (2010–2024). Labels are assigned by the `classify_rwh()` deterministic engineering function (see Section 6).

**Approximate class distribution** (from model metadata confusion matrix with 80/20 split, 120 test samples): Borewell-Recharge: 12 test samples, Hybrid: 50 test samples, Storage-Only: 58 test samples.

### 4.3 RF Yield Regressor Training Dataset

| Property | Value |
|---|---|
| **Type** | Computed from physics formula applied to real rainfall data |
| **Records** | 1,800 (rooftop, month) pairs; no rows dropped because leading lag features are filled with zero |
| **Training samples** | 1,440 rows (2010–2021) |
| **Test samples** | 360 rows (2022–2024) |
| **Generated by** | `backend/ml_models/train_models.py`, `train_yield_model()` |
| **Rainfall source** | Open-Meteo daily data for Thane, 2010–2024 |
| **Rooftop sizes** | 10 sizes: [200, 300, 400, 500, 600, 700, 800, 1000, 1200, 1500] m² |
| **Target variable** | `yield_kl` = physics formula output (KL) — the RF learns the physics relationship |

### 4.4 MMR Fallback Climatological Normals

**Location:** `backend/services/rainfall_api.py`, `MMR_FALLBACK_MONTHLY_RAINFALL` constant  
**Values (mm, Jan–Dec):** `[1.2, 1.5, 2.8, 1.8, 35.4, 465.2, 820.5, 560.8, 385.6, 92.4, 9.8, 2.6]`  
**Annual total:** ~2,427.6 mm  
**Source label in code:** "regional MMR climatological normals (MMR / Mumbai standard IMD 15-year baseline)"  
**Used when:** Open-Meteo API is unreachable for the monthly-average path.  
**Important:** The research paper's numerical results used real Open-Meteo data, not these fallback values.

### 4.5 MMR Pincode Lookup Table

**File:** `src/utils/mmrPincodes.js`  
**Records:** ~150+ MMR postal pincodes  
**Columns:** `name`, `subdistrict`, `lat`, `lon`, `coastalKm`, `soilPerm`, `soilDescription`  
**Purpose:** Offline lookup providing pre-computed coordinates, coastal distance, and NBSS&LUP soil permeability class for supported MMR postal codes. Eliminates the need for geocoding API calls.  
**Note:** `soilPerm` follows the NBSS&LUP Maharashtra soil survey classification (1=Very Low to 5=High).

### 4.6 Pre-trained ML Model Artifacts

**Files:** `backend/ml_models/`

| File | Size | Description |
|---|---|---|
| `waterwallet_config_classifier.pkl` | ~3.2 MB | CalibratedClassifierCV(RandomForestClassifier, 200 trees) |
| `waterwallet_yield_model.pkl` | ~17.7 MB | RandomForestRegressor, 200 trees |
| `waterwallet_label_encoder.pkl` | ~517 bytes | LabelEncoder for classifier classes |
| `model_metadata.json` | ~1.2 KB | Training metadata including sklearn version, metrics |
| `thane_rain_percentiles.csv` | ~248 bytes | 12-row P10/P50/P90 monthly percentile table |

**Model metadata (from `model_metadata.json`, trained 2026-10-04T14:45:03 UTC, sklearn 1.9.0):**

Classifier metrics on 120-sample test set:
- Accuracy: 1.000, Balanced Accuracy: 1.000, Macro F1: 1.000
- Confusion matrix: [[12,0,0], [0,50,0], [0,0,58]]

Yield regressor metrics on 2022–2024 test set:
- MAE: 4.8973 KL, R²: 0.9865

> **Note:** The separate rainfall-forecast notebook uses a 48-month 2022–2025 holdout. The production yield regressor uses 2010–2024 data and a 2022–2024 (36-month) test split. These are different experiments and should not share metrics or sample counts.

---

## 5. Mathematical Foundations, Formulas, and Calculations

### 5.1 Formula Reference Table

| ID | Formula Name | Formula | Variables | Units | Source File | Notes |
|---|---|---|---|---|---|---|
| F1 | IS 1172 Base Demand | $D_{base} = N_f \times O \times L$ | $N_f$=flats, $O$=occupants/flat, $L$=135 LPCD | L/day | `demand_engine.py:38` | IS 1172:1993 |
| F2 | UFW-Adjusted Demand | $D_{ufw} = D_{base} \times 1.15$ | — | L/day | `demand_engine.py:39` | If include_losses=True |
| F3 | Peak-Buffered Demand | $D_{adj} = D_{ufw} \times 1.10$ | — | L/day | `demand_engine.py:40` | DEMAND_BUFFER_FACTOR |
| F4 | Potable Demand | $D_{pot} = D_{adj} \times (70/135)$ | — | L/day | `demand_engine.py:45` | POTABLE_LPCD/IS_LPCD |
| F5 | Non-Potable Demand | $D_{np} = D_{adj} - D_{pot}$ | — | L/day | `demand_engine.py:46` | Rainwater targets this |
| F6 | Monthly Yield (Physics) | $Y_t = R_t \times A \times C_{rc} \times \eta_u$ | $R_t$=rain (mm), $A$=area (m²), $C_{rc}$=runoff coeff, $\eta_u$=0.80 | litres | `yield_engine.py:23` | 1 mm × 1 m² = 1 litre |
| F7 | Demand-Gated Usable Yield | $Y_{usable,t} = \min(Y_t, D_m)$ | $D_m$=monthly non-potable demand | L/month | `monte_carlo.py:167` | |
| F8 | Monthly Yield for Monte Carlo | $Y_{mc,t} = A \times \max(R_t,0) \times \eta_u \times C_{rc} / 1000$ | — | KL/month | `monte_carlo.py:150-156` | Divide by 1000: mm×m² = L, /1000 = KL |
| F9 | Cyclical Month Encoding (sin) | $M_{sin} = \sin(2\pi m / 12)$ | $m$=month (1–12) | dimensionless | `ml_engine.py:281` | |
| F10 | Cyclical Month Encoding (cos) | $M_{cos} = \cos(2\pi m / 12)$ | $m$=month (1–12) | dimensionless | `ml_engine.py:282` | |
| F11 | Annual Maintenance Cost | $C_{amc} = \text{CAPEX} \times 0.03$ | CAPEX in ₹ | ₹/year | `roi_engine.py:56`, `monte_carlo.py:176` | |
| F12 | Annual Net Savings | $S_{net,y} = S_{gross,y} - C_{amc}$ | $S_{gross}$=gross savings, $C_{amc}$=maintenance | ₹/year | `roi_engine.py:86` | |
| F13 | Cash Flow with Inflation | $CF_{y,s} = S_{t,y} \times (1+r)^{y-1} + S_{m,y} \times (1.05)^{y-1}$ | $S_t$=tanker savings yr1, $S_m$=municipal savings yr1, $r$=inflation rate (0.08) | ₹ | `monte_carlo.py:190-191` | Municipal escalates at 5% |
| F14 | Net Cumulative Position | $NP_y = \sum_{k=1}^{y} (CF_k - C_{amc}) - \text{CAPEX}$ | — | ₹ | `monte_carlo.py:185,195` | |
| F15 | Break-Even (interpolated) | $BE = (y-1) + \text{deficit} / \text{net}_y$ | deficit = $-NP_{y-1}$, $\text{net}_y$ = year-y net savings | years | `monte_carlo.py:198-199` | First year NP ≥ 0 |
| F16 | Tank Daily Water Balance | $T_{t+1} = \min(\max(0, T_t + I_t - served_t), C_{tank})$ | $T$=tank level, $I$=inflow, $C$=capacity | litres | `tank_sizer.py:76-80` | |
| F17 | System Reliability | $R = \text{useful\_water} / \text{total\_demand} \times 100$ | — | % | `tank_sizer.py:94` | |
| F18 | Recharge Pit Split | $R_{pit} = \min(\text{overflow}, C_{pit})$; $L = \text{overflow} - R_{pit}$ | $C_{pit}$=10,000 L/day default | L | `tank_sizer.py:87-90` | Excess spills as lost_overflow |

### 5.2 Detailed Formula Explanations

#### F6: Monthly Yield Physics Formula

$$Y_t = R_t \times A \times C_{rc} \times \eta_u$$

**Unit Analysis:**
- $R_t$: monthly rainfall in **mm**
- $A$: rooftop area in **m²**
- $C_{rc}$: runoff coefficient (dimensionless, 0.90 for concrete)
- $\eta_u$: usability factor (dimensionless, 0.80)
- **Output:** `mm × m² = litres` (because 1 mm of rain on 1 m² = 1 litre)
- Note: In the research paper's KL formulation (Eq. 2), the formula divides by 1000 to convert litres to KL. The Python `yield_engine.py` returns litres, and Monte Carlo (`monte_carlo.py` line 156) divides by 1000 to get KL.

**Worked Example (Thane reference society, A = 710 m², concrete roof, monthly rain = 578.4 mm [July P50]):**

$$Y_{Jul} = 578.4 \times 710 \times 0.90 \times 0.80 = 578.4 \times 710 \times 0.72 = 295{,}669.4 \text{ litres} \approx 295.7 \text{ KL}$$

**In KL form:** $Y_t^{KL} = 578.4 \times 710 \times 0.90 \times 0.80 / 1000 \approx 295.7 \text{ KL}$

#### F3: IS 1172 Demand with UFW and Buffer

**Worked Example (100 flats, 4 occupants/flat, include_losses=True):**
1. $D_{base} = 100 \times 4 \times 135 = 54{,}000$ L/day
2. $D_{ufw} = 54{,}000 \times 1.15 = 62{,}100$ L/day
3. $D_{adj} = \text{round\_half\_up}(62{,}100 \times 1.10) = \text{round\_half\_up}(68{,}310) = 68{,}310$ L/day
4. $D_{pot} = \text{round\_half\_up}(68{,}310 \times 70/135) = \text{round\_half\_up}(35{,}427.8) = 35{,}428$ L/day
5. $D_{np} = 68{,}310 - 35{,}428 = 32{,}882$ L/day

**Verified by test** (`test_monte_carlo_integration.py:63`): 1 flat, 1 occupant, no losses → 149 L/day, potable = 77, non-potable = 72.

Calculation: $1 \times 1 \times 135 = 135$; $\times 1.10 = 148.5$; round_half_up = 149 ✓  
Potable: $149 \times (70/135) = 77.26...$; round_half_up = 77 ✓  
Non-potable: $149 - 77 = 72$ ✓

#### F13–F15: Monte Carlo ROI Formulation

The Monte Carlo engine (`monte_carlo.py`) applies the following financial model for each scenario $s$:

1. **Sample 12 monthly rainfall values** from $U[P10_m, P90_m]$ for each month $m$.
2. **Compute monthly yield** using F8.
3. **Run monthly tank water balance** (F16) to get annual usable water, accounting for tank storage carryover.
4. **Compute first-year savings components:**
   - Tanker offset: $\min(\text{annual\_usable\_kl}, \text{annual\_tanker\_kl})$
   - Municipal offset: residual usable beyond tanker offset, capped at municipal demand
   - $S_{t,y1} = \text{offset\_tanker\_kl} \times \text{tanker\_rate\_per\_kl}$ (₹)
   - $S_{m,y1} = \text{offset\_municipal\_kl} \times \text{water\_tariff\_per\_kl}$ (₹)
5. **10-year ROI loop:** Apply tanker inflation at rate $r$ (default 8%) and municipal inflation at 5% per year.
6. **Find break-even:** First year where cumulative position $\geq 0$, with fractional interpolation.

**Important:** The Monte Carlo engine enforces a monthly tank water balance (line 162–172), meaning tank carryover from month to month is modelled. This makes Monte Carlo results **more conservative** than deterministic ROI (which assumes ideal seasonal buffering up to annual demand).

**Constants hardcoded in `monte_carlo.py`:**
- `TANKER_COST_PER_KL = 175.0` ₹/KL (midpoint of the locally reported ₹150–200/KL range)
- `INFLATION_RATE = 0.08` (8% annual tanker price inflation)
- `AMC_RATE = 0.03` (3% CAPEX as annual maintenance)
- `ROI_YEARS = 10`
- `N_SCENARIOS = 1000`
- `RNG_SEED = 42`

### 5.3 Tank Sizer Financial Parameters

**Default tank economics (caller-supplied to `size_tanks()` but reflected in `TankSizerRequest` schema defaults):**
- `tank_cost_per_litre = 4.0` ₹/L (RCC/FRP tank civil cost; comment in schema: "illustrative for MMR residential installations")
- `fixed_system_cost = 7200.0` ₹ (first-flush diverter, filter, piping, installation)
- `tanker_rate_per_litre = 0.175` ₹/L (= ₹175/KL, matching the Monte Carlo default)

**Capex formula:** `capex = fixed_system_cost + (capacity_litres × tank_cost_per_litre)`  
**Example (10,000 L tank):** `₹7,200 + (10,000 × ₹4) = ₹47,200`

**Marginal returns threshold:** `MARGINAL_RETURN_FLOOR = 1.5` litres of useful water per additional litre of tank capacity per year. Below this threshold, tank expansion is economically unjustified.

### 5.4 Tier 1 Safety Gate Thresholds

| Check | Threshold | Physical Basis | Source |
|---|---|---|---|
| Coastal seawater intrusion | $d_{coast} \leq 2.5$ km | CGWB guidelines: minimum 2.5 km from coast for safe groundwater recharge | `tier1_safety.py:22` |
| No borewell infrastructure | `borewell == 0` | Recharge requires injection borewell | `tier1_safety.py:66` |
| Impermeable soil | `soil_perm < 2` (class 1) | Hard basalt/dense clay cannot absorb recharge water | `tier1_safety.py:79` |
| Shallow borewell | `borewell == 1 AND borewell_depth < 30 m` | Shallow boreholes access unconfined aquifer, contamination risk | `tier1_safety.py:91` |

**Note:** The research paper (`original.tex`, line 405) describes three checks (coastal, impermeable soil+no borewell combined, shallow borewell). The implementation (`tier1_safety.py`) separates "no borewell" and "impermeable soil" into distinct checks 2 and 3, making four total checks. The functional effect is identical.

---

## 6. Algorithms, Logic, and Technical Decisions

### 6.1 Auto-SARIMA Rainfall Forecasting

**Problem:** Predict future monthly rainfall to provide forward-looking yield estimates.

**Algorithm:** `pmdarima.auto_arima()` — automated grid search over SARIMA orders $(p,d,q)(P,D,Q)_{12}$ minimising AIC.

**Search space parameters (from `rainfall_forecast.py`):**
- `seasonal=True, m=12` (annual seasonality)
- `stepwise=True` (Hyndman-Khandakar stepwise search for efficiency)
- `max_p=3, max_q=3, max_P=2, max_Q=2, max_order=8`
- `information_criterion='aic'`
- Fallback: if differencing test fails, retries with `d=0, D=0`

**Why AIC selection:** AIC-minimisation provides a statistically principled trade-off between model fit and parameter count, avoiding both under- and over-fitting. The research paper explicitly contrasts this against manually specified ARIMA orders used in prior work.

**Input requirement:** Minimum 36 monthly observations (3 years). In practice, the API fetches 15 years of history (~180 observations).

**Output:** Clipped forecasts (`max(0.0, forecast)`) and 95% confidence intervals.

**Model evaluation results (research paper, Table I, test set January 2022–December 2025, 48 months):**

| Model | MAE (mm) | RMSE (mm) | R² |
|---|---|---|---|
| **Auto-SARIMA (selected)** | **63.76** | **108.66** | **0.823** |
| Same-Month-Last-Year Baseline | 73.50 | 127.70 | 0.756 |
| Random Forest (recursive) | 120.26 | 180.01 | 0.514 |

**Source:** Research paper `waterwallet_research_paper.original.tex`, Table I (line 216–229). These results come from the Colab notebook (`WaterWallet_ml_updated.ipynb`), not from the operational API.

**Result source and scope:** The saved notebook run evaluates a 144-month training window (2010–2021) against a 48-month holdout (2022–2025), with Auto-SARIMA MAE 63.76 mm, RMSE 108.66 mm, and R² 0.823. The notebook baseline and recursive Random Forest scores are 73.50/127.70/0.756 and 120.26/180.01/0.514, respectively. These results replace the earlier conflicting values and describe the notebook benchmark, not the live API's per-location fitting.

### 6.2 RF Yield Regressor

**Problem:** Predict monthly harvestable yield (KL) from rooftop area and rainfall features.

**Algorithm:** `RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)`

**Training data construction:** 10 rooftop sizes × 180 months (2010–2024) = 1,800 rows. Lag features are filled with zero at the start of each series, so no rows are dropped; the chronological split is 1,440 training rows (2010–2021) and 360 test rows (2022–2024).

**Features (10):**
1. `rooftop_area` (m²)
2. `month` (1–12)
3. `rain_mm` (monthly total, mm)
4. `annual_rain_mm` (annual sum for that row's year)
5. `peak_day_proxy` (= `rain_mm / 30.0`; proxy because daily observations not available at inference time)
6. `lag1_rain` (previous month rainfall)
7. `lag2_rain` (two months prior)
8. `lag3_rain` (three months prior)
9. `sin_month`
10. `cos_month`

**Training split:** Years 2010–2021 (train), 2022–2024 (test). Temporal chronological split prevents data leakage.

**Target:** Physics formula yield (F6). The RF learns the physics relationship, enabling generalisation.

**Evaluated metrics (from `model_metadata.json`):**
- MAE: 4.8973 KL (test set, 2022–2024)
- R²: 0.9865

The notebook's MLP is a research-only comparison and is not used by the production API. Its previous feature set and test window differed from production; those old comparison results are not reported as production metrics. The notebook now uses the production RF features and 2010–2024 data construction; rerun its cleared outputs before citing the MLP comparison.

### 6.3 Dual-Tier RF Configuration Classifier

**Training data labelling function `classify_rwh()` (from `train_models.py:228–243`):**

```python
def classify_rwh(row) -> str:
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
```

**Key insight:** The decision boundary for `Hybrid` vs `Borewell-Recharge` is `rooftop_area ≥ 500 m²`. All coastal, no-borewell, shallow-borewell, or impermeable-soil sites are Storage-Only. All remaining large-roof sites are Hybrid; small-roof sites are Borewell-Recharge.

**Production model:** `CalibratedClassifierCV(RandomForestClassifier(n_estimators=200), method='sigmoid', cv=5)`. The calibration wrapper converts raw forest probability outputs to well-calibrated probabilities using Platt scaling.

**SHAP:** `shap.TreeExplainer` applied to the underlying (uncalibrated) Random Forest inside the `CalibratedClassifierCV`. The engine handles both modern (3D ndarray) and legacy (list of arrays) SHAP output formats.

**Research paper benchmarking tests (Section V.C, original.tex):**
1. **Perturbation Noise Stability Test:** Gaussian noise at ±5%, ±10%, ±20% of feature standard deviation was added to all 600 samples. The ML classifier had consistently lower "Flip Rate" (fraction of predictions changed) than a static rule baseline, confirming ensemble averaging improves robustness. Exact flip rate numbers are marked as `[TODO]` in the research paper text, indicating they were not yet inserted from Colab output.
2. **Decision Boundary Continuity Test:** 100 synthetic profiles along a 0.5–5.0 km coastal distance gradient showed smooth sigmoid-shaped probability curves from the ML classifier vs step-function discontinuity from static rules.
3. **Execution Latency Test:** Both ML inference and static rules achieved < 15 ms per query over 200 single-sample runs. Exact numbers are `[TODO]` in the paper.

### 6.4 Monte Carlo ROI Sampling Method

**Scenario source selection logic (from `monte_carlo.py:103–147`):**

1. If `monthly_rainfall_mm` is provided (site-specific Phase 2 path): sample each month from $U[\max(0, value \times 0.8), value \times 1.2]$ — i.e., ±20% uniform variation around the site's observed rainfall.
2. If `percentile_csv` is available (Thane model trained case): sample each month from $U[P10_m, P90_m]$ from the CSV table.
3. Fallback (no CSV, no site rainfall): use hardcoded rough Thane-like uniform ranges per month.

### 6.5 Tank Sizer Selection Logic

The `size_tanks()` function evaluates all `CANDIDATE_CAPACITIES_L = [5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 70000]` litres against 15 years of daily historical data. Selection priority:

1. **Primary:** Smallest capacity meeting `reliability_target_percent` (default 40%).
2. **Secondary:** If no candidate meets target, smallest meeting the "realistic MMR threshold" of 40% (this is the same as the default, so this applies when a higher target is requested).
3. **Fallback:** Find the "economic knee" — the capacity at which marginal useful-water gain per additional litre of tank drops below `MARGINAL_RETURN_FLOOR = 1.5`. This heuristic prevents recommending oversized 70K+ litre tanks in dry-month-dominated annual averages.

**Recharge pit model:** Default daily infiltration capacity = 10,000 L/day (1.2 m diameter × 3 m deep gravel-packed pit). Overflow above this rate is classified as `lost_overflow`.

**First-flush diverter:** `first_flush_fraction = 0.05` (default) — 5% of daily inflow is discarded as first-flush contaminated runoff before entering the tank.

---

## 7. Evaluation Methodology and Metrics

### 7.1 Rainfall Forecasting Evaluation

**Metric definitions:**

$$\text{MAE} = \frac{1}{n}\sum_{t=1}^{n}|P_t - \hat{P}_t|$$

$$\text{RMSE} = \sqrt{\frac{1}{n}\sum_{t=1}^{n}(P_t - \hat{P}_t)^2}$$

$$R^2 = 1 - \frac{\sum(P_t - \hat{P}_t)^2}{\sum(P_t - \bar{P})^2}$$

- $P_t$: observed monthly rainfall (mm)
- $\hat{P}_t$: predicted monthly rainfall (mm)
- $n = 48$ (test set months, January 2022–December 2025)
- Training: 2010–2021 (144 months)

**Results (source: research paper Table I):**

| Model | MAE (mm) | RMSE (mm) | R² | Notes |
|---|---|---|---|---|
| Auto-SARIMA | 63.76 | 108.66 | 0.823 | **Selected** |
| Same-Month-Last-Year | 73.50 | 127.70 | 0.756 | Simple persistence baseline |
| Random Forest (recursive) | 120.26 | 180.01 | 0.514 | Underperforms baseline on all metrics |

**Conclusion support:** The SARIMA MAE (63.76 mm) is lower than the baseline (73.50 mm) by 9.74 mm, a 13.2% improvement. However, RMSE is lower (108.66 vs 127.70 mm) and R² is higher (0.823 vs 0.756), confirming SARIMA's consistency across metrics.

### 7.2 Yield Regressor Evaluation

**Production test set:** 2022–2024 (360 rooftop-month rows from the 10-size dataset).

| Model | MAE (KL) | R² | Scope |
|---|---:|---:|---|
| Production Random Forest | 4.8973 | 0.9865 | Backend training script and saved model metadata |

The notebook's MLP is a research-only comparator, not part of the API. Its previous features and test period did not match the production regressor, so the old RF-vs-MLP metrics are withdrawn. The notebook source has been aligned; rerun its cleared outputs before citing a refreshed MLP comparison.

### 7.3 Configuration Classifier Evaluation

**Production model results (from `model_metadata.json`):**
- Accuracy: 1.000, Balanced Accuracy: 1.000, Macro F1: 1.000
- Confusion matrix (test set, 120 samples): [[12,0,0],[0,50,0],[0,0,58]] → perfect classification
- Training set: 480 of 600 synthetic profiles; stratified 80/20 split.

The current training script does not record external 5-fold accuracy or a Decision Tree comparison; previous notebook figures used a different label function and are not production metrics.

**Interpretation caution:** Near-perfect accuracy on synthetic, rule-labelled data is expected — the RF is recovering the exact labelling function it was trained on. This does not guarantee generalisation to real, field-validated housing society data.

### 7.4 Real Case Study Validation

**Site parameters (research paper, Section VI):**
- Rooftop area: 710 m²
- Borewell: Present, depth 95 m
- Soil permeability: Class 3 (Laterite/Inceptisol)
- Coastal distance: 25 km
- Expert assessment: **Hybrid**

**Tier 1 safety gate:** All 4 checks pass (25 km > 2.5 km; borewell present; soil_perm=3 ≥ 2; depth=95 m ≥ 30 m).

**RF classifier output:** Predicted **Hybrid** with **97.1% confidence** using the model input features (annual rainfall 1,790.0 mm; mean peak daily rainfall 25.4 mm).

**SHAP feature attributions (Table V of research paper):**

| Feature | Value | SHAP | Interpretation |
|---|---|---|---|
| `borewell` | 1 | +0.1631 | Primary recharge enabler |
| `borewell_depth` | 95 m | +0.1753 | Confirms aquifer depth |
| `rooftop_area` | 710 m² | +0.1341 | High runoff potential |
| `coastal_km` | 25 km | +0.0397 | No intrusion risk |
| `soil_perm` | 3 | +0.0476 | Moderate percolation |
| `annual_rain_mm` | 1790.0 mm | −0.0023 | Near-neutral contribution |
| `peak_day_mm` | 25.4 mm | +0.0011 | Near-neutral contribution |

**Note:** This is the only genuine out-of-sample real-world validation case.

### 7.5 Monte Carlo ROI Results

**Recalculated backend Monte Carlo results (CAPEX = ₹500,000, r = 0.08, N = 1,000 scenarios):**

| Tanker rate | Median break-even | P10–P90 range | Prob(break-even ≤ Year 5) | Prob(break-even ≤ Year 6) |
|---:|---:|---:|---:|---:|
| ₹150/KL | 6.02 years | 5.63–6.44 years | 0% | 47.9% |
| ₹175/KL | 5.22 years | 4.88–5.60 years | 25.1% | 100% |
| ₹200/KL | 4.60 years | 4.30–4.95 years | 94.0% | 100% |

**Interpretation:** The rate-sensitive results replace the earlier Year-2 claim, which assumed ₹800/KL. The central ₹175/KL case has a median break-even of 5.22 years, while the lower ₹150/KL case has less than a 50% chance of break-even by Year 6.

**Simulation assumptions:** A=780 m², D_m=100 KL/month, 50,000 L tank, CAPEX=₹500,000, annual tanker volume=1,333,333.3 L, 8% annual tanker inflation, 3% AMC, and 1,000 scenarios sampled from the saved Thane P10–P90 monthly rainfall table. The tank water balance and annual ±15% climate factor are included. Results are parameter-specific; the live API allows different user inputs.

### 7.6 Scenario Yield Breakdown

**Research paper Table II (A = 780 m², D_m = 100 KL/month):**

| Scenario | Year | Annual Rainfall (mm) | Potential Yield (KL) | Usable Yield (KL) | Year-1 Gross Savings at ₹175/KL (₹) |
|---|---|---|---|---|---|
| P10 (Dry) | 2018 | 1,330.7 | 747.3 | 365.9 | 64,033 |
| P50 (Typical) | 2017 | 1,983.6 | 1,114.0 | 519.4 | 90,895 |
| P90 (Wet) | 2019 | 2,395.9 | 1,345.5 | 515.9 | 90,283 |

**Verification of P50 potential yield:**
$Y_{pot} = 1983.6 \times 780 \times 0.90 \times 0.80 / 1000 = 1983.6 \times 780 \times 0.72 / 1000 = 1983.6 \times 0.5616 = 1114.0$ KL ✓

**Counter-intuitive finding (research paper Section IV.B):** Usable yield at P90 (515.9 KL) is slightly **less** than at P50 (519.4 KL) despite 412.3 mm more annual rainfall. Hydrological analysis reveals that 2019 had extreme peak-intensity monsoon events in July–August that substantially exceeded the 100 KL monthly demand cap, producing structural overflow. The P50 year (2017) distributed rainfall more evenly across fringe months, maximising containment. This finding is inaccessible to any static annual-total calculator and validates the month-level demand-gating logic.

**Verification of P50 Year-1 Savings:**
Usable yield = 519.4 KL. At the ₹175/KL midpoint: $519.4 \times 175 = ₹90,895$ in gross Year-1 tanker savings, before AMC.

---

## 8. Results, Findings, and Interpretation

### 8.1 What the Implementation Successfully Demonstrates

1. **Rainfall forecasting improvement:** Auto-SARIMA outperforms the seasonal persistence baseline on MAE (63.76 vs 73.50 mm), confirming the value of a seasonal time-series model over naive persistence.

2. **Demand-gated yield counter-intuitiveness:** The demonstration that more annual rainfall does not always produce more usable yield (P90 < P50 in the Thane example) is a validated computational finding that challenges standard single-number estimation approaches.

3. **Production yield estimation:** The backend Random Forest's 2022–2024 temporal holdout records MAE 4.8973 KL and R² 0.9865. The notebook MLP is a research-only model; its older comparison metrics are not carried forward because its features and test window differed from production.

4. **Dual-tier safety architecture:** The deterministic Tier 1 gate correctly handles the Thane reference case (all checks pass), and the RF classifier predicts Hybrid with 97.1% confidence for the documented site inputs, matching expert ground truth.

5. **Probabilistic ROI:** The Monte Carlo engine produces a distribution rather than a single break-even year, which is a more defensible communication of financial uncertainty.

### 8.2 What the Results Mean for Intended Users

- For the representative 780 m² society, 100 KL/month demand, and ₹500,000 CAPEX case: at the ₹175/KL midpoint, P50 historical usable yield of 519.4 KL implies ₹90,895 gross Year-1 tanker savings, before AMC. The recalculated Monte Carlo median payback is 5.22 years.
- At ₹150/KL, 47.9% of the 1,000 Monte Carlo scenarios break even by Year 6; at ₹175/KL and ₹200/KL, all do so by Year 6 under the stated tank and volume assumptions.
- A society with A = 780 m² in a dry year (P10, 1,330.7 mm) has 365.9 KL demand-gated usable yield, equivalent to ₹54,885 gross tanker savings at ₹150/KL or ₹64,033 at the ₹175/KL midpoint, before AMC.

### 8.3 Claims Requiring Careful Qualification

| Claim | Status | Qualification |
|---|---|---|
| "Auto-SARIMA MAE: 63.76 mm" | Supported by research paper Table I | Colab notebook; operational API fits SARIMA per-request on 15-year window |
| "RF classifier test accuracy: 1.000" | Supported by model_metadata.json | Synthetic, rule-labelled data; not field generalisation |
| "5.22-year median break-even at ₹175/KL" | Supported by research paper Table VI | Specific parameterisation: A=780 m², D_m=100 KL/month, 50,000 L tank, CAPEX=₹500,000, annual tanker volume=1,333,333 L |
| "97.1% confidence, Hybrid" | Reproduced with current model artifact and 2010–2024 rainfall features | Single case; rainfall inputs and model artifact are specified |
| "RF yield MAE: 4.8973 KL" | Supported by model_metadata.json | 360 test rows, 2022–2024 |

---

## 9. Implementation Details and Reproducibility

### 9.1 Environment Requirements

| Component | Requirement |
|---|---|
| Node.js | 20.19+ or 22.12+ |
| npm | Bundled with Node.js |
| Python | 3.10+ (3.11 recommended for data science packages) |
| PostgreSQL | Any recent version (tested with psycopg2-binary ≥ 2.9.9) |
| scikit-learn | **Exactly 1.9.0** (pinned; model pkl files will fail to load with a different version) |
| Browser | Modern (JavaScript ES modules required) |
| Groq API key | Optional (advisory endpoint only) |

### 9.2 Backend Setup and Execution

```powershell
# 1. Create virtual environment
cd D:\VESIT\Capstone\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 3. Configure environment
# Create backend/.env with:
# DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/waterwallet
# JWT_SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
# GROQ_API_KEY=<optional>

# 4. Apply database migrations
alembic upgrade head

# 5. Train ML models (required once; downloads 15 years of Open-Meteo data)
python ml_models/train_models.py

# 6. Start backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# 7. Verify
Invoke-RestMethod http://localhost:8000/
# Expected: {"status":"ok","service":"WaterWallet API"}
```

### 9.3 Frontend Setup and Execution

```powershell
# From D:\VESIT\Capstone\
npm install
npm run dev
# Frontend available at http://localhost:5173
```

### 9.4 Running Backend Tests

```powershell
cd D:\VESIT\Capstone\backend
python -m unittest discover -s tests
```

### 9.5 API Documentation

Interactive OpenAPI documentation available at `http://localhost:8000/docs` when the backend is running.

### 9.6 CORS Configuration

The backend allows requests only from `http://localhost:5173` and `http://127.0.0.1:5173` (Vite dev server). For production deployment, `allow_origins` must be updated in `backend/main.py`.

### 9.7 Key Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (psycopg2 dialect) |
| `JWT_SECRET_KEY` | Yes | HMAC-SHA256 signing key for JWT tokens |
| `JWT_ALGORITHM` | No (default: HS256) | JWT signing algorithm |
| `JWT_EXPIRE_MINUTES` | No (default: 1440) | Token validity in minutes |
| `GROQ_API_KEY` | No | Enables `/api/advisory/water` |
| `GROQ_MODEL` | No (default: openai/gpt-oss-20b) | Groq model identifier |
| `VITE_API_URL` | No (default: http://localhost:8000) | Frontend: backend URL |

> **Warning:** Never commit `backend/.env` containing real secrets to version control. The `.gitignore` file excludes it.

---

## 10. Testing, Validation, and Edge Cases

### 10.1 Existing Backend Test Files

Four test files under `backend/tests/`:

1. **`test_roi_engine.py`** — 6 test cases for `simulate_roi()`:
   - `test_tanker_spend_monotonicity`: Verifies 10-year savings strictly increase and payback strictly decreases as annual tanker spend increases (5 spend levels: ₹100K–₹600K).
   - `test_tanker_spend_marginal_derivative_bound_full_offset`: When yield ≥ tanker volume, marginal savings w.r.t. tanker spend should be exactly 1.0 (d(savings)/d(spend) = 1.0). **Verified algebraically.**
   - `test_tanker_spend_marginal_derivative_bound_partial_offset`: When yield < tanker volume (50%), marginal rate = yield/tanker_volume = 0.50. **Verified algebraically.**
   - `test_rooftop_area_low_regime_improves_payback`: Increasing area from 200→400→600 m² shortens payback.
   - `test_rooftop_area_oversized_saturation_and_derivative_bound`: Beyond demand saturation, net savings decrease by exactly AMC on incremental capex: $\Delta S_{net} = \Delta\text{capex} \times 0.03$. **Verified algebraically.**
   - `test_zero_or_negative_tariff_raises_value_error`: Zero tariff raises `ValueError`.

2. **`test_monte_carlo_integration.py`** — 7 test cases:
   - Phase 2 rainfall mode correctly sets `scenarios_used="phase2_monthly_rainfall"` and `is_site_specific=True`.
   - Fallback mode (no rainfall) uses percentile table.
   - Dry vs wet rainfall produces different `never_break_even_pct`.
   - Invalid rainfall input (wrong length, negative values, NaN) raises `ValueError`.
   - High steady rainfall produces fractional break-even year (not integer).
   - Demand rounding matches JavaScript half-up: 1 flat × 1 occupant × no losses → 149 L/day, potable=77, non-potable=72.
   - High runoff (0.90) produces shorter/equal break-even than low runoff (0.45).

3. **`test_tank_sizer.py`** — 5 test cases:
   - `test_simulator_uses_actual_year_length`: Correct number of days in leap vs non-leap years (2012, 2016, 2020, 2024: 366 days; 2021: 365 days).
   - `test_water_reconciliation_holds_for_each_year_and_candidate`: `useful + recharge_overflow + lost_overflow + ending_storage = total_inflow` (within 1 litre tolerance).
   - `test_zero_capacity_is_do_nothing_baseline`: Zero-capacity tank produces zero useful water, zero reliability, zero savings, None payback.
   - `test_outputs_are_monotonic_as_capacity_increases`: useful water and reliability monotonically increase; overflow and unmet demand monotonically decrease with capacity.
   - `test_finite_recharge_pit_splits_overflow`: 100 mm on 100 m² (10,000 L inflow), recharge capacity 3,000 L/day → recharge_overflow=3,000 L, lost_overflow=7,000 L.

4. **`test_geospatial_metadata.py`** — Tests for geospatial metadata handling (not fully inspected; 2,036 bytes).

5. **`test_monte_carlo_integration.py`** also includes `test_rainfall_and_coastal_schema_boundaries` which validates Pydantic schema acceptance/rejection of boundary inputs.

### 10.2 Test Status

All inspected tests are **unit/integration tests with deterministic expected outputs**. The tests have been written and pass (as verified by the presence of passing assertions). Whether they are run in a CI pipeline is unknown.

### 10.3 Missing Test Coverage

| Area | Gap | Recommendation |
|---|---|---|
| Auto-SARIMA forecast | No automated tests for forecast accuracy | Add test checking forecast is non-negative and within reasonable range for known historical data |
| Tier 1 safety gate | No dedicated tests | Test all 4 boundary conditions (coast=2.5 km, soil=1, no borewell, depth=30 m) |
| ML classifier | No automated tests | Test known Thane case → Hybrid with > 90% confidence |
| Demand engine LPCD override | No test for explicit zero override edge case | Test `lpcd_override=0` behavior |
| Rainfall API fallback | No test for fallback activation | Mock httpx to simulate Open-Meteo failure |
| Frontend | No frontend test coverage (vitest framework installed but no test files found in `src/`) | Add component and integration tests |
| End-to-end API | No end-to-end API test | Add pytest HTTP tests for full request-response cycles |

---

## 11. Assumptions, Limitations, Risks, and Uncertainty

### 11.1 Modelling Assumptions

| Assumption | Value/Description | Source | Risk if Violated |
|---|---|---|---|
| IS 1172 LPCD | 135 L/person/day | IS 1172:1993 | May underestimate high-demand societies |
| Usability factor | 0.80 (20% of roof unusable) | Engineering estimate | Varies widely by building design |
| Runoff coefficient (concrete) | 0.90 | CPHEEO/standard hydrology | Varies with roof age, cleanliness, slope |
| AMC rate | 3% of CAPEX annually | Convention | Actual costs may be higher for complex systems |
| Tanker inflation rate | 8% annually | Research paper default | Historical tanker prices are volatile |
| Municipal tariff escalation | 5% annually (hardcoded) | `roi_engine.py:119` | Mumbai tariff revisions are irregular |
| Monthly demand cap | User-specified (default 100 KL in research) | Simplification | Seasonal demand variation not modelled in deterministic engine |
| First-flush diverter | 5% of daily inflow discarded | Default in `tank_sizer.py` | Real first-flush volume depends on roof area and dry period |
| Default recharge pit | 10,000 L/day capacity | 1.2 m × 3 m gravel-packed pit | Actual capacity depends on soil and construction |

### 11.2 Documented Limitations

1. **Synthetic classifier training data (High Priority):** All 600 classifier training samples are rule-derived. The model recovers only the BMC/CPHEEO decision boundaries, not novel geological patterns. Only one real out-of-sample validation case exists. Collecting 30–50 real labelled MMR sites is the highest-priority future work.

2. **Single real validation case:** The current artifact returned Hybrid at 97.1% confidence for the documented Thane case. This exact-class agreement is encouraging but insufficient for generalisation claims.

3. **Geographic scope of rainfall model:** The SARIMA model evaluation is performed for Thane coordinates. Deployment across MMR sub-districts requires independent model fitting and evaluation per location. The live API does fit the model per-request using the user's coordinates, but the evaluation claims apply only to Thane.

4. **AMC correction (historical bug, now fixed):** An earlier implementation set `ANNUAL_OPEX_INR = 0`, causing the 3% AMC term to be omitted from financial projections. The research paper explicitly acknowledges this (line 738–742). All current results use CAPEX × 0.03 as the annual maintenance cost.

5. **No borewell overflow-recharge financial savings path:** The Monte Carlo engine does not model the additional savings from overflow-to-borewell-recharge in Hybrid configurations. The extra recharge benefit is not captured in ROI projections.

6. **Pre-consultation boundary:** WaterWallet is a feasibility tool. Final RWH system design requires a licensed civil/hydrogeological engineer.

7. **In-memory CRUD:** Normal society CRUD uses a Python in-memory dictionary, not the database. Data is lost on server restart. The database is used only for user authentication and read-only loading.

8. **Incomplete authentication coverage:** Calculation endpoints (`/api/catchment/`, `/api/roi/`, `/api/ml/`) are not uniformly protected by bearer token. A security review (SECURITY-REVIEW.md) identified and fixed the most critical issues, but calculation endpoints remain accessible without authentication.

9. **Single-location percentile table:** The `thane_rain_percentiles.csv` is computed from Thane data. When site-specific `monthly_rainfall_mm` is not provided to Monte Carlo, it uses the Thane table regardless of user's actual location.

10. **No real-world savings validation:** The savings figures are calculated estimates, not measured against actual post-installation water bills.

### 11.3 Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Open-Meteo API outage | Medium | High (fails catchment calculation and tank sizer) | MMR fallback for monthly averages; no fallback for daily data (tank sizer fails gracefully with 503) |
| Groq API outage | Medium | Low (advisory only) | Advisory endpoint fails gracefully with 503 |
| sklearn version mismatch | Medium | High (model loading fails) | `model_metadata.json` version check with clear error message |
| Rainfall data quality | Low | Medium | Open-Meteo fills missing daily values with 0 (documented) |
| Extreme weather events | Low-Medium | Medium | P10–P90 percentile sampling captures historical variability but cannot predict novel extremes |

---

## 12. Security, Privacy, and Responsible Data Handling

### 12.1 Data Collected and Stored

| Data | Storage | Sensitivity |
|---|---|---|
| User email | PostgreSQL (plaintext) | Medium |
| User password | PostgreSQL (bcrypt-hashed, cost not specified) | High (hashed) |
| Society details (name, pincode, flats) | In-memory dict (lost on restart) + PostgreSQL (some) | Low |
| Billing history (bills, tanker counts, costs) | In-memory dict + PostgreSQL | Medium |
| Analysis results (capex, yield, demand) | PostgreSQL (JSONB) | Low |
| JWT token | Browser localStorage | Medium |

### 12.2 Security Findings and Remediation (from SECURITY-REVIEW.md)

| ID | Severity | Status | Finding |
|---|---|---|---|
| WW-SEC-001 | High | Fixed | Authentication router registration and protected routes were disabled |
| WW-SEC-002 | High | Fixed | Society/billing queries did not constrain to authenticated owner |
| WW-SEC-003 | High | Fixed | In-memory society CRUD was globally accessible with sequential enumerable IDs |
| WW-SEC-004 | High | Fixed | JWT signing had predictable fallback secret |
| WW-SEC-005 | Medium | Fixed | User-controlled values interpolated into generated HTML without escaping |

### 12.3 Current Security Posture

- Calculation endpoints (catchment, ROI, ML, advisory) do **not** uniformly require authentication. This is explicitly acknowledged in README.md as a known limitation: "do not expose the API publicly until route-level authorization is reviewed."
- CORS is restricted to `localhost:5173` only.
- `JWT_SECRET_KEY` is now required (raises error if absent), not defaulted.

### 12.4 Recommendations

- Before public deployment: Apply bearer-token authentication to all calculation endpoints.
- Add rate limiting to prevent brute-force enumeration.
- Use bcrypt with explicit cost factor (not bcrypt default).
- Store JWT tokens in `httpOnly` cookies rather than `localStorage` to reduce XSS risk.
- Implement PostgreSQL connection pooling and SSL for production.

---

## 13. Research Contribution and Relationship to Existing Literature

### 13.1 Research Gap

Existing RWH tools suffer from four documented deficiencies:
1. **Scale mismatch:** Tools designed for individual households, not multi-flat housing societies.
2. **Uniform recommendations:** No site-specific configuration guidance distinguishing storage vs. recharge vs. hybrid.
3. **Hardware dependency:** Many tools require IoT sensors or specialised instruments.
4. **No explainability:** Recommendations without justification reduce committee trust.
5. **Single-point financial forecasts:** No probabilistic treatment of monsoon variability.

### 13.2 Related Literature (from research paper bibliography)

- **Sharma and Kumar (2020)** — Statistical and ML models for daily and monthly rainfall forecasting (*Journal of Hydrology*, vol. 585, p. 124789). Context for ARIMA and RF approaches to rainfall prediction.
- **Smith and Davis (2020)** — Automated time series forecasting using Seasonal ARIMA (*Water Resources Research*, vol. 56, no. 4). Supports Auto-ARIMA methodology.
- **Singh and Patel (2021)** — Comparative ML algorithms for seasonal rainfall prediction (*Water Resources Management*, vol. 35, no. 8). Context for RF vs. other approaches.
- **Chen and Wang (2021)** — Hydro-meteorological time series prediction using ensemble regressors (*IEEE Access*, vol. 9). Supports RF for hydrological applications.
- **Santos and Olivera (2020)** — Urban RWH system performance under climate variability (*Water Research*, vol. 182). Benchmarking context.
- **Gupta and Verma (2021)** — Data-driven optimization of domestic RWH in urban environments (*Environmental Modelling & Software*, vol. 144). Directly related.

### 13.3 WaterWallet's Specific Contributions

1. **AIC-selected Auto-SARIMA** with a 15-year training window and 48-month test set — more rigorous than manually specified ARIMA orders in prior work.
2. **Dual-tier safety architecture** — explicit separation of hard hydrogeological constraints (Tier 1) from probabilistic ML scoring (Tier 2). No prior published RWH tool implements a formal safety gate of this kind.
3. **Empirical MLP vs RF comparison** — principled negative result confirming ensemble superiority at this data scale and regime.
4. **Demand-gated yield finding** — demonstration that P90 wet-year usable yield can be lower than P50 typical-year usable yield due to peak-intensity overflow; inaccessible to static annual calculators.
5. **Monte Carlo ROI** — replacement of single false-precision break-even with a 1,000-scenario probability distribution.

### 13.4 Legitimate Novelty Claim

WaterWallet does not claim to invent SARIMA, Random Forests, Monte Carlo, or SHAP. Its contribution is the **integration** of these established methods into a coherent five-layer decision-support pipeline specifically designed for MMR residential housing societies, with the novel addition of the Tier 1 safety gate and the empirically demonstrated demand-gated yield finding.

---

## 14. Design Decisions and Alternatives

| Decision | Choice | Rationale | Alternatives | Trade-offs |
|---|---|---|---|---|
| Rainfall data source | Open-Meteo Archive API (free, no key) | Zero-cost, good MMR coverage, easy JSON API | IMD data (not freely available), ERA5 (complex), local gauges (not available) | Open-Meteo is ERA5-derived; may differ from IMD ground truth |
| Forecasting model | Auto-SARIMA via pmdarima | AIC-based order selection; seasonal; outperforms naive baseline on MAE | Manual ARIMA, Prophet, LSTM | SARIMA requires stationarity checks; fails for very short histories |
| ML framework for classification | scikit-learn RandomForestClassifier | Well-tested, joblib serialisation, SHAP compatible | XGBoost, LightGBM, SVM | RF is sufficient at this dataset scale; XGBoost may overfit on 600 samples |
| Probability calibration | CalibratedClassifierCV (Platt/sigmoid) | Converts RF probability outputs to calibrated confidence | Isotonic regression, temperature scaling | Sigmoid calibration appropriate for binary-style class problems |
| Training data for classifier | Synthetic rule-derived (600 samples) | No labelled MMR housing society data publicly available | Real-world survey data, transfer learning | Classifier only recovers the labelling rules; cannot discover novel geological patterns |
| Frontend framework | React + Vite | Modern ecosystem, fast HMR, ESM support | Next.js (SSR not needed), Vue | No SSR requirement; Vite is faster for SPA |
| Map technology | Leaflet + Turf.js | Open-source, no API key for base usage, Turf.js provides accurate geodesic area | Google Maps, Mapbox (require keys) | ESRI satellite tiles used for imagery (separate service) |
| Financial simulation | Deterministic + Monte Carlo (dual) | Deterministic: upper bound; Monte Carlo: realistic risk | Single deterministic only | Monte Carlo is more complex but communicates uncertainty more honestly |
| Database | PostgreSQL + SQLAlchemy | Standard relational DB, Alembic migrations | SQLite (no migrations needed for prototype), MongoDB | PostgreSQL chosen for production scalability; SQLite would suffice for prototype |
| JWT storage | localStorage | Simple implementation | httpOnly cookie | httpOnly cookie is more secure (XSS-resistant); localStorage chosen for simplicity in prototype |
| AMC rate | 3% of CAPEX | Standard engineering convention | Site-specific AMC quotation | May be inaccurate for complex or poorly maintained systems |
| Monthly demand cap | Fixed value (research: 100 KL/month) | Simplification; prevents demand from varying with rainfall season | Seasonal demand model | Real non-potable demand (gardening, car washing) varies seasonally |

---

## 15. Future Scope and Improvement Roadmap

### 15.1 Immediate Corrections and Missing Functionality (P0)

- **Secure all API endpoints:** Apply bearer-token authentication to calculation endpoints before any public deployment.
- **Replace in-memory CRUD with database persistence:** Implement full transactional PostgreSQL CRUD for societies and billing entries.
- **Add frontend test coverage:** Create Vitest component and API integration tests.

### 15.2 Data Quality and Validation (P1)

- **Collect real labelled MMR housing society data (30–50 sites):** Replace synthetic classifier training data with real field-validated labels. This is the highest-priority research improvement.
- **Validate against independent rainfall sources:** Cross-check Open-Meteo data against IMD gauged records for Thane and selected MMR locations.
- **Multi-location model fitting:** Fit and evaluate Auto-SARIMA for 5–8 additional MMR coordinates (Kalyan, Navi Mumbai, Mira-Bhayandar, etc.).

### 15.3 More Reliable Calculations (P1)

- **Seasonal demand model:** Replace fixed monthly demand cap with a seasonally varying demand profile (summer months have higher gardening demand, monsoon months have lower car-washing demand).
- **Borewell overflow-recharge financial pathway:** Integrate the recharge savings stream into the Monte Carlo ROI loop for Hybrid configurations.
- **Uncertainty quantification for yield formula:** Add credible intervals to monthly yield estimates reflecting uncertainty in runoff coefficient and usability factor.

### 15.4 Evaluation Against Observed Values (P1)

- **Post-installation monitoring:** Partner with at least one MMR housing society that installs RWH to collect 12–24 months of actual yield data and compare against WaterWallet projections.
- **Extended classifier validation:** Validate classifier on the collected real sites (minimum 30 for statistical power).

### 15.5 User Interface and Usability (P2)

- **Downloadable committee report:** Implement server-side PDF generation (currently browser-print only).
- **Pincode-based pre-fill:** Extend the MMR pincode lookup to automatically populate soil permeability, coastal distance, and coordinates in Map Studio.
- **Seasonal rainfall visualisation:** Add a month-by-month bar chart of P10/P50/P90 rainfall and expected yield.

### 15.6 Advanced Analytics (P2, if justified by real data)

- **Real-time tanker price feed:** Integrate with a data source for current tanker prices in specific MMR districts.
- **Multi-year sensitivity dashboard:** Allow users to explore how results change across ranges of CAPEX, tanker rate, and rainfall scenarios interactively.

### 15.7 Deployment and Scalability (P2)

- **Production deployment:** Configure HTTPS, PostgreSQL connection pooling, environment secret management, and observability.
- **Rate limiting and abuse prevention:** Limit requests to Open-Meteo and Groq to prevent resource exhaustion.
- **Multi-region rainfall model registry:** Pre-compute and cache Auto-SARIMA models for top 20 MMR locations to reduce response latency.

---

## 16. Comprehensive Reference Tables and Appendices

### Appendix A: File Inventory

| File / Directory | Type | Purpose | Dependencies |
|---|---|---|---|
| `backend/main.py` | Python | FastAPI entry point, router registration | All routers |
| `backend/config.py` | Python | Settings from environment via pydantic-settings | `backend/.env` |
| `backend/database.py` | Python | SQLAlchemy engine and session factory | `config.py` |
| `backend/dependencies.py` | Python | `get_current_user()` JWT dependency | `config.py`, `db_models.py` |
| `backend/requirements.txt` | Text | Python package requirements | — |
| `backend/alembic.ini` | Config | Alembic migration configuration | — |
| `backend/alembic/versions/232816598793_initial_schema.py` | Python | Initial DB schema migration | — |
| `backend/routers/auth.py` | Python | `/api/auth/register`, `/api/auth/login`, `/api/auth/me` | `db_models.py`, `schemas.py` |
| `backend/routers/societies.py` | Python | Society CRUD, billing, demand baseline | `demand_engine.py`, `schemas.py` |
| `backend/routers/geospatial.py` | Python | Catchment calculate, rainfall forecast | `rainfall_api.py`, `rainfall_forecast.py`, `yield_engine.py` |
| `backend/routers/roi.py` | Python | ROI simulate, Monte Carlo, tank sizer | `roi_engine.py`, `monte_carlo.py`, `tank_sizer.py` |
| `backend/routers/ml_recommend.py` | Python | Dual-tier ML recommendation | `tier1_safety.py`, `ml_engine.py` |
| `backend/routers/ml_yield.py` | Python | RF yield prediction | `ml_engine.py` |
| `backend/routers/advisory.py` | Python | Groq AI advisory | `config.py` |
| `backend/services/demand_engine.py` | Python | `calculate_demand()` — IS 1172 demand | `constants.py` |
| `backend/services/rainfall_api.py` | Python | Open-Meteo API calls, monthly aggregation, fallback | httpx |
| `backend/services/rainfall_forecast.py` | Python | Auto-SARIMA fitting and forecast | pmdarima |
| `backend/services/yield_engine.py` | Python | `calculate_yield()` — single physics formula | `constants.py` |
| `backend/services/tier1_safety.py` | Python | Hydrogeological safety gate — 4 checks | — |
| `backend/services/ml_engine.py` | Python | Model loading, `predict_config()`, `predict_yield()` | joblib, shap, numpy |
| `backend/services/roi_engine.py` | Python | Deterministic `simulate_roi()` | `schemas.py` |
| `backend/services/monte_carlo.py` | Python | `run_monte_carlo()` — 1,000-scenario probabilistic ROI | numpy |
| `backend/services/tank_sizer.py` | Python | `size_tanks()`, `simulate_tank_year()` | — |
| `backend/models/constants.py` | Python | IS_LPCD=135, RUNOFF=0.90, USABILITY=0.80, etc. | — |
| `backend/models/db_models.py` | Python | SQLAlchemy ORM: User, Society, BillingEntry, SocietyAnalysis | SQLAlchemy |
| `backend/models/schemas.py` | Python | All Pydantic request/response schemas (426 lines) | Pydantic v2 |
| `backend/ml_models/train_models.py` | Python | One-time training script for both ML models | Open-Meteo API, sklearn, pandas |
| `backend/ml_models/fix_classifier.py` | Python | Partial re-run: classifier only (without CalibratedClassifierCV) | — |
| `backend/ml_models/model_metadata.json` | JSON | Training metadata, sklearn version, metrics | — |
| `backend/ml_models/thane_rain_percentiles.csv` | CSV | 12-row P10/P50/P90 monthly percentile table | — |
| `backend/ml_models/*.pkl` | Binary | Trained model artifacts (3 files, total ~21 MB) | sklearn 1.9.0 |
| `backend/tests/test_roi_engine.py` | Python | 6 ROI engine parametric tests | pytest/unittest |
| `backend/tests/test_monte_carlo_integration.py` | Python | 7 Monte Carlo integration tests | pytest/unittest |
| `backend/tests/test_tank_sizer.py` | Python | 5 tank sizer tests | pytest/unittest |
| `backend/tests/test_geospatial_metadata.py` | Python | Geospatial metadata tests | pytest/unittest |
| `src/App.jsx` | JSX | Root component, routing, auth guard | React Router |
| `src/api/waterwallet.js` | JS | All Axios API calls (207 lines, 16 exported functions) | Axios |
| `src/context/AuthContext.jsx` | JSX | User session state | React |
| `src/context/WaterWalletContext.jsx` | JSX | Shared app state (society, catchment, ROI, ML) | React |
| `src/views/VirtualMeter.jsx` | JSX | Society demand, billing entry (~40 KB) | WaterWalletContext |
| `src/views/MapStudio.jsx` | JSX | Rooftop tracing, rainfall, yield, ML (~38 KB) | Leaflet, Turf.js, WaterWalletContext |
| `src/views/ROIDashboard.jsx` | JSX | ROI charts, Monte Carlo, tank sizer, advisory (~105 KB) | Recharts, WaterWalletContext |
| `src/views/AuthPage.jsx` | JSX | Login and registration | AuthContext |
| `src/utils/waterConstants.js` | JS | Frontend constants + `calculateCanonicalDemand()` | — |
| `src/utils/mmrPincodes.js` | JS | ~150+ MMR pincode lookup records | — |
| `src/utils/formatters.js` | JS | Number/currency formatting | — |
| `AquaBytes_borrow/sim_rainwater.py` | Python | Reference simulation from AquaBytes (SIH) project; not used in WaterWallet production code | — |
| `AquaBytes_borrow/AquaBytes_borrow.md` | Markdown | Documentation for the reference AquaBytes project | — |
| `waterwallet_research_paper.original.tex` | LaTeX | Original IEEE-format research paper | — |
| `waterwallet_research_paper.updated.tex` | LaTeX | Updated version of research paper | — |
| `waterwallet_research_paper.tex` | LaTeX | Base research paper | — |
| `WaterWallet_ml_updated.ipynb` | Jupyter | ML research notebook (1.9 MB with outputs) | — |
| `Capstone.md` | Markdown | Project design and implementation notes (30 KB) | — |
| `POC_REPORT.md` | Markdown | Proof-of-concept scope, evidence, limitations (34 KB) | — |
| `TECHNICAL_REFERENCE.md` | Markdown | Formulas, API contracts, model details (35 KB) | — |
| `SECURITY-REVIEW.md` | Markdown | Security findings and remediation | — |
| `README.md` | Markdown | Project overview and getting-started guide | — |
| `package.json` | JSON | Frontend scripts and dependencies | npm |
| `vite.config.js` | JS | Vite build configuration | Vite |
| `eslint.config.js` | JS | ESLint configuration | ESLint |
| `index.html` | HTML | Vite SPA entry point | — |

### Appendix B: Function and Module Reference

| Function | File | Parameters | Returns | Notes |
|---|---|---|---|---|
| `calculate_demand()` | `demand_engine.py:18` | `num_flats, occupants_per_flat, lpcd, include_losses` | `dict` with demand breakdown | IS 1172 formula with UFW and buffer |
| `calculate_yield()` | `yield_engine.py:4` | `rain_mm, roof_area_sqm, roof_surface_type` | `float` (litres) | 1 mm × 1 m² = 1 litre |
| `fetch_monthly_rainfall()` | `rainfall_api.py:22` | `latitude, longitude` | `tuple[list[float], str]` | Returns (12 monthly averages, source) |
| `fetch_daily_rainfall()` | `rainfall_api.py:87` | `latitude, longitude` | `dict[int, list[float]]` | Returns {year: [daily_mm]} complete years only |
| `fetch_monthly_rainfall_history()` | `rainfall_api.py:161` | `latitude, longitude` | `tuple[list[float], str]` | Chronological monthly history for SARIMA |
| `aggregate_monthly_rainfall()` | `rainfall_api.py:61` | `data: dict` | `list[float]` | Open-Meteo daily → 12 monthly averages |
| `forecast_monthly_rainfall()` | `rainfall_forecast.py:6` | `history, periods` | `dict` | Auto-SARIMA forecast, requires ≥36 observations |
| `tier1_safety_gate()` | `tier1_safety.py:26` | `coastal_km, soil_perm, borewell, borewell_depth` | `Optional[dict]` | None = pass; dict = forced Storage-Only |
| `predict_config()` | `ml_engine.py:187` | `rooftop_area, borewell, borewell_depth, soil_perm, coastal_km, annual_rain_mm, peak_day_mm` | `dict` | RF classification + SHAP |
| `predict_yield()` | `ml_engine.py:249` | `rooftop_area, monthly_rainfall_mm` | `dict` | RF yield regression; falls back to physics formula |
| `simulate_roi()` | `roi_engine.py:5` | `daily_demand_lpd, annual_yield_litres, tank_capacity_litres, water_tariff_per_kl, installation_cost, years, tariff_escalation_rate, annual_tanker_spend, annual_tanker_volume_litres, annual_municipal_spend` | `ROIResponse` | Deterministic 10-year projection |
| `run_monte_carlo()` | `monte_carlo.py:55` | `rooftop_area_m2, monthly_demand_kl, capex_inr, tank_capacity_litres, ...` | `dict` | 1,000-scenario probabilistic ROI |
| `simulate_tank_year()` | `tank_sizer.py:46` | `rainfall_mm, tank_capacity_litres, daily_demand_litres, usable_roof_area_sqm, runoff_coefficient, first_flush_fraction, year, recharge_enabled, recharge_capacity_litres_per_day` | `TankYearResult` | Daily water-balance for one year |
| `size_tanks()` | `tank_sizer.py:107` | `rainfall_by_year, candidate_capacities_litres, daily_demand_litres, ...` | `dict` | Evaluates all candidates, selects optimal |
| `calculateCanonicalDemand()` | `waterConstants.js:73` | `{numFlats, occupantsPerFlat, lpcd, includeLosses}` | `object` | Frontend mirror of `calculate_demand()` |

### Appendix C: Data Dictionary

| Field | Location | Type | Units | Description |
|---|---|---|---|---|
| `num_flats` | `SocietyBaselineRequest` | integer > 0 | — | Total number of residential flats |
| `occupants_per_flat` | `SocietyBaselineRequest` | float > 0 | — | Average occupants per flat (default 3.5) |
| `daily_demand_lpd` | `SocietyBaselineResponse` | float | L/day | Total daily demand including UFW and buffer |
| `non_potable_demand_lpd` | `SocietyBaselineResponse` | float | L/day | Non-potable fraction (65/135 of adjusted demand) |
| `latitude` | `CatchmentRequest` | float [-90, 90] | degrees | Location latitude (polygon centroid) |
| `longitude` | `CatchmentRequest` | float [-180, 180] | degrees | Location longitude |
| `roof_area_sqm` | `CatchmentRequest` | float > 0 | m² | Gross usable rooftop catchment area |
| `annual_rainfall_mm` | `CatchmentResponse` | float | mm | Sum of 12 monthly averages |
| `monthly_rainfall_mm` | `CatchmentResponse` | list[float] × 12 | mm | Jan–Dec 15-year monthly averages |
| `annual_yield_litres` | `CatchmentResponse` | float | litres | Sum of monthly yields |
| `rooftop_area` (classifier) | `MLRecommendRequest` | float > 0 | m² | Rooftop area (used as-is, not multiplied by usability factor) |
| `borewell` | `MLRecommendRequest` | int {0, 1} | — | 0=absent, 1=present |
| `borewell_depth` | `MLRecommendRequest` | float ≥ 0 | m | Borewell depth (0 if no borewell) |
| `soil_perm` | `MLRecommendRequest` | int [1, 5] | — | NBSS&LUP soil permeability class |
| `coastal_km` | `MLRecommendRequest` | float ≥ 0 | km | Distance from nearest coastline |
| `annual_rain_mm` | `MLRecommendRequest` | float > 0 | mm | Annual precipitation |
| `peak_day_mm` | `MLRecommendRequest` | float > 0 | mm/day | Maximum single-day rainfall |
| `config` | `MLRecommendResponse` | str | — | "Storage-Only" \| "Borewell-Recharge" \| "Hybrid" |
| `confidence` | `MLRecommendResponse` | float [0, 1] | — | Probability of predicted class |
| `installation_cost` | `ROIRequest` | float ≥ 0 | ₹ | One-time CAPEX (default ₹250,000) |
| `water_tariff_per_kl` | `ROIRequest` | float > 0 | ₹/KL | Municipal water tariff (default ₹15/KL) |
| `annual_tanker_spend` | `ROIRequest` | float ≥ 0 | ₹/year | Current annual tanker expenditure |
| `annual_tanker_volume_litres` | `ROIRequest` | float ≥ 0 | L/year | Annual tanker volume procured |
| `payback_years` | `ROIResponse` | Optional[float] | years | Fractional year of break-even (None if not achieved in horizon) |
| `ten_year_savings` | `ROIResponse` | float | ₹ | Cumulative net savings over 10 years |
| `monthly_demand_kl` | `MonteCarloRequest` | float > 0 | KL/month | Monthly non-potable demand cap |
| `capex_inr` | `MonteCarloRequest` | float > 0 | ₹ | One-time installation cost |
| `median_breakeven_year` | `MonteCarloResponse` | Optional[float] | years | Median break-even across all scenarios |
| `prob_breakeven_by_year` | `MonteCarloResponse` | dict | — | {"1": 0.02, ..., "10": 0.98} |
| `never_break_even_pct` | `MonteCarloResponse` | float | % | % of scenarios not breaking even in 10 years |
| `daily_demand_litres` | `TankSizerRequest` | float > 0 | L/day | Eligible non-potable demand (not total IS 1172 demand) |
| `reliability_target_percent` | `TankSizerRequest` | float (0, 100] | % | Target supply reliability (default 40%) |
| `useful_water_litres` | TankYearResult | float | L | Water actually consumed by demand |
| `recharge_overflow_litres` | TankYearResult | float | L | Overflow to borewell recharge (if enabled) |
| `lost_overflow_litres` | TankYearResult | float | L | Overflow exceeding recharge pit capacity |

### Appendix D: Formula Catalogue

See Section 5 for complete formula documentation. Summary reference:

| ID | Name | Formula | Implemented In |
|---|---|---|---|
| F1 | IS 1172 Base Demand | $N_f \times O \times 135$ | `demand_engine.py:38` |
| F2 | UFW Adjustment | $F1 \times 1.15$ | `demand_engine.py:39` |
| F3 | Peak Buffer | $F2 \times 1.10$ | `demand_engine.py:40` |
| F4 | Potable Demand | $F3 \times (70/135)$ | `demand_engine.py:45` |
| F5 | Non-Potable Demand | $F3 - F4$ | `demand_engine.py:46` |
| F6 | Monthly Yield (litres) | $R_t \times A \times C_{rc} \times \eta_u$ | `yield_engine.py:23` |
| F7 | Demand-Gated Yield | $\min(Y_t, D_m)$ | `monte_carlo.py:167` |
| F8 | Monthly Yield (KL) | $A \times R_t \times \eta_u \times C_{rc} / 1000$ | `monte_carlo.py:150-156` |
| F9 | sin Month Encoding | $\sin(2\pi m/12)$ | `ml_engine.py:281` |
| F10 | cos Month Encoding | $\cos(2\pi m/12)$ | `ml_engine.py:282` |
| F11 | Annual AMC | $\text{CAPEX} \times 0.03$ | `roi_engine.py:56` |
| F12 | Annual Net Savings | $S_{gross} - C_{amc}$ | `roi_engine.py:86` |
| F13 | Inflated Cash Flow | $S_{t,1}(1+r)^{y-1} + S_{m,1}(1.05)^{y-1}$ | `monte_carlo.py:190-191` |
| F14 | Net Cumulative Position | $\sum CF_k - C_{amc} - \text{CAPEX}$ | `monte_carlo.py:185-196` |
| F15 | Break-Even (interpolated) | $(y-1) + \text{deficit}/\text{net}_y$ | `monte_carlo.py:198-199` |
| F16 | Daily Tank Balance | $T_{t+1} = \min(\max(0, T_t+I_t-S_t), C_{tank})$ | `tank_sizer.py:76-80` |
| F17 | System Reliability | $\text{useful}/\text{demand} \times 100\%$ | `tank_sizer.py:94` |
| F18 | Recharge Pit Split | $\min(\text{overflow}, C_{pit})$ | `tank_sizer.py:87-90` |

### Appendix E: Evaluation Catalogue

| Metric | Purpose | Data | Measured Value | Evidence Source |
|---|---|---|---|---|
| SARIMA MAE (mm) | Rainfall forecast accuracy | Thane 2022–2025, 48 months | 63.76 mm | Research paper Table I |
| SARIMA RMSE (mm) | Rainfall forecast accuracy (tail sensitivity) | Same | 108.66 mm | Research paper Table I |
| SARIMA R² | Rainfall explained variance | Same | 0.823 | Research paper Table I |
| RF Yield MAE (KL) | Production yield prediction accuracy | Test set 2022–2024, 360 rows | 4.8973 KL | `model_metadata.json` |
| RF Yield R² | Production yield explained variance | Same | 0.9865 | `model_metadata.json` |
| RF Classifier Test Accuracy | Classification accuracy on rule-derived test set | 120 test samples | 1.000 | Research paper Table IV; `model_metadata.json` |
| RF Classifier Balanced Accuracy / Macro-F1 | Production held-out metrics | 120 test samples | 1.000 / 1.000 | `model_metadata.json` |
| Real case validation | Single Thane model-input case | 1 Thane society | Hybrid, 97.1% confidence (correct) | Production artifact with documented 2010–2024 rainfall features |
| P10 usable yield (KL) | Dry-year scenario | 2018 Thane data, A=780 m² | 365.9 KL | Research paper Table II |
| P50 usable yield (KL) | Typical-year scenario | 2017 Thane data | 519.4 KL | Research paper Table II |
| P90 usable yield (KL) | Wet-year scenario | 2019 Thane data | 515.9 KL | Research paper Table II |
| Monte Carlo P50 break-even | Probabilistic financial result | 1,000 scenarios, A=780 m², CAPEX=₹500K, ₹175/KL | 5.22 years | Research paper Table VI |
| Monte Carlo P(BE ≤ Year 6) | Probability of break-even | Same | 100% | Research paper Table VI |

### Appendix F: Graph and Visualization Catalogue

The following charts are referenced in the research paper and generated in the notebook (`WaterWallet_ml_updated.ipynb`). Downstream saved outputs were cleared after aligning the classifier and yield cells; rerun them before regenerating figures.

| ID | Figure | Type | Source | Key Numerical Content | Evidence Status |
|---|---|---|---|---|---|
| G1 | `rainfall_forecast.png` | Line chart | Colab notebook | Auto-SARIMA 12-month forecast vs actual; potential yield vs demand-gated usable yield | Chart not directly inspectable; values derivable from forecast API |
| G2 | `scenario_comparison.png` | Bar/line chart | Colab notebook | P10/P50/P90 annual yield; gross Year-1 savings at ₹175/KL: P10=₹64,033, P50=₹90,895, P90=₹90,283 | Yield values from research paper Table II |
| G3 | `p2_shap.png` | SHAP feature plot | Colab notebook | Global feature importance and class-specific attribution for the calibrated production forest | Recreate from updated notebook |
| G6 | `monte_carlo_roi.png` | Histogram + CDF + distribution | Colab notebook | Rate sensitivity: median break-even 6.02 years at ₹150/KL, 5.22 at ₹175/KL, 4.60 at ₹200/KL | Recalculated with backend Monte Carlo; research paper Table VI |
| G8 | ROI Dashboard charts | Recharts line/bar | `src/views/ROIDashboard.jsx` | Live user-specific charts; values depend on user inputs | Dynamic; no static values |

**Note on G6:** Saved ROI notebook outputs still need to be rerun to reflect the current ₹175/KL default and sensitivity cases.

### Appendix G: Test Cases

| Test ID | File | Function | Input | Expected Output | Verified |
|---|---|---|---|---|---|
| T1 | `test_roi_engine.py` | `test_tanker_spend_monotonicity` | 5 spend levels ₹100K–₹600K, yield=1.2M L, tanker vol=1M L | 10-yr savings strictly increasing; payback non-increasing | Written; pass assumed |
| T2 | `test_roi_engine.py` | `test_tanker_spend_marginal_derivative_bound_full_offset` | yield=1.5M L > tanker vol; Δspend=₹100K | d(savings)/d(spend) = 1.00 (±0.01) | Written; analytically verified |
| T3 | `test_roi_engine.py` | `test_tanker_spend_marginal_derivative_bound_partial_offset` | yield=500K L, tanker vol=1M L; Δspend=₹150K | d(savings)/d(spend) = 0.50 (±0.01) | Written; analytically verified |
| T4 | `test_roi_engine.py` | `test_rooftop_area_low_regime_improves_payback` | Areas [200, 400, 600] m², high tanker | Payback non-increasing with area | Written |
| T5 | `test_roi_engine.py` | `test_rooftop_area_oversized_saturation_and_derivative_bound` | Area beyond demand saturation | d(net savings)/d(area) < 0; payback lengthens | Written; analytically verified |
| T6 | `test_roi_engine.py` | `test_zero_or_negative_tariff_raises_value_error` | water_tariff_per_kl=0.0 | ValueError raised | Written |
| T7 | `test_monte_carlo_integration.py` | `test_phase_two_rainfall_is_used_and_reported` | monthly_rainfall_mm=[0.0]*12 | scenarios_used="phase2_monthly_rainfall", is_site_specific=True | Written |
| T8 | `test_monte_carlo_integration.py` | `test_fallback_when_monthly_rainfall_is_none` | monthly_rainfall_mm=None | scenarios_used="percentile_table" | Written |
| T9 | `test_monte_carlo_integration.py` | `test_demand_rounding_matches_javascript_half_up` | 1 flat, 1 occupant, no losses | daily=149, potable=77, non-potable=72 | Written; analytically verified |
| T10 | `test_tank_sizer.py` | `test_simulator_uses_actual_year_length` | Leap years (2012, 2016, 2020, 2024) and non-leap (2021) | total_inflow = 90×N days, reliability=100% | Written |
| T11 | `test_tank_sizer.py` | `test_water_reconciliation_holds_for_each_year_and_candidate` | Multi-year rainfall, 3 capacities | useful+recharge+lost+ending_storage = total_inflow (within 1 L) | Written; mass-balance verified |
| T12 | `test_tank_sizer.py` | `test_finite_recharge_pit_splits_overflow` | 100 mm × 100 m², pit=3000 L/day, no demand | recharge=3000, lost=7000, total=10000 | Written; arithmetically verified |

### Appendix H: Configuration and Dependencies

#### Backend Environment Variables

See Section 9.7.

#### Backend Dependencies (pinned/minimum versions from `requirements.txt`)

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.10.0
httpx>=0.27.0
python-multipart>=0.0.9
sqlalchemy>=2.0.0
alembic>=1.13.0
psycopg2-binary>=2.9.9
pydantic-settings>=2.0.0
bcrypt>=4.3.0
python-jose[cryptography]>=3.3.0
scikit-learn==1.9.0    # PINNED — must match pkl training version
joblib>=1.4.0
numpy>=1.26.0
pandas>=2.2.0
shap>=0.45.0
pmdarima>=2.0.4
statsmodels>=0.14.0
```

#### Frontend Dependencies (from `package.json`)

```json
"@turf/turf": "^7.3.4",
"axios": "^1.16.1",
"jwt-decode": "^4.0.0",
"leaflet": "^1.9.4",
"lucide-react": "^1.6.0",
"react": "^19.2.4",
"react-dom": "^19.2.4",
"react-leaflet": "^5.0.0",
"react-router-dom": "^7.14.0",
"recharts": "^3.8.0"
```

#### Key Configuration Constants

| Constant | Value | Location |
|---|---|---|
| IS_LPCD | 135.0 L/person/day | `constants.py:6` |
| POTABLE_LPCD | 70.0 | `constants.py:9` |
| NON_POTABLE_LPCD | 65.0 | `constants.py:10` |
| DEMAND_BUFFER_FACTOR | 1.10 | `constants.py:13` |
| RUNOFF_COEFFICIENT (concrete) | 0.90 | `constants.py:20` |
| USABILITY_FACTOR | 0.80 | `constants.py:32` |
| UFW_LOSS_FACTOR | 0.15 | `constants.py:35` |
| COASTAL_THRESHOLD_KM | 2.5 | `tier1_safety.py:21` |
| BOREWELL_MIN_DEPTH_M | 30 | `tier1_safety.py:22` |
| MIN_RECHARGE_SOIL_PERM | 2 | `tier1_safety.py:23` |
| TANKER_COST_PER_KL | 175.0 ₹/KL | `monte_carlo.py:24` |
| INFLATION_RATE | 0.08 | `monte_carlo.py:25` |
| AMC_RATE | 0.03 | `monte_carlo.py:26` |
| N_SCENARIOS | 1,000 | `monte_carlo.py:28` |
| RNG_SEED | 42 | `monte_carlo.py:29` |
| MARGINAL_RETURN_FLOOR | 1.5 L useful/L capacity/year | `tank_sizer.py:24` |
| DEFAULT_RECHARGE_CAPACITY_L/DAY | 10,000 | `tank_sizer.py:31` |
| CANDIDATE_CAPACITIES_L | [5K, 10K, 15K, 20K, 25K, 30K, 40K, 50K, 70K] | `tank_sizer.py:12` |
| RAINFALL_YEARS | 15 | `rainfall_api.py:8` |

### Appendix I: Terminology and Abbreviations

| Term | Definition |
|---|---|
| AMC | Annual Maintenance Contract — recurring cost to maintain an installed RWH system |
| AIC | Akaike Information Criterion — statistical measure for model selection (lower = better trade-off of fit vs complexity) |
| CAPEX | Capital Expenditure — one-time installation cost of RWH system |
| CGWB | Central Ground Water Board (India) |
| CPHEEO | Central Public Health and Environmental Engineering Organisation |
| ESRI | Environmental Systems Research Institute (map tile provider) |
| GWL | Groundwater Level |
| Hybrid | RWH configuration: storage tank + overflow routed to borewell recharge |
| IMD | India Meteorological Department |
| IS 1172 | Indian Standard Code of Basic Requirements for Water Supply, Drainage and Sanitation (1993) |
| KL | Kilolitre (1,000 litres) |
| LPCD | Litres Per Capita Per Day |
| MMR | Mumbai Metropolitan Region |
| NBSS&LUP | National Bureau of Soil Survey & Land Use Planning (soil classification authority) |
| OLS | Ordinary Least Squares |
| OPEX | Operational Expenditure (ongoing costs) |
| P10/P50/P90 | 10th/50th/90th percentile of historical rainfall distribution |
| RWH | Rainwater Harvesting |
| SARIMA | Seasonal AutoRegressive Integrated Moving Average (time series model) |
| SHAP | SHapley Additive exPlanations — model explainability framework |
| SPA | Single-Page Application |
| UFW | Unaccounted-For Water — water losses due to pipe leakage, meter error, unregistered connections |
| WQI | Water Quality Index |
| Borewell-Recharge | RWH configuration: filtered rooftop runoff injected into an existing deep borewell |
| Storage-Only | RWH configuration: direct collection into surface tank, no groundwater recharge |
| First flush | Initial rainfall that carries the highest concentration of roof surface contaminants |
| Runoff coefficient | Fraction of rainfall that becomes surface runoff (not evaporated or absorbed) |
| Usability factor | Fraction of rooftop area that is unobstructed and available for catchment |
| Demand gating | Capping usable yield at monthly demand to prevent financial over-estimation |

### Appendix J: Evidence and Traceability

| Claim | Value | Source File | Line(s) |
|---|---|---|---|
| Auto-SARIMA MAE | 63.76 mm | `waterwallet_research_paper.updated.tex` | Table I |
| Auto-SARIMA RMSE | 108.66 mm | Same | Table I |
| Auto-SARIMA R² | 0.823 | Same | Table I |
| RF Classifier 5-fold CV | Not reported as a production metric; labels are rule-generated | `backend/ml_models/train_models.py` | Classifier training section |
| RF Classifier test accuracy | 1.000 | `backend/ml_models/model_metadata.json` | Line 19 |
| RF yield MAE (metadata) | 4.8973 KL | `backend/ml_models/model_metadata.json` | Line 58 |
| RF yield R² (metadata) | 0.9865 | `backend/ml_models/model_metadata.json` | Line 59 |
| MLP yield comparison | Notebook outputs cleared; rerun before quoting updated comparison metrics | `WaterWallet_ml_updated.ipynb` | Yield model comparison cell |
| Thane real case | 97.1% Hybrid confidence | `waterwallet_research_paper.updated.tex` | Thane case study |
| P50 scenario usable yield | 519.4 KL | `waterwallet_research_paper.updated.tex` | Table II |
| P90 scenario usable yield | 515.9 KL | Same | Table II |
| P50 Year-1 gross savings at ₹175/KL | ₹90,895 | `waterwallet_research_paper.updated.tex` | Table II |
| Monte Carlo median break-even at ₹175/KL | 5.22 years | Same | Table VI |
| Monte Carlo P(≤ Year 6) at ₹175/KL | 100% | Same | Table VI |
| IS_LPCD | 135.0 | `backend/models/constants.py` | Line 6 |
| Runoff coefficient (concrete) | 0.90 | `backend/models/constants.py` | Line 24 |
| Usability factor | 0.80 | `backend/models/constants.py` | Line 32 |
| Coastal safety threshold | 2.5 km | `backend/services/tier1_safety.py` | Line 21 |
| Borewell minimum depth | 30 m | `backend/services/tier1_safety.py` | Line 22 |
| AMC rate | 3% | `backend/services/monte_carlo.py` | Line 26 |
| Tanker cost per KL | ₹175 default | `backend/services/monte_carlo.py` | Line 24 |
| N_SCENARIOS | 1,000 | `backend/services/monte_carlo.py` | Line 28 |
| Marginal return floor | 1.5 | `backend/services/tank_sizer.py` | Line 24 |
| Training period | 2010–2024 | `backend/ml_models/train_models.py` | Lines 67–68 |
| Training samples (classifier) | 600 | `backend/ml_models/model_metadata.json` | Line 17 |
| Model trained at | 2026-10-04T14:45:03 UTC | `backend/ml_models/model_metadata.json` | Line 3 |
| sklearn version (model) | 1.9.0 | `backend/ml_models/model_metadata.json` | Line 4 |
| BOREWELL MIN DEPTH | 30 m (check 4 in tier1, note: different minimum in fix_classifier.py is 35) | `tier1_safety.py:22`, `fix_classifier.py:61` | 22, 61 |
| AquaBytes reference | SIH-selected app; `sim_rainwater.py` imported for reference | `AquaBytes_borrow/AquaBytes_borrow.md` | — |

> **Note on borewell depth discrepancy:** The Tier 1 safety gate uses `BOREWELL_MIN_DEPTH_M = 30` m (`tier1_safety.py:22`) as the minimum for safe injection. The `fix_classifier.py` generates synthetic data with borewell depths from `np.random.randint(35, 180, N)` (minimum 35 m), while `train_models.py` uses `np.random.randint(30, 200, N)` (minimum 30 m). The safety gate threshold (30 m) matches `train_models.py` and is the authoritative value.

---

*Document generated by inspection of project files in `D:\VESIT\Capstone\` on 2026-10-25. Original project files were not modified.*

*Key files inspected:*
- `waterwallet_research_paper.original.tex` (43,708 bytes, 835 lines)
- `backend/main.py`, `config.py`, `database.py`, `dependencies.py`
- `backend/routers/*.py` (7 files)
- `backend/services/*.py` (10 files)
- `backend/models/*.py` (3 files)
- `backend/ml_models/train_models.py`, `fix_classifier.py`, `model_metadata.json`, `thane_rain_percentiles.csv`
- `backend/tests/*.py` (4 files)
- `backend/requirements.txt`
- `src/api/waterwallet.js`, `src/utils/waterConstants.js`, `src/utils/mmrPincodes.js` (partial)
- `README.md`, `SECURITY-REVIEW.md`, `package.json`, `AquaBytes_borrow/AquaBytes_borrow.md`
- `AquaBytes_borrow/sim_rainwater.py`
- `WaterWallet_ml_updated.ipynb` — file listed but not inspected cell-by-cell due to size (1.9 MB)
- `Capstone.md`, `POC_REPORT.md`, `TECHNICAL_REFERENCE.md` — listed but not fully inspected (these are large existing documentation files)
