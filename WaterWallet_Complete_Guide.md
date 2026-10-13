# WaterWallet — Complete Project Guide
### A Physics-Informed ML Decision-Support System for Rainwater Harvesting
**VESIT Capstone 2025–26 | Department of Computer Engineering**  
**Project Guide:** Dr. Mrs. Gresha Bhatia, Dr. Mrs Saylee Gharge
**Team Members:** Nidhish Shirur · Neha Bhatia · Diksha Bagwe  

---

## Table of Contents

1. [Executive Summary & Project Overview](#1-executive-summary--project-overview)
2. [Technology Stack & Environment](#2-technology-stack--environment)
3. [System Architecture & End-to-End Data Flow](#3-system-architecture--end-to-end-data-flow)
4. [Repository Directory Structure & File Manifest](#4-repository-directory-structure--file-manifest)
5. [Complete Feature Walkthrough & User Journey](#5-complete-feature-walkthrough--user-journey)
   - [Authentication & Session Handling](#step-0--authentication--session-handling)
   - [Phase 1: Virtual Meter](#phase-1--virtual-meter-demand--billing-analysis)
   - [Phase 2: Map Studio](#phase-2--map-studio-catchment--rainfall-intelligence)
   - [Phase 3: ROI Dashboard & Decision Engine](#phase-3--roi-dashboard--decision-engine)
   - [Complete End-to-End Case Study Walkthrough](#complete-end-to-end-case-study-walkthrough)
6. [Engineering Standards, Physics Formulas & Calculations](#6-engineering-standards-physics-formulas--calculations)
7. [Machine Learning, Deep Learning & Analytics Layer](#7-machine-learning-deep-learning--analytics-layer)
   - [Dual-Tier RWH Configuration Recommendation](#task-1--dual-tier-rwh-configuration-recommendation)
   - [Dynamic Rainfall Forecasting (Auto-SARIMA)](#task-2--dynamic-rainfall-forecasting-auto-sarima)
   - [Monthly Harvestable Yield Prediction (Random Forest Regressor)](#task-3--monthly-harvestable-yield-prediction-rf-regressor)
   - [Probabilistic Monte Carlo ROI Simulation](#task-4--probabilistic-monte-carlo-roi-simulation)
   - [Daily Historical Water-Balance Tank Sizer](#task-5--daily-historical-water-balance-tank-sizer)
   - [ROI Sensitivity Analysis (Gradient Boosting + SHAP)](#task-6--roi-sensitivity-analysis-gradient-boosting--shap)
   - [Academic Deep Learning Evaluation (MLP Neural Network vs. RF)](#task-7--academic-deep-learning-evaluation-mlp-vs-random-forest)
   - [Model Artifacts & Actual Validated Metrics](#model-artifacts--actual-validated-metrics)
8. [Backend API Specifications & Pydantic Schemas](#8-backend-api-specifications--pydantic-schemas)
9. [Database Schema, Migrations & Persistence](#9-database-schema-migrations--persistence)
10. [Installation, Configuration & Execution Guide](#10-installation-configuration--execution-guide)
11. [Verification, Testing & Troubleshooting](#11-verification-testing--troubleshooting)
12. [Implementation Status, Honest Limitations & Future Scope](#12-implementation-status-honest-limitations--future-scope)

---

## 1. Executive Summary & Project Overview

### The Water Crisis in the Mumbai Metropolitan Region (MMR)
The Mumbai Metropolitan Region (comprising Mumbai City, Mumbai Suburban, Thane, Kalyan-Dombivli, and Navi Mumbai) receives intense monsoon precipitation — frequently between 2,000 mm and 2,600 mm of rainfall per year over the four-month monsoon period (June through September). Despite this meteorological abundance, hundreds of cooperative housing societies (CHS) face severe water shortages every dry season (March through June).

Because urban drainage networks route over 80% of urban runoff directly into drains, creeks, and the Arabian Sea, housing societies are left dependent on municipal water quotas that fail to satisfy non-potable demand. To bridge the deficit, societies purchase unregulated private water tanker deliveries.

### The Tanker Dependency & Economic Bleed
A typical residential cooperative housing society (e.g., 50 flats with 200 occupants) in Thane or suburban Mumbai spends:
- **₹2,00,000 to ₹5,00,000 annually** on private water tankers.
- Tanker water is priced at an extortionate **₹800 to ₹1,600 per 10,000-litre tanker** (₹80 to ₹160 per kilolitre), compared to subsidized municipal tariffs of ₹10 to ₹15 per kilolitre.
- Compounding private tanker inflation (historically 8% to 12% annually) drains society reserves by **₹30,00,000 to ₹50,00,000 over a 10-year horizon** without building any lasting infrastructure.

### The Decisional Barrier
Although the Brihanmumbai Municipal Corporation (BMC) and state urban development authorities have legally mandated Rainwater Harvesting (RWH) for plots exceeding 500 m² since 2007/2019, compliance remains below 15%. The primary bottleneck is **decisional friction**, not engineering feasibility:

1. **Information Asymmetry:** Volunteer managing committee members (secretaries, treasurers) lack civil engineering knowledge and cannot assess whether their site requires **Storage-Only**, **Borewell-Recharge**, or a **Hybrid** configuration.
2. **Deterministic Calculator Limitations:** Existing online RWH calculators assume fixed annual rainfall and deterministic paybacks, ignoring monsoon burst intensity, roof usability deductions, and seasonal overflow.
3. **Pre-Consultation Cost:** Engaging private hydrogeological consultants for feasibility studies costs ₹25,000 to ₹75,000 before the committee even decides whether to table a general body resolution.
4. **Risk Communication Failure:** Committees cannot quantify financial risks under drought or deficit rainfall conditions.

### The WaterWallet Solution & Core Philosophy
**WaterWallet** is a full-stack, zero-hardware, physics-informed decision-support platform designed specifically for residential housing societies in the MMR. A non-technical society secretary can sit down for 10 minutes, enter billing history, trace their building rooftop on high-resolution satellite imagery, and receive:

1. **A Site-Specific System Recommendation:** Classified as Storage-Only, Borewell-Recharge, or Hybrid via a dual-tier decision system combining hard hydrogeological safety gates with a calibrated Random Forest classifier.
2. **Transparent Explainability:** Plain-English feature attributions powered by TreeSHAP (e.g., *"Hybrid recommended because borewell presence, borewell depth (95 m), and rooftop area (960 m²) support this configuration"*).
3. **Probabilistic Risk-Adjusted ROI:** 10-year compounding multi-scenario cash flows combined with a 1,000-scenario Monte Carlo simulation sampling real historical rainfall distributions.
4. **Daily Water-Balance Tank Sizing:** Optimization across candidate storage capacities using 15 years of daily rainfall observations to balance capex against non-potable reliability targets.
5. **Grounded AI Advisory:** LLM-generated executive summaries and risk checklists powered by Groq, constrained strictly to validated application facts without hallucinated engineering guarantees.
6. **Executive Presentation Artifact:** In-browser generated printable PDF reports ready to table before managing committee meetings.

```
       Physics Layer (IS:1172, CPHEEO, Runoff Equations)
                          +
       Hydrological Safety (CGWB Coastal & Depth Gates)
                          +
       Machine Learning Layer (Auto-SARIMA, RF, TreeSHAP)
                          +
       Financial Engine (Deterministic & Monte Carlo ROI)
                          =
         WATERWALLET DECISION SUPPORT PLATFORM
```

> [!IMPORTANT]
> **Pre-Consultation Screening Boundary:** WaterWallet is a feasibility screening and decision-support tool. It empowers societies to evaluate feasibility and draft committee resolutions. It is not a substitute for stamped structural load assessments, civil engineering construction drawings, or regulatory BMC/CGWB approvals.

---

## 2. Technology Stack & Environment

WaterWallet is built on modern web and data-science technologies designed for performance, mathematical precision, and rapid interaction without hardware installation.

### Frontend Architecture
- **Framework & Runtime:** [React 19](file:///d:/VESIT/Capstone/package.json#L18) + [Vite 8](file:///d:/VESIT/Capstone/package.json#L35) (ES Modules, fast hot-reloading, modern DOM reconciliation).
- **Client Routing:** [React Router v7](file:///d:/VESIT/Capstone/package.json#L21) (`BrowserRouter`, `Routes`, `Route`, `Navigate`).
- **State Management:** React Context API via [`WaterWalletContext`](file:///d:/VESIT/Capstone/src/context/WaterWalletContext.jsx) (global workflow state) and [`AuthContext`](file:///d:/VESIT/Capstone/src/context/AuthContext.jsx) (authentication lifecycle).
- **Styling & Design System:** [Tailwind CSS v4](file:///d:/VESIT/Capstone/package.json#L34) via `@tailwindcss/vite`, coupled with clean custom CSS utility tokens in [`src/index.css`](file:///d:/VESIT/Capstone/src/index.css).
- **Geospatial Mapping:** [Leaflet 1.9.4](file:///d:/VESIT/Capstone/package.json#L16) + [React-Leaflet v5](file:///d:/VESIT/Capstone/package.json#L20) with high-resolution **Esri World Imagery** satellite tile layers.
- **Geodesic Geometry:** [@turf/turf v7](file:///d:/VESIT/Capstone/package.json#L13) (`turf.polygon`, `turf.area`, `turf.centroid`) for geodesic WGS84 area and centroid calculations.
- **Data Visualization:** [Recharts v3.8](file:///d:/VESIT/Capstone/package.json#L22) for composed bar/line seasonal rainfall charts, cumulative cash flow break-even curves, and Monte Carlo probability distributions.
- **Iconography:** [Lucide React](file:///d:/VESIT/Capstone/package.json#L17).
- **HTTP Client:** [Axios](file:///d:/VESIT/Capstone/package.json#L14) with request authentication interceptors and 401 unauthorized session management.

### Backend Architecture
- **Framework:** [FastAPI](file:///d:/VESIT/Capstone/backend/requirements.txt#L1) (Python 3.10–3.13), ASGI compliant, asynchronous request handlers, automatic OpenAPI 3.1 interactive schema documentation at `/docs`.
- **Server:** [Uvicorn](file:///d:/VESIT/Capstone/backend/requirements.txt#L2) with standard event loop and ASGI lifecycle support.
- **Validation & Schemas:** [Pydantic v2](file:///d:/VESIT/Capstone/backend/requirements.txt#L3) + `pydantic-settings` enforcing runtime typing, value bounds, and cross-field validation.
- **Database & ORM:** [SQLAlchemy v2](file:///d:/VESIT/Capstone/backend/requirements.txt#L6) with [Alembic](file:///d:/VESIT/Capstone/backend/requirements.txt#L7) migrations and [psycopg2-binary](file:///d:/VESIT/Capstone/backend/requirements.txt#L8) for PostgreSQL / Supabase connectivity.
- **In-Memory Store:** Resilient dictionary-backed session store with user scoping for seamless execution when offline or when PostgreSQL is unreachable.
- **Authentication & Cryptography:** Passwords hashed with [bcrypt](file:///d:/VESIT/Capstone/backend/requirements.txt#L10); JWT authentication tokens issued and verified via [python-jose](file:///d:/VESIT/Capstone/backend/requirements.txt#L11).
- **Async HTTP Client:** [HTTPX](file:///d:/VESIT/Capstone/backend/requirements.txt#L4) for asynchronous communication with Open-Meteo and Groq API endpoints.

### Machine Learning & Scientific Stack
- **Classical ML & Ensembles:** [scikit-learn 1.9.0](file:///d:/VESIT/Capstone/backend/requirements.txt#L14) (Pinned version for byte-level serialization compatibility of `RandomForestClassifier`, `RandomForestRegressor`, `CalibratedClassifierCV`, metrics, and preprocessing).
- **Model Explainability (XAI):** [SHAP 0.45+](file:///d:/VESIT/Capstone/backend/requirements.txt#L18) using `shap.TreeExplainer` for per-feature marginal attribution.
- **Time-Series Forecasting:** [pmdarima 2.0.4](file:///d:/VESIT/Capstone/backend/requirements.txt#L19) (`auto_arima`) and [statsmodels 0.14+](file:///d:/VESIT/Capstone/backend/requirements.txt#L20) for seasonal SARIMA model fitting.
- **Serialization:** [joblib 1.4+](file:///d:/VESIT/Capstone/backend/requirements.txt#L15) for single-pass model artifact loading.
- **Numerical Computing:** [NumPy 1.26+](file:///d:/VESIT/Capstone/backend/requirements.txt#L16) and [Pandas 2.2+](file:///d:/VESIT/Capstone/backend/requirements.txt#L17).

### External Data APIs & Services
- **Open-Meteo Historical Weather Archive API:** Publicly accessible, keyless meteorological API providing ERA5/CERRA reanalysis precipitation data from 2010 to 2024 (15 complete calendar years).
- **Esri World Imagery (ArcGIS):** High-resolution global satellite basemap used for building rooftop tracing.
- **Groq API Cloud:** Ultra-low-latency LLM inference hosting `openai/gpt-oss-20b` (or llama3 models) for grounded plain-English committee advisories.

---

## 3. System Architecture & End-to-End Data Flow

The WaterWallet architecture follows a decoupled, three-tier model: a single-page React frontend, a high-throughput FastAPI backend engine, and serialized ML model singletons backed by PostgreSQL.

### Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Frontend Client (React 19 + Vite)"]
        UI_AUTH["AuthPage.jsx\n(/login, /register)"]
        UI_VM["Phase 1: Virtual Meter\n(/virtual-meter)"]
        UI_MS["Phase 2: Map Studio\n(/map-studio)"]
        UI_ROI["Phase 3: ROI Dashboard\n(/roi-dashboard)"]
        CTX["WaterWalletContext\n(Global Reactive State)"]
        ACTX["AuthContext\n(JWT & User Session)"]
    end

    subgraph Backend["FastAPI Backend (Uvicorn ASGI)"]
        ROUT_AUTH["routers/auth.py\n(/api/auth)"]
        ROUT_SOC["routers/societies.py\n(/api/societies)"]
        ROUT_GEO["routers/geospatial.py\n(/api/catchment)"]
        ROUT_ML["routers/ml_recommend.py & ml_yield.py\n(/api/ml)"]
        ROUT_ROI["routers/roi.py\n(/api/roi)"]
        ROUT_ADV["routers/advisory.py\n(/api/advisory)"]
        
        SRV_DEMAND["services/demand_engine.py\n(IS:1172 Canonical Demand)"]
        SRV_YIELD["services/yield_engine.py\n(Physics Runoff Engine)"]
        SRV_RAIN["services/rainfall_api.py\n(Daily & Monthly Open-Meteo Client)"]
        SRV_FORECAST["services/rainfall_forecast.py\n(Seasonal Auto-SARIMA Engine)"]
        SRV_SAFETY["services/tier1_safety.py\n(Tier 1 Hydrogeological Gate)"]
        SRV_ML["services/ml_engine.py\n(Calibrated RF & SHAP Singletons)"]
        SRV_MC["services/monte_carlo.py\n(1,000-Scenario Stochastic ROI)"]
        SRV_TANK["services/tank_sizer.py\n(Daily Water-Balance Sizer)"]
    end

    subgraph DataML["Data, Models & Storage"]
        MODELS[("backend/ml_models/\n• waterwallet_config_classifier.pkl\n• waterwallet_yield_model.pkl\n• waterwallet_label_encoder.pkl\n• thane_rain_percentiles.csv")]
        DB[("PostgreSQL Database\n(Users, Societies, Billing, Analyses)")]
        MEM[("Resilient In-Memory Session Store\n(User-Scoped Offline Store)")]
    end

    subgraph External["External Cloud APIs"]
        EXT_METEO["Open-Meteo Archive API\n(2010–2024 Daily/Monthly Precip)"]
        EXT_ESRI["Esri ArcGIS Tile Server\n(Satellite Imagery Zoom 18)"]
        EXT_GROQ["Groq LLM Inference API\n(Grounded Natural Language)"]
    end

    %% Frontend connections
    ACTX <--> ROUT_AUTH
    UI_VM <--> CTX
    UI_MS <--> CTX
    UI_ROI <--> CTX
    
    %% API calls
    UI_VM -->|"POST /baseline, CRUD"| ROUT_SOC
    UI_MS -->|"POST /calculate, /forecast, /yield"| ROUT_GEO
    UI_MS -->|"POST /yield"| ROUT_ML
    UI_ROI -->|"POST /recommend, /monte-carlo, /tank-sizer, /water"| ROUT_ROI
    UI_ROI --> ROUT_ML
    UI_ROI --> ROUT_ADV
    UI_MS -->|"Tile Requests"| EXT_ESRI

    %% Backend routing
    ROUT_SOC --> SRV_DEMAND
    ROUT_SOC --> DB
    ROUT_SOC --> MEM
    ROUT_GEO --> SRV_RAIN
    ROUT_GEO --> SRV_FORECAST
    ROUT_GEO --> SRV_YIELD
    ROUT_RAIN_CLIENT["SRV_RAIN"] --> EXT_METEO
    ROUT_ML --> SRV_SAFETY
    ROUT_ML --> SRV_ML
    ROUT_ROI --> SRV_MC
    ROUT_ROI --> SRV_TANK
    ROUT_ADV --> EXT_GROQ
    
    %% Storage links
    SRV_ML --> MODELS
    SRV_MC --> MODELS
```

### Complete End-to-End Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Society Secretary
    participant VM as Virtual Meter (Phase 1)
    participant MS as Map Studio (Phase 2)
    participant RD as ROI Dashboard (Phase 3)
    participant API as FastAPI Backend
    participant OM as Open-Meteo API
    participant ML as ML & Safety Engine
    participant Groq as Groq Advisory API

    User->>VM: Enter 50 flats, 4 occ, billing history (₹21k/mo tanker)
    VM->>API: POST /api/societies/baseline {flats: 50, occupants: 4, include_losses: true}
    API-->>VM: {base_demand: 27,000 L, daily_demand_with_buffer: 34,155 L}
    VM->>VM: Sync context (annualDemand: 12.46 ML, totalTankerSpend: ₹1.02L)

    User->>MS: Navigate to Map Studio & trace rooftop on satellite map
    MS->>MS: Turf.js calculates polygon area = 1,200 m² (usable = 960 m²)
    MS->>API: POST /api/catchment/calculate {lat, lon, roof_area: 1200, surface: "concrete"}
    API->>OM: Fetch daily precipitation (2010–2024)
    OM-->>API: 15-year daily precipitation records
    API-->>MS: {annual_rainfall: 2,347 mm, annual_yield: 1.61 ML, monthly_averages}
    
    opt Dynamic Auto-SARIMA Forecast
        MS->>API: POST /api/catchment/forecast {lat, lon, roof_area: 1200}
        API-->>MS: {forecast_rainfall, model_order: SARIMA(1,0,1)(1,0,1)[12]}
    end

    User->>RD: Navigate to ROI Dashboard
    RD->>API: POST /api/ml/recommend {area: 960, borewell: 1, depth: 95, soil_perm: 3, coastal: 25}
    API->>ML: Run Tier 1 Safety Gate (Passed) -> Calibrated RF Classifier
    ML-->>API: Config: "Hybrid" (96.0% conf), SHAP attribution values
    API-->>RD: Recommendation + Plain-English explanation

    RD->>API: POST /api/roi/tank-sizer {area: 1200, daily_demand: 13,000 L non-potable}
    API-->>RD: Selected candidate: 50,000 L (84.2% reliability, ₹2.07L capex)

    RD->>API: POST /api/roi/monte-carlo {1,000 iterations from historical P10-P90}
    API-->>RD: Median break-even: Year 2, P(Break-even ≤ Yr 3): 72%, P(≤ Yr 4): 91%

    opt Grounded AI Advisory
        RD->>API: POST /api/advisory/water {validated society facts}
        API->>Groq: Request JSON advisory constrained to validated metrics
        Groq-->>API: {summary, recommendations, risks, assumptions}
        API-->>RD: Display advisory card in dashboard
    end

    User->>RD: Click "Download PDF Report"
    RD->>User: Opens browser native print preview with complete executive summary
```

---

## 4. Repository Directory Structure & File Manifest

The repository is structured with clean separation of concerns between backend service modules, serialized machine learning models, frontend views, and verification tests.

```text
D:\VESIT\Capstone\
├── .env                                  # Root frontend environment configuration
├── .env.example                          # Example root environment file
├── index.html                            # HTML5 single-page application entry point
├── package.json                          # Frontend dependencies & Vite scripts
├── vite.config.js                        # Vite 8 configuration with @tailwindcss/vite plugin
├── eslint.config.js                      # ESLint configuration
├── dist/                                 # Production optimized build output
├── public/                               # Static assets
│
├── backend/                              # FastAPI Python Backend
│   ├── .env                              # Backend environment secrets (JWT_SECRET, GROQ_API_KEY)
│   ├── main.py                           # FastAPI application entry, CORS, and router registration
│   ├── config.py                         # Pydantic Settings environment parsing
│   ├── database.py                       # SQLAlchemy engine, declarative Base, session factory
│   ├── dependencies.py                   # Dependency injection (get_current_user JWT auth)
│   ├── requirements.txt                  # Python dependencies
│   ├── alembic.ini                       # Alembic database migration config
│   ├── alembic/                          # Versioned database migration scripts
│   │
│   ├── models/                           # Schemas, ORM models, and domain constants
│   │   ├── constants.py                  # Single source of truth (IS_LPCD, UFW, Runoff coefficients)
│   │   ├── db_models.py                  # SQLAlchemy ORM models (User, Society, BillingEntry, SocietyAnalysis)
│   │   └── schemas.py                    # Complete Pydantic request and response models
│   │
│   ├── routers/                          # HTTP route controllers
│   │   ├── auth.py                       # POST /register, POST /login, GET /me
│   │   ├── societies.py                  # POST /baseline, CRUD society profiles & billing
│   │   ├── geospatial.py                 # POST /calculate, POST /forecast
│   │   ├── ml_recommend.py               # POST /recommend (Tier 1 safety + Tier 2 RF + SHAP)
│   │   ├── ml_yield.py                   # POST /yield (RF regressor with physics fallback)
│   │   ├── roi.py                        # POST /simulate, POST /monte-carlo, POST /tank-sizer
│   │   └── advisory.py                   # POST /water (Grounded Groq LLM advisory)
│   │
│   ├── services/                         # Core calculation and domain business logic
│   │   ├── demand_engine.py              # Canonical IS:1172 demand calculation
│   │   ├── yield_engine.py               # Runoff coefficient and usability yield calculation
│   │   ├── rainfall_api.py               # Open-Meteo async client for daily and monthly precipitation
│   │   ├── rainfall_forecast.py          # Seasonal Auto-SARIMA dynamic forecasting
│   │   ├── tier1_safety.py               # Hard hydrogeological safety gate
│   │   ├── ml_engine.py                  # Singleton loader for RF models and TreeSHAP explainer
│   │   ├── monte_carlo.py                # 1,000-iteration stochastic ROI simulation
│   │   ├── tank_sizer.py                 # Multi-year daily water-balance tank sizing simulator
│   │   └── roi_engine.py                 # Deterministic 10-year multi-scenario ROI engine
│   │
│   ├── ml_models/                        # Serialized ML models & training pipeline
│   │   ├── train_models.py               # Training pipeline script (trains RF, CalibratedCV, CSVs)
│   │   ├── fix_classifier.py             # Classifier alignment script
│   │   ├── model_metadata.json           # Model provenance, metrics, and scikit-learn version
│   │   ├── thane_rain_percentiles.csv    # 15-year 12×3 monthly rainfall percentiles (P10/P50/P90)
│   │   ├── waterwallet_config_classifier.pkl # Trained Random Forest RWH configuration classifier
│   │   ├── waterwallet_yield_model.pkl   # Trained Random Forest monthly yield regressor
│   │   └── waterwallet_label_encoder.pkl # LabelEncoder mapping class names to indices
│   │
│   └── tests/                            # Automated test suite
│       ├── test_tank_sizer.py            # Unit tests for daily water balance, leap years, monotonicity
│       └── test_monte_carlo_integration.py # Unit tests for stochastic ROI and rainfall bounds
│
├── src/                                  # React 19 Frontend Source
│   ├── main.jsx                          # React DOM initialization
│   ├── App.jsx                           # Application shell, protected routing, skip link
│   ├── index.css                         # CSS design system, typography, card utilities
│   │
│   ├── api/
│   │   └── waterwallet.js                # Axios client with JWT interceptors and API wrappers
│   │
│   ├── context/
│   │   ├── AuthContext.jsx               # JWT token storage, login/logout, user lifecycle
│   │   └── WaterWalletContext.jsx        # Unified reactive workflow state across Phases 1–3
│   │
│   ├── utils/
│   │   ├── waterConstants.js             # Canonical frontend demand formulas & constants
│   │   └── formatters.js                 # INR currency, area, rainfall, and volume formatters
│   │
│   ├── components/
│   │   ├── Sidebar.jsx                   # Three-step wizard navigation with completion states
│   │   └── Topbar.jsx                    # User session, society name badge, logout controls
│   │
│   └── views/
│       ├── AuthPage.jsx                  # Tabbed login and registration interface
│       ├── VirtualMeter.jsx              # Phase 1: Demand estimation & historical billing log
│       ├── MapStudio.jsx                 # Phase 2: Satellite polygon tracing & rainfall intelligence
│       └── ROIDashboard.jsx              # Phase 3: Financial ROI, ML recommendation, Monte Carlo, tank sizer
│
└── WaterWallet_ml_updated.ipynb          # Complete 24-cell ML research & development notebook
```

---

## 5. Complete Feature Walkthrough & User Journey

WaterWallet guides the user through an intuitive, connected three-phase wizard. Every phase feeds into global application state in [`WaterWalletContext`](file:///d:/VESIT/Capstone/src/context/WaterWalletContext.jsx).

### Step 0: Authentication & Session Handling
- **File:** [`src/views/AuthPage.jsx`](file:///d:/VESIT/Capstone/src/views/AuthPage.jsx), [`src/context/AuthContext.jsx`](file:///d:/VESIT/Capstone/src/context/AuthContext.jsx), [`backend/routers/auth.py`](file:///d:/VESIT/Capstone/backend/routers/auth.py)
- **User Interface:** Clean, tabbed authentication card allowing the user to either log in or register a new society manager account.
- **Processing Logic:** 
  - Registration sends `email` and `password` to `POST /api/auth/register`. Passwords are validated (minimum 6 characters, maximum 72 UTF-8 bytes to fit bcrypt limits) and hashed using `bcrypt.hashpw` with salt.
  - Login calls `POST /api/auth/login`, validates credentials with `bcrypt.checkpw`, and returns a signed HS256 JWT access token encoding the user identifier (`sub`) and expiration timestamp.
  - The JWT is stored in `localStorage` as `access_token`. An Axios request interceptor attaches `Authorization: Bearer <token>` to all subsequent backend calls.
  - Protected routes redirect unauthenticated users to `/login`.

---

### Phase 1: Virtual Meter (Demand & Billing Analysis)
- **File:** [`src/views/VirtualMeter.jsx`](file:///d:/VESIT/Capstone/src/views/VirtualMeter.jsx)
- **Purpose:** Establish the society's baseline daily water demand and quantify current annual expenditure on private water tankers.

```
+-----------------------------------------------------------------------------------+
| VIRTUAL METER -- ESTABLISH DEMAND & BILLING                                       |
+-----------------------------------------------------------------------------------+
|  [ Card 1: Society Profile ]                 [ Card 2: Historical Billing Log ]   |
|  Society Name: [ Evergreen Heights CHS ]      Month   Year  Bill(₹) Tankers Cap(L)|
|  Flats: [ 50 ]  Occupants/flat: [ 4.0 ]       April   2025  18,500   14    10,000 |
|  Pincode: [ 400071 ]                          May     2025  21,200   18    10,000 |
|  Roof Surface: [ Concrete (RCC)    v]        June    2025  19,800   11    10,000 |
|  [x] Include 15% Distribution Losses (UFW)    March   2025  15,300    7    10,000 |
|  [ ] Override with Metered Consumption       + Add Billing Row                    |
|                                                                                   |
|  Computed Demand: 34,155 L/day (12.47 ML/yr) Tanker Spend: ₹1,02,000 (700 kL)    |
|  [ Save Society Profile ]                     [ Proceed to Map Studio -> ]        |
+-----------------------------------------------------------------------------------+
```

#### User Inputs
1. **Society Name & Pincode:** Identifying metadata (e.g., `Evergreen Heights CHS`, `400071`).
2. **Number of Flats & Occupants Per Flat:** Residential scale (e.g., 50 flats, 4.0 occupants/flat $\rightarrow$ 200 residents).
3. **Roof Surface Type:** Dropdown selector (`Concrete`, `Metal`, `Tiles`, `Gravel`) defining the runoff coefficient.
4. **UFW Loss Toggle:** Checkbox to enable or disable the 15% Unaccounted-For Water distribution loss allowance.
5. **Metered Data Override:** Optional toggle allowing societies with metered consumption to bypass the standard formula and input actual monthly, quarterly, half-yearly, or annual metered litres and municipal bills.
6. **Billing History Table:** Dynamic tabular log capturing `Month`, `Year`, `Municipal Bill (₹)`, `Tankers Purchased`, `Cost Per Tanker (₹)`, and `Tanker Capacity (L)` for historical summer and winter months.

#### Internal Processing Logic
- Calculates base demand: $\text{Base} = \text{Flats} \times \text{Occupants} \times 135 \text{ LPCD}$.
- Applies UFW: $\text{After UFW} = \text{Base} \times 1.15$ (if checked).
- Applies peak buffer: $\text{Daily Demand} = \text{After UFW} \times 1.10$.
- Debounced API call syncs with `POST /api/societies/baseline`.
- Aggregates billing table:
  $$\text{Total Tanker Spend} = \sum (\text{Tankers} \times \text{CostPerTanker})$$
  $$\text{Total Tanker Volume} = \sum (\text{Tankers} \times \text{TankerCapacity})$$
  $$\text{Total Municipal Spend} = \sum (\text{MunicipalBill})$$
- Clicking **Save Society** persists the society to PostgreSQL via `POST /api/societies/` and saves billing rows via `POST /api/societies/{id}/billing`.

#### Expected Outputs
- Baseline daily water demand in litres/day and annual demand in kilolitres.
- Total recorded tanker expenditure and total tanker water volume purchased.
- Synchronization of `annualDemand`, `totalTankerSpend`, `totalMunicipal`, and `billingMonths` in global state.

---

### Phase 2: Map Studio (Catchment & Rainfall Intelligence)
- **File:** [`src/views/MapStudio.jsx`](file:///d:/VESIT/Capstone/src/views/MapStudio.jsx)
- **Purpose:** Calculate geodesic rooftop catchment area, fetch site-specific historical rainfall, forecast upcoming precipitation with seasonal Auto-SARIMA, and evaluate harvestable yield.

```
+-----------------------------------------------------------------------------------+
| MAP STUDIO -- SATELLITE ROOFTOP TRACING & PRECIPITATION INTELLIGENCE              |
+-----------------------------------------------------------------------------------+
|  [ Interactive Esri Satellite Map (Zoom 18) ]  [ Catchment & Yield Intelligence ] |
|  +------------------------------------------+  Traced Gross Area:  1,200 m²       |
|  |     *---------*                          |  Usable Catchment:   960 m² (80%)   |
|  |    /  Roof    \                          |  Historical Rainfall:2,347 mm/yr    |
|  |   *------------*                         |  Auto-SARIMA Forecast:2,280 mm/yr   |
|  |  (Click vertices to trace building roof)|  Max Annual Yield:   16.18 Lakh L   |
|  +------------------------------------------+  Estimated Capex:    ₹5,76,000      |
|  [ Undo Vertex ] [ Clear ]                     Monsoon Dependency: 88.5% (High)   |
|                                                                                   |
|  [ Monthly Rainfall (mm) vs Monthly Demand (kL) Composed Chart ]                  |
|  Bars: Monsoonal rainfall spike (Jun-Sep) | Line: Year-round non-potable demand  |
|                                                                                   |
|  [ Site Hydrogeological Parameters ]                                              |
|  Borewell Present: [x] Yes  Depth: [ 95 m ]  Soil Permeability: [ Class 3 Loam v ]|
|  Distance to Coast: [ 25.0 km ]                                                   |
|  [ Proceed to ROI Dashboard -> ]                                                  |
+-----------------------------------------------------------------------------------+
```

#### User Inputs
1. **Rooftop Polygon Tracing:** User clicks on the Esri World Imagery satellite view to place polygon vertices bounding their building roof. Controls allow undoing vertices or clearing the boundary.
2. **Site Hydrogeological Inputs:** 
   - Borewell presence toggle (`Yes` / `No`).
   - Borewell depth slider (15 m to 180 m; disabled if no borewell).
   - Soil permeability dropdown (Class 1: Clay to Class 5: Coarse Sand).
   - Coastal proximity slider (0.5 km to 35.0 km).

#### Internal Processing Logic
- **Geodesic Area Calculation:** When $\ge 3$ points are placed, coordinates are formatted as GeoJSON `[longitude, latitude]` pairs, closed, and passed to `turf.area()` to compute geodesic surface area in square metres.
- **Usable Area Deduction:** Applies the standard 20% deduction factor for rooftop obstacles (lift machine rooms, solar PV arrays, HVAC units, vents):
  $$\text{Usable Area} = \text{Traced Area} \times 0.80$$
- **Centroid Calculation:** `turf.centroid()` extracts latitude and longitude of the building centre.
- **Live Historical Rainfall Fetch:** Calls `POST /api/catchment/calculate`. The backend queries Open-Meteo for 15 complete calendar years (2010–2024) of daily precipitation at that exact GPS coordinate, groups them by year and month, and returns the 12-month historical averages and annual rainfall.
- **Dynamic Auto-SARIMA Forecasting:** Calls `POST /api/catchment/forecast`. The backend runs `pmdarima.auto_arima` on the 180-month historical sequence to select the best seasonal order via AIC and forecasts the next 12 months with 95% confidence intervals.
- **Machine Learning Yield Prediction:** Calls `POST /api/ml/yield`. Passes usable rooftop area and monthly rainfall into the Random Forest Regressor (`waterwallet_yield_model.pkl`). The UI compares the ML yield against the deterministic physics equation and displays the deviation percentage.
- **Monsoon Dependency Score:** Computes the percentage of rainfall occurring in June through September (JJAS). If $\ge 80\%$, an advisory warning highlights that heavy storage or recharge capacity is required to avoid spillover.

#### Expected Outputs
- Gross traced area and usable catchment area ($m^2$).
- Maximum annual harvestable rainwater yield (litres).
- Parametric project Capex estimate (usable area $\times$ ₹600/m² MMR DSR rate).
- Monthly rainfall vs. water demand comparison chart.
- Preserved site hydrogeological parameters stored in global context.

---

### Phase 3: ROI Dashboard & Decision Engine
- **File:** [`src/views/ROIDashboard.jsx`](file:///d:/VESIT/Capstone/src/views/ROIDashboard.jsx)
- **Purpose:** Synthesize engineering, meteorological, and billing inputs into financial projections, system configuration recommendations, daily tank sizing, and committee-ready reports.

```
+-----------------------------------------------------------------------------------+
| ROI DASHBOARD -- FINANCIAL PROOFS & DECISION INTELLIGENCE                         |
+-----------------------------------------------------------------------------------+
|  [ KPI Summary Cards ]                                                            |
|  10-Yr Tanker Bleed      RWH Project Budget     Payback Timeline   Self-Sufficiency|
|  ₹29.8L - ₹41.2L         ₹5,76,000 (Capex)      Year 2 (P50 typical)  130% (High) |
|                                                                                   |
|  [ Dual-Tier AI Recommendation Card ]                                             |
|  Recommended System: HYBRID (Storage Tank + Borewell Recharge)                    |
|  Confidence: 96.0% (Tier 2 Random Forest Classifier)                              |
|  Why: Borewell presence, borewell depth (95 m), and roof area (960 m²) support    |
|       this configuration. (SHAP: borewell +0.172, depth +0.162, area +0.161)      |
|                                                                                   |
|  [ 10-Year Cumulative Cash Flow Comparison Chart ]                                |
|  -- Red line: Do-Nothing path under 8% inflation (costs escalate to ₹41.2 Lakhs)  |
|  -- Green area: Cost with RWH (Capex upfront + 3% AMC; flattens out)              |
|  -- Intersection point marks Break-Even Year (Year 2)                             |
|                                                                                   |
|  [ 1,000-Scenario Monte Carlo Break-Even Distribution ]                           |
|  Bar Chart: Year 1: 2% | Year 2: 45% | Year 3: 72% | Year 4: 91% | Year 5: 98%    |
|  Risk of never breaking even within 10 years: 0.0%                                |
|                                                                                   |
|  [ Daily Historical Tank Sizer ]                                                  |
|  Recommended Capacity: 50,000 Litres (Meets 80% non-potable reliability target)  |
|  Useful Water: 14.2 Lakh L | Recharge Overflow: 1.9 Lakh L | Capex: ₹2,07,200     |
|                                                                                   |
|  [ Grounded Groq AI Advisory Card ]                                               |
|  Summary: High-yield site with rapid 2-year capital recovery.                     |
|  Recommendations: Prioritize 50 kL tank with overflow directed to 95 m borewell.  |
|                                                                                   |
|  [ Interactive Sliders ] Roof Area, Borewell Depth, Soil Perm, Coast, Capex Rate  |
|  [ Download PDF Report ]                             [ Save Analysis Snapshot ]   |
+-----------------------------------------------------------------------------------+
```

#### User Inputs & Interactive Controls
- **What-If Parameter Sliders:**
  - Rooftop Area slider (100 m² to 1,800 m²).
  - Borewell Presence toggle (`Yes` / `No`) and Depth slider (15 m to 180 m).
  - Soil Permeability selector (Class 1 to Class 5).
  - Coastal Proximity slider (0.5 km to 35.0 km).
  - Capex Rate slider (₹400/m² economy to ₹800/m² premium; default ₹600/m²).
  - Tank Capacity slider (10,000 L to 100,000 L).
  - Rainfall Reduction scenario slider (0% to 50% drought deficit).
- Adjusting any slider dynamically updates all downstream calculations without page reloads.

#### Internal Processing Logic
1. **Demand-Gated Multi-Scenario ROI:**
   - Evaluates three compounding inflation trajectories: Conservative ($\gamma = 6\%$), Current ($\gamma = 8\%$), High-Risk ($\gamma = 12\%$).
   - Harvested rainwater offsets high-cost tanker water first, then municipal water.
   - Deducts Annual Maintenance Contract ($\text{AMC} = 3\% \text{ of Capex}$) each year.
   - Calculates the exact interpolated fractional payback year.
2. **Dual-Tier System Recommendation:**
   - Calls `POST /api/ml/recommend`.
   - **Tier 1 (Hard Safety Gate):** Evaluates physical safety constraints. If coastal distance $\le 2.5$ km, no borewell exists, soil permeability is Class 1, or borewell depth $< 30$ m, forces **Storage-Only** with `confidence: 1.0` and `safety_triggered: true`.
   - **Tier 2 (Calibrated Random Forest Classifier):** Runs if Tier 1 passes. Classifies the site into Storage-Only, Borewell-Recharge, or Hybrid.
   - **TreeSHAP Explainability:** Decomposes the decision into per-feature SHAP contribution values and constructs a plain-English explanation.
3. **1,000-Scenario Monte Carlo Simulation:**
   - Calls `POST /api/roi/monte-carlo`. Samples 1,000 stochastic annual rainfall vectors from historical $P_{10}$–$P_{90}$ monthly distributions (or site-specific Phase 2 rainfall with $\pm 20\%$ variance).
   - Simulates monthly storage carryover and calculates the break-even probability for each year from 1 to 10.
4. **Daily Historical Water-Balance Tank Sizing:**
   - Calls `POST /api/roi/tank-sizer`. Simulates daily water balance across complete historical years for candidate capacities ($0$, $10\text{k}$, $20\text{k}$, $30\text{k}$, $50\text{k}$, $75\text{k}$, $100\text{k}$, $150\text{k}$ L) against non-potable demand (planning default 65 LPCD).
   - Accurately tracks useful water, recharge overflow (environmental benefit), lost overflow (system inefficiency), unmet demand, reliability %, and candidate payback.
5. **Grounded AI Advisory:**
   - Calls `POST /api/advisory/water` using Groq LLM inference.
   - Enforces a system prompt that strictly forbids recalculation, hallucinated metrics, or civil engineering guarantees, returning structured JSON with an executive summary, recommendations, risks, and assumptions.
6. **Executive PDF Report Generation:**
   - Clicking **Download PDF Report** triggers client-side generation of a styled, self-contained HTML document with escaped values, opening the browser's native print preview (`window.print()`).
7. **Analysis Snapshot Persistence:**
   - Clicking **Save Analysis** persists computed capex, annual yield, demand, and full JSON metadata to `POST /api/societies/{id}/analyses`.

---

### Complete End-to-End Case Study Walkthrough

To illustrate how all modules connect, consider the validated reference case study of **Evergreen Heights CHS** (based on field data from a 50-flat society in Thane West):

| Workflow Stage | Parameter / Action | Observed Value / Result | System Interpretation |
|---|---|---|---|
| **Phase 1: Virtual Meter** | Scale & Occupancy | 50 flats, 4.0 occupants/flat | 200 residents; base demand = 27,000 L/day |
| | UFW & Peak Buffer | UFW 15% checked, buffer 10% | Adjusted demand = **34,155 L/day** (12.47 ML/yr) |
| | Billing History | 6 logged months, 67 tankers | ₹1,02,000 tanker spend; ₹1,01,100 municipal spend |
| | Tanker Bleed Projection | Unchecked 10-year path | **₹34.6 Lakhs** projected expenditure without RWH |
| **Phase 2: Map Studio** | Traced Polygon | 6 vertices on RCC rooftop | Traced area = 1,200 m²; Usable area = **960 m²** (80%) |
| | Historical Rainfall | Open-Meteo GPS lookup | 15-year mean annual rainfall = **2,347 mm** |
| | Auto-SARIMA Forecast | Dynamic time-series fit | Order: $(1,0,1)(1,0,1)_{12}$; Forecast = **2,280 mm** |
| | Harvestable Yield | Physics formula + ML | Maximum yield = **1.62 ML/year** (130% self-sufficiency) |
| | Site Hydrogeology | Borewell present, 95 m depth | Permeability: Class 3 (Loam); Coastal dist: 25 km |
| **Phase 3: ROI Dashboard** | Tier 1 Safety Gate | Coastal 25 km, depth 95 m | **PASSED** (all 4 safety constraints satisfied) |
| | Tier 2 RF Classifier | 7 features evaluated | **HYBRID** recommended with **96.0% confidence** |
| | SHAP Attribution | Top drivers | Borewell (+0.172), Depth (+0.162), Roof Area (+0.161) |
| | Multi-Scenario Payback | Current 8% inflation | **Break-Even: Year 2** (Net benefit Year 10: ₹24.5 Lakhs) |
| | Monte Carlo Simulation | 1,000 stochastic runs | Median break-even: Year 2; $P(\le \text{Yr 3}) = 72\%$; $P(\le \text{Yr 4}) = 91\%$ |
| | Daily Tank Sizer | Non-potable demand (65 LPCD) | Selected **50,000 L tank** (84.2% reliability; ₹2.07L cost) |
| | Groq AI Advisory | Grounded summary | Highlights strong viability, advising borewell injection overflow |
| | Report Generation | Print-to-PDF | Comprehensive 2-page executive committee report produced |

---

## 6. Engineering Standards, Physics Formulas & Calculations

WaterWallet strictly adheres to established Indian and international municipal engineering standards.

### Summary of Engineering Standards

| Standard / Authority | Code / Directive | Application in WaterWallet | Canonical Value / Rule |
|---|---|---|---|
| **Bureau of Indian Standards (BIS)** | **IS:1172:1993** (Reaffirmed 2002) | Baseline domestic per-capita residential water consumption | **135 Litres Per Capita Per Day (LPCD)** (communities with flushing toilets) |
| **IS:1172 §4 / CPHEEO** | Peak Demand Headroom | Sizing supply against diurnal surges and modeling variance | **+10% Safety Buffer Factor (1.10)** |
| **CPHEEO Urban Manual** | Distribution System Losses | Unaccounted-For Water (UFW) due to pipe leakage and metering error | **+15% Distribution Loss Factor (0.15)** |
| **CPHEEO Water Supply** | Peninsular India Seasonality | Monthly distribution of domestic water demand | 12 monthly weights normalized to annual demand |
| **BMC RWH Bye-Laws** | 2007 & 2019 Circulars | Mandatory RWH threshold and configuration rules | Buildings with plot $>500\text{ m}^2$; concrete runoff coefficient $\ge 0.90$ |
| **Central Ground Water Board (CGWB)** | Coastal Recharge Norms | Artificial groundwater recharge exclusion zone | Minimum **2.5 km from coastline** to prevent saltwater intrusion |
| **CGWB Aquifer Guidelines** | Deep Injection Standards | Artificial injection borewell depth minimum | Minimum **30 metres** depth to avoid unconfined topsoil contamination |
| **NBSS&LUP Soil Maps** | National Soil Survey (MMR) | Soil permeability classification for infiltration | Classes 1 (Clay) through 5 (Coarse Sand) |
| **Maharashtra PWD / MMR DSR** | District Schedule of Rates | Parametric civil Capex estimation | **₹600 / m²** of usable rooftop catchment area |

---

### Canonical Demand Calculation

The demand engine executes a strict, non-negotiable three-step compounding formula:

$$\text{Step 1 (Base Domestic Demand)}: \quad \text{Base} = N_{\text{flats}} \times \text{Occupants}_{\text{per\_flat}} \times \text{IS\_LPCD}$$

$$\text{Step 2 (UFW Loss Factor)}: \quad \text{AfterUFW} = \begin{cases} \text{Base} \times (1 + \text{UFW\_LOSS\_FACTOR}) & \text{if include\_losses is true} \\ \text{Base} & \text{if include\_losses is false} \end{cases}$$

$$\text{Step 3 (Peak Surge Buffer)}: \quad \text{Daily Demand (L/day)} = \text{round}(\text{AfterUFW} \times \text{DEMAND\_BUFFER\_FACTOR})$$

$$\text{Annual Demand (L/year)} = \text{Daily Demand} \times 365$$

*Where:* $\text{IS\_LPCD} = 135.0$, $\text{UFW\_LOSS\_FACTOR} = 0.15$, $\text{DEMAND\_BUFFER\_FACTOR} = 1.10$.

```
Example (50 flats, 4 occupants/flat):
  Base      = 50 × 4 × 135          = 27,000 L/day
  AfterUFW  = 27,000 × 1.15         = 31,050 L/day
  Adjusted  = 31,050 × 1.10         = 34,155 L/day
  Annual    = 34,155 × 365          = 12,466,575 L/year (12.47 ML)
```

---

### Usable Catchment & Harvestable Yield Equations

The physics yield engine calculates harvestable yield from rooftop geometry and precipitation:

$$\text{Usable Rooftop Area } (A_{\text{usable}}, \text{m}^2) = A_{\text{gross}} \times \text{USABILITY\_FACTOR}$$

$$\text{Annual Harvestable Yield } (Y, \text{Litres}) = A_{\text{usable}} \times R_{\text{mm}} \times C_{\text{runoff}}$$

*Note on Unit Identity:* $1\text{ mm of rain on } 1\text{ m}^2 = 1\text{ Litre}$. Therefore, $\text{mm} \times \text{m}^2$ directly yields litres without unit conversion multipliers.

#### Runoff Coefficients by Surface Type ($C_{\text{runoff}}$)

| Roof Surface Type | Runoff Coefficient ($C_{\text{runoff}}$) | Hydrological Explanation |
|---|---|---|
| **Concrete (RCC)** *(Default)* | **0.90** | Smooth reinforced concrete; 10% lost to surface wetting and evaporation |
| **Corrugated Metal** | **0.90** | Impermeable galvanized iron or coated steel sheets |
| **Terracotta / Clay Tiles** | **0.75** | Slightly porous surface with joint absorption |
| **Gravel / Ballasted** | **0.45** | High retention, detention delay, and pore absorption |

$$\text{Combined Yield Factor for Concrete} = \text{USABILITY\_FACTOR} \times C_{\text{runoff}} = 0.80 \times 0.90 = 0.72$$

---

### Daily Water Balance & Tank Sizing Equations

The tank sizing engine ([`services/tank_sizer.py`](file:///d:/VESIT/Capstone/backend/services/tank_sizer.py)) models every individual calendar day $t \in [1, 365 \text{ or } 366]$ across complete historical years for candidate capacities $S_{\text{max}} \in [0, 10\text{k}, 20\text{k}, 30\text{k}, 50\text{k}, 75\text{k}, 100\text{k}, 150\text{k} \text{ L}]$:

$$\text{Daily Inflow } (I_t) = \max(0, R_t) \times A_{\text{usable}} \times C_{\text{runoff}} \times (1 - f_{\text{first\_flush}})$$

*Where:* $f_{\text{first\_flush}} = 0.05$ (5% initial rainfall diversion to wash roof sediment).

For each day $t$:
$$\text{Water Available } (W_t) = S_{t-1} + I_t$$
$$\text{Useful Water Served } (U_t) = \min(W_t, D_{\text{daily\_nonpotable}})$$
$$\text{Storage Level Before Overflow } (S'_t) = W_t - U_t$$
$$\text{Daily Overflow } (O_t) = \max(0, S'_t - S_{\text{max}})$$
$$\text{Ending Storage } (S_t) = \min(S'_t, S_{\text{max}})$$
$$\text{Daily Unmet Demand } = D_{\text{daily\_nonpotable}} - U_t$$

#### Overflow Separation Rules
- **If recharge is enabled (Hybrid / Borewell-Recharge):**
  $$\text{Recharge Overflow} = O_t, \quad \text{Lost Overflow} = 0$$
  *(Overflow replenishes local aquifers; tracked as an environmental metric, not financial savings).*
- **If recharge is disabled (Storage-Only):**
  $$\text{Recharge Overflow} = 0, \quad \text{Lost Overflow} = O_t$$
  *(Overflow is lost to storm drains; tracked as a design inefficiency).*

#### Tank Reliability & Candidate Selection
$$\text{Annual Reliability (\%)} = \frac{\sum_{t} U_t}{\sum_t D_{\text{daily\_nonpotable}}} \times 100$$
$$\text{Candidate Capex (₹)} = \text{FixedSystemCost} + (S_{\text{max}} \times \text{TankCostPerLitre})$$
*(FixedSystemCost = ₹7,200; TankCostPerLitre = ₹4.0/L).*

The engine selects the **smallest candidate capacity meeting the 80% reliability target**. If no candidate achieves 80%, it selects the highest-reliability non-zero tank and reports that the target was not reached.

---

### Multi-Year Compounding Cash Flow & ROI Equations

For each year $y \in [1, 10]$:
$$\text{Effective Annual Yield } (Y_{\text{effective}}) = \min(Y_{\text{annual}}, D_{\text{annual}})$$

$$\text{Tanker Offset } (V_{\text{tanker}}) = \min(Y_{\text{effective}}, V_{\text{annual\_tanker}})$$
$$\text{Municipal Offset } (V_{\text{municipal}}) = \min(Y_{\text{effective}} - V_{\text{tanker}}, \max(0, D_{\text{annual}} - V_{\text{annual\_tanker}}))$$

$$\text{Gross Savings } (S_y) = \left(\frac{V_{\text{tanker}}}{1000} \times P_{\text{tanker}} \times (1 + \gamma)^{y-1}\right) + \left(\frac{V_{\text{municipal}}}{1000} \times P_{\text{municipal}} \times (1.05)^{y-1}\right)$$

$$\text{Net Annual Savings } (S_{\text{net}, y}) = S_y - (\text{Capex} \times 0.03)$$

$$\text{Cumulative Savings } (C_y) = \sum_{i=1}^y S_{\text{net}, i}$$

$$\text{Exact Interpolated Payback Year} = y^* - \frac{C_{y^*} - \text{Capex}}{S_{\text{net}, y^*}}$$
*Where $y^*$ is the first year where $C_y \ge \text{Capex}$.*

---

## 7. Machine Learning, Deep Learning & Analytics Layer

WaterWallet employs machine learning where empirical complexity, non-linear relationships, and stochastic risks exceed the capability of static if-else formulas.

### Task 1: Dual-Tier RWH Configuration Recommendation

The core decision problem is identifying whether a site should install **Storage-Only**, **Borewell-Recharge**, or a **Hybrid** system.

```
Site Inputs: rooftop_area, borewell, depth, soil_perm, coastal_km, rain_mm, peak_day
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │         Tier 1: Hard Safety Gate             │
               │   (Hydrogeological Rules Check in Python)    │
               └──────────────┬───────────────────────────────┘
                              │
             Any rule fails?  │  All rules pass?
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌───────────────────────────┐       ┌───────────────────────────┐
│   Force "Storage-Only"    │       │ Tier 2: Calibrated Random │
│     Confidence = 1.0      │       │     Forest Classifier     │
│   safety_triggered = True │       │     (7 input features)    │
│  SHAP disabled by safety  │       └─────────────┬─────────────┘
└───────────────────────────┘                     │
                                                  ▼
                                    ┌───────────────────────────┐
                                    │    TreeSHAP Attribution   │
                                    │  Feature weights & plain  │
                                    │    language explanation   │
                                    └───────────────────────────┘
```

#### Tier 1: Hard Hydrogeological Safety Gate ([`services/tier1_safety.py`](file:///d:/VESIT/Capstone/backend/services/tier1_safety.py))
No ML model probability can override fundamental physical, geological, and regulatory constraints. Tier 1 executes four sequential checks before any model inference:

1. **Seawater Intrusion Check:** If $\text{coastal\_km} \le 2.5\text{ km} \rightarrow$ Force **Storage-Only** (`safety_triggered: true`). (CGWB / BMC norm: coastal injection alters hydraulic gradients and induces saline intrusion into potable aquifers).
2. **Infrastructure Check:** If $\text{borewell} == 0 \rightarrow$ Force **Storage-Only**. (Groundwater recharge requires deep injection boreholes; constructing a new deep borehole purely for recharge is economically prohibitive for standalone societies).
3. **Soil Infiltration Check:** If $\text{soil\_perm} < 2$ (Class 1 impermeable dense clay or hard basalt) $\rightarrow$ Force **Storage-Only**. (Water cannot percolate, causing surface waterlogging and silt blockage).
4. **Shallow Aquifer Contamination Check:** If $\text{borewell} == 1$ AND $\text{borewell\_depth} < 30\text{ m} \rightarrow$ Force **Storage-Only**. (Injecting surface runoff into shallow unconfined aquifers carries severe bacteriological contamination risks).

#### Tier 2: Calibrated Random Forest Classifier ([`services/ml_engine.py`](file:///d:/VESIT/Capstone/backend/services/ml_engine.py))
When all Tier 1 checks pass, the payload is evaluated by an ensemble classifier:
- **Model Type:** `CalibratedClassifierCV(estimator=RandomForestClassifier(n_estimators=100, random_state=42), method='sigmoid', cv=5)`
- **Input Features (7):** `rooftop_area`, `borewell`, `borewell_depth`, `soil_perm`, `coastal_km`, `annual_rain_mm`, `peak_day_mm`.
- **Target Classes (3):** `Storage-Only`, `Borewell-Recharge`, `Hybrid`.
- **Training Dataset:** 600 synthetic site profiles generated from BMC, CGWB, and CPHEEO engineering guidelines with rainfall distributions drawn from 15 years of Open-Meteo observations.
- **Why Probability Calibration:** Uncalibrated Random Forests exhibit biased probability distributions clustered away from 0 and 1. `CalibratedClassifierCV` applies Platt scaling (sigmoid calibration) across 5 folds, producing statistically sound posterior probabilities.
- **Performance:** 100% test accuracy, 100% balanced accuracy, Macro F1 = 1.00 on the holdout partition.

#### TreeSHAP Explainability
For every Tier 2 prediction, `shap.TreeExplainer` extracts Shapley attribution values for each input feature. The engine identifies positive driver features and formats them into a natural-language sentence:

$$\phi_i = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} \left[ f_x(S \cup \{i\}) - f_x(S) \right]$$

*Example Output:* `"Hybrid recommended because borewell presence, borewell depth (95 m), and rooftop area (960 m²) support this configuration."*

---

### Task 2: Dynamic Rainfall Forecasting (Auto-SARIMA)
- **Module:** [`services/rainfall_forecast.py`](file:///d:/VESIT/Capstone/backend/services/rainfall_forecast.py)
- **Purpose:** Provide a dynamic 12-month forward precipitation forecast based on the local coordinate's 180-month historical sequence.
- **Algorithm:** Seasonal Auto-Regressive Integrated Moving Average: $\text{SARIMA}(p,d,q)(P,D,Q)_m$ with seasonality $m=12$.
- **Parameter Selection:** Automatic stepwise search using `pmdarima.auto_arima` minimizing the Akaike Information Criterion (AIC):
  $$\text{AIC} = 2k - 2\ln(\hat{L})$$
  *(Constrained to $p \le 3, q \le 3, P \le 2, Q \le 2, \text{max\_order} \le 8$).*
- **Validation Metric:** Holdout MAE = **68.62 mm** across 48 holdout months (2022–2025), outperforming the naive same-month baseline (72.75 mm) and recursive Random Forest (136.46 mm).
- **Graceful Fallback:** If `pmdarima` is absent or the series fails to converge, the system falls back seamlessly to the 15-year historical monthly average without disrupting the user.

---

### Task 3: Monthly Harvestable Yield Prediction (RF Regressor)
- **Module:** [`services/ml_engine.py`](file:///d:/VESIT/Capstone/backend/services/ml_engine.py)
- **Artifact:** `waterwallet_yield_model.pkl` (Random Forest Regressor)
- **Input Features (10):**
  1. `rooftop_area` (m²)
  2. `month` (1 to 12)
  3. `rain_mm` (monthly rainfall depth)
  4. `annual_rain_mm` (annual total)
  5. `peak_day_proxy` ($\text{rain\_mm} / 30$)
  6. `lag1_rain` (rainfall depth of previous month)
  7. `lag2_rain` (rainfall depth 2 months prior)
  8. `lag3_rain` (rainfall depth 3 months prior)
  9. `sin_month` ($\sin(2\pi \times \text{month} / 12)$ — seasonal harmonic)
  10. `cos_month` ($\cos(2\pi \times \text{month} / 12)$ — seasonal harmonic)
- **Training / Testing Setup:** Trained on 2010–2021 monthly sequences; evaluated on 2022–2024 holdout.
- **Validated Metrics (from [`model_metadata.json`](file:///d:/VESIT/Capstone/backend/ml_models/model_metadata.json#L58-L60)):**
  - **MAE:** **4.8973 kL**
  - **$R^2$ Score:** **0.9865**
- **Physics Fallback:** If `waterwallet_yield_model.pkl` is uninitialized, the engine automatically falls back to the deterministic runoff formula and flags `source: "physics_formula"`.

---

### Task 4: Probabilistic Monte Carlo ROI Simulation
- **Module:** [`services/monte_carlo.py`](file:///d:/VESIT/Capstone/backend/services/monte_carlo.py)
- **Methodology:** 
  1. Executes $N = 1,000$ independent 10-year iterations using NumPy vectorization (`RNG_SEED = 42`).
  2. When site-specific Phase 2 rainfall is provided, samples monthly rainfall uniformly within a $\pm 20\%$ variance window ($U[0.80 \times R_m, 1.20 \times R_m]$). If absent, samples uniformly between historical $P_{10}$ and $P_{90}$ monthly percentiles loaded from [`thane_rain_percentiles.csv`](file:///d:/VESIT/Capstone/backend/ml_models/thane_rain_percentiles.csv).
  3. Converts sampled precipitation to monthly harvestable yield via physics runoff equations.
  4. Simulates monthly storage carryover across the user-selected tank capacity.
  5. Runs the 10-year compounding inflation cash-flow loop for every sample.
  6. Compiles empirical cumulative break-even distribution:
     $$P(\text{Break-Even} \le Y) = \frac{1}{N} \sum_{i=1}^N \mathbb{I}(\text{Payback}_i \le Y)$$
- **Outputs:** Median break-even year, mean break-even year, $P_{10}/P_{50}/P_{90}$ percentiles, probability table for Years 1–10, and percentage of scenarios failing to break even within 10 years.

---

### Task 5: Daily Historical Water-Balance Tank Sizer
- **Module:** [`services/tank_sizer.py`](file:///d:/VESIT/Capstone/backend/services/tank_sizer.py)
- **Methodology:**
  1. Fetches complete historical daily precipitation (2010–2024) from Open-Meteo.
  2. Reconciles leap years (366 days for 2012, 2016, 2020, 2024) and standard years (365 days).
  3. Evaluates 8 candidate capacities: $[0, 10\text{k}, 20\text{k}, 30\text{k}, 50\text{k}, 75\text{k}, 100\text{k}, 150\text{k} \text{ L}]$.
  4. Daily water-balance loop tracks tank storage, water served to non-potable demand (65 LPCD), recharge overflow, lost overflow, and unmet demand.
  5. Proves exact water mass conservation for every year and candidate:
     $$\text{Total Inflow} = \text{Useful Water} + \text{Recharge Overflow} + \text{Lost Overflow} + \text{Ending Storage}$$
  6. Calculates average multi-year reliability percentage, Capex, annual tanker savings, and candidate payback.

---

### Task 6: ROI Sensitivity Analysis (Gradient Boosting + SHAP)
- **Notebook Implementation:** Cells 10–11 of [`WaterWallet_ml_updated.ipynb`](file:///d:/VESIT/Capstone/WaterWallet_ml_updated.ipynb)
- **Methodology:** 
  1. Generated 10,000 synthetic ROI scenarios sampling financial variables (tanker inflation 5%–14%, Capex ₹2L–₹9L, rainfall 1,200 mm–3,000 mm, demand 500 kL–2,500 kL).
  2. Trained a `GradientBoostingRegressor` to predict break-even year from scenario parameters ($R^2 > 0.90$ on 5-fold CV).
  3. Computed TreeSHAP feature importance ranking across the 10,000 scenarios.
- **Finding:** **Tanker price inflation ($\gamma$) is the single most dominant driver of payback timing**, outranking Capex variance and rainfall variance. A 2% increase in annual tanker inflation accelerates median break-even by 0.7 to 0.9 years.

---

### Task 7: Academic Deep Learning Evaluation (MLP vs. Random Forest)
- **Notebook Implementation:** Cell 20 of [`WaterWallet_ml_updated.ipynb`](file:///d:/VESIT/Capstone/WaterWallet_ml_updated.ipynb)
- **Academic Requirement:** Rigorous evaluation of a Deep Learning neural network architecture against classical machine learning ensembles.
- **Architecture Built:** Multi-Layer Perceptron (MLP) trained with TensorFlow / Keras:
  - Input Layer (10 standardized features via `StandardScaler`)
  - `Dense(64, activation='relu')` + `Dropout(0.20)`
  - `Dense(32, activation='relu')` + `Dropout(0.20)`
  - `Dense(16, activation='relu')`
  - Output Layer: `Dense(1, activation='linear')` (Predicted yield in kL)
  - Optimizer: Adam (`lr=0.001`), Loss: MSE, Early Stopping (`patience=20`, `restore_best_weights=True`).
- **Dataset:** 1,080 samples (10 rooftop variations $\times$ 180 months). Same temporal split (2010–2021 train, 2022–2024 test).
- **Comparative Results:**
  - **Random Forest Regressor:** Lower MAE (4.897 kL), Higher $R^2$ (0.9865).
  - **MLP Neural Network:** Higher MAE, Lower $R^2$ on the holdout test set.
- **Academic Discussion:** On tabular, small-scale datasets ($\sim 10^3$ rows), decision-tree ensemble methods consistently outperform deep neural networks. Neural networks require vast sample densities to learn axis-aligned decision boundaries and feature interactions that Random Forests isolate naturally through bagging. Documenting this negative result validates proper scientific methodology rather than forcing deep learning where classical ML is superior.

---

### Model Artifacts & Actual Validated Metrics

All model metrics below represent actual values verified from [`backend/ml_models/model_metadata.json`](file:///d:/VESIT/Capstone/backend/ml_models/model_metadata.json) and training runs:

| Model / Artifact | File Path | Algorithm | Task | Key Validated Metric | Status |
|---|---|---|---|---|---|
| **RWH Config Classifier** | [`waterwallet_config_classifier.pkl`](file:///d:/VESIT/Capstone/backend/ml_models/waterwallet_config_classifier.pkl) | `CalibratedClassifierCV(RandomForest)` | 3-Class System Recommendation | **Accuracy: 100%**, Balanced Acc: 100%, Macro F1: 1.00 | **Active in API** |
| **Label Encoder** | [`waterwallet_label_encoder.pkl`](file:///d:/VESIT/Capstone/backend/ml_models/waterwallet_label_encoder.pkl) | `LabelEncoder` | Class index to string mapping | Maps classes 0, 1, 2 to RWH system names | **Active in API** |
| **Monthly Yield Regressor** | [`waterwallet_yield_model.pkl`](file:///d:/VESIT/Capstone/backend/ml_models/waterwallet_yield_model.pkl) | `RandomForestRegressor` | Monthly harvestable yield (kL) | **MAE: 4.8973 kL**, **$R^2$: 0.9865** | **Active in API** |
| **Rainfall Percentiles Table** | [`thane_rain_percentiles.csv`](file:///d:/VESIT/Capstone/backend/ml_models/thane_rain_percentiles.csv) | Historical Quantiles (15 yrs) | Monthly $P_{10}, P_{50}, P_{90}$ distributions | 12 months $\times$ 3 percentile columns | **Active in API** |
| **Rainfall Time-Series Model** | Dynamic in [`services/rainfall_forecast.py`](file:///d:/VESIT/Capstone/backend/services/rainfall_forecast.py) | `auto_arima` (Seasonal SARIMA) | 12-month forward precipitation forecast | **Holdout MAE: 68.62 mm** | **Active in API** |
| **Explainability Explainer** | Dynamic in [`services/ml_engine.py`](file:///d:/VESIT/Capstone/backend/services/ml_engine.py) | `shap.TreeExplainer` | Feature marginal attribution | Attributions match physical domain rules | **Active in API** |
| **Deep Learning MLP** | Evaluated in Notebook Cell 20 | Multi-Layer Perceptron (Keras) | Academic DL comparison | Underperformed RF; documented as academic finding | **Notebook Evaluation** |
| **ROI Sensitivity Regressor** | Evaluated in Notebook Cell 11 | `GradientBoostingRegressor` + SHAP | Global sensitivity ranking on 10k runs | Confirms tanker inflation as top driver ($R^2 > 0.90$) | **Notebook Evaluation** |

---

## 8. Backend API Specifications & Pydantic Schemas

FastAPI exposes 14 active, validated REST endpoints across 7 routers with full CORS support.

### Complete Endpoint Directory

| Method | Endpoint Path | Router Tag | Service Handler | Summary |
|---|---|---|---|---|
| `GET` | `/` | Root | `main.py` | API health check |
| `POST` | `/api/auth/register` | Authentication | `routers/auth.py` | Register society manager with hashed password |
| `POST` | `/api/auth/login` | Authentication | `routers/auth.py` | Authenticate credentials & issue JWT token |
| `GET` | `/api/auth/me` | Authentication | `routers/auth.py` | Get current authenticated user profile |
| `POST` | `/api/societies/baseline` | Societies | `services/demand_engine.py` | Canonical IS:1172 daily water demand |
| `POST` | `/api/societies/` | Societies | `routers/societies.py` | Create society profile (DB / In-Memory) |
| `GET` | `/api/societies/` | Societies | `routers/societies.py` | List current user's societies |
| `GET` | `/api/societies/database` | Societies | `routers/societies.py` | List societies persisted in PostgreSQL |
| `GET` | `/api/societies/{id}` | Societies | `routers/societies.py` | Retrieve society profile & billing rows |
| `GET` | `/api/societies/{id}/database` | Societies | `routers/societies.py` | Retrieve persisted society from PostgreSQL |
| `GET` | `/api/societies/{id}/billing` | Societies | `routers/societies.py` | Get persisted billing rows from PostgreSQL |
| `PUT` | `/api/societies/{id}` | Societies | `routers/societies.py` | Update existing society profile |
| `POST` | `/api/societies/{id}/billing` | Societies | `routers/societies.py` | Save or replace monthly billing records |
| `POST` | `/api/societies/{id}/analyses` | Societies | `routers/societies.py` | Save computed analysis snapshot |
| `GET` | `/api/societies/{id}/analyses/latest` | Societies | `routers/societies.py` | Get latest saved analysis snapshot |
| `POST` | `/api/catchment/calculate` | Geospatial | `services/rainfall_api.py` | Open-Meteo 15-yr rainfall + physics yield |
| `POST` | `/api/catchment/forecast` | Geospatial | `services/rainfall_forecast.py` | Auto-SARIMA dynamic 12-month forecast |
| `POST` | `/api/ml/recommend` | ML Recommend | `services/tier1_safety.py` & `ml_engine.py` | Tier 1 safety gate + Tier 2 RF + SHAP |
| `POST` | `/api/ml/yield` | ML Yield | `services/ml_engine.py` | RF monthly yield prediction with fallback |
| `POST` | `/api/roi/simulate` | ROI | `services/roi_engine.py` | Deterministic 10-year cash flow simulation |
| `POST` | `/api/roi/monte-carlo` | ROI | `services/monte_carlo.py` | 1,000-scenario stochastic ROI simulation |
| `POST` | `/api/roi/tank-sizer` | ROI | `services/tank_sizer.py` | Daily historical water-balance tank sizer |
| `POST` | `/api/advisory/water` | AI Advisory | `routers/advisory.py` | Grounded Groq LLM committee advisory |

---

### Detailed Request / Response Schema Examples

#### 1. RWH System Recommendation: `POST /api/ml/recommend`
Evaluates physical safety constraints (Tier 1), then runs the calibrated Random Forest classifier with TreeSHAP feature attributions (Tier 2).

**Request Payload:**
```json
{
  "rooftop_area": 960.0,
  "borewell": 1,
  "borewell_depth": 95.0,
  "soil_perm": 3,
  "coastal_km": 25.0,
  "annual_rain_mm": 2347.0,
  "peak_day_mm": 180.0
}
```

**Response (Tier 2 ML Path — All Safety Checks Passed):**
```json
{
  "config": "Hybrid",
  "confidence": 0.96,
  "source": "rf_classifier",
  "safety_triggered": false,
  "safety_reason": null,
  "shap_values": [
    { "feature": "borewell", "value": 1.0, "shap": 0.1724 },
    { "feature": "borewell_depth", "value": 95.0, "shap": 0.1621 },
    { "feature": "rooftop_area", "value": 960.0, "shap": 0.1610 },
    { "feature": "coastal_km", "value": 25.0, "shap": 0.0442 },
    { "feature": "soil_perm", "value": 3.0, "shap": 0.0381 },
    { "feature": "annual_rain_mm", "value": 2347.0, "shap": 0.0152 },
    { "feature": "peak_day_mm", "value": 180.0, "shap": -0.0021 }
  ],
  "plain_language": "Hybrid recommended because borewell presence, borewell depth (95 m), and rooftop area (960 m²) support this configuration.",
  "shap_available": true,
  "explanation_warning": null
}
```

**Response (Tier 1 Safety Gate Triggered — Coastal Distance $\le 2.5$ km):**
```json
{
  "config": "Storage-Only",
  "confidence": 1.0,
  "source": "tier1_safety_gate",
  "safety_triggered": true,
  "safety_reason": "Site is only 1.8 km from the coast. CGWB guidelines require a minimum of 2.5 km from the coastline before groundwater recharge is safe. Recharge at this location risks seawater intrusion into aquifers.",
  "shap_values": [],
  "plain_language": "Site is only 1.8 km from the coast. CGWB guidelines require a minimum of 2.5 km from the coastline before groundwater recharge is safe. Recharge at this location risks seawater intrusion into aquifers.",
  "shap_available": false,
  "explanation_warning": "SHAP is not used when the safety gate forces the recommendation."
}
```

---

#### 2. Probabilistic Monte Carlo Simulation: `POST /api/roi/monte-carlo`
Runs 1,000 stochastic simulations sampling monthly precipitation from historical distributions.

**Request Payload:**
```json
{
  "rooftop_area_m2": 960.0,
  "monthly_demand_kl": 1038.8,
  "capex_inr": 576000.0,
  "tank_capacity_litres": 50000.0,
  "rainfall_reduction_percent": 0.0,
  "tanker_rate_per_kl": 800.0,
  "annual_tanker_volume_litres": 700000.0,
  "water_tariff_per_kl": 15.0,
  "inflation_rate": 0.08,
  "n_scenarios": 1000,
  "monthly_rainfall_mm": [1.0, 1.0, 2.0, 18.0, 110.0, 510.0, 710.0, 580.0, 300.0, 95.0, 18.0, 2.0]
}
```

**Response:**
```json
{
  "median_breakeven_year": 2,
  "mean_breakeven_year": 2.24,
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
  "percentiles": {
    "p10": 2,
    "p50": 2,
    "p90": 3
  },
  "n_scenarios": 1000,
  "never_break_even_pct": 0.0,
  "scenarios_used": "phase2_monthly_rainfall",
  "is_site_specific": true
}
```

---

#### 3. Daily Water-Balance Tank Sizer: `POST /api/roi/tank-sizer`
Simulates daily water balance across historical daily records for candidate capacities.

**Request Payload:**
```json
{
  "latitude": 19.2183,
  "longitude": 72.9781,
  "gross_roof_area_sqm": 1200.0,
  "roof_surface_type": "concrete",
  "daily_demand_litres": 13000.0,
  "candidate_capacities_litres": [0, 10000, 20000, 30000, 50000, 75000, 100000],
  "tanker_rate_per_litre": 0.80,
  "tank_cost_per_litre": 4.0,
  "fixed_system_cost": 7200.0,
  "first_flush_fraction": 0.05,
  "reliability_target_percent": 80.0,
  "recharge_enabled": true
}
```

**Response:**
```json
{
  "selected_candidate": {
    "capacity_litres": 50000.0,
    "useful_water_litres": 1421800.0,
    "recharge_overflow_litres": 194200.0,
    "lost_overflow_litres": 0.0,
    "unmet_demand_litres": 3323200.0,
    "reliability_percent": 84.2,
    "estimated_capex_inr": 207200.0,
    "annual_savings_inr": 1137440.0,
    "payback_years": 0.18
  },
  "reliability_target_met": true,
  "selection_reason": "Smallest tested tank meeting the 80% average reliability target.",
  "selection_status": "meets_reliability_target",
  "reliability_target_percent": 80.0,
  "candidates": [ ... ],
  "years_used": [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  "source": "open_meteo_daily",
  "fallback_used": false
}
```

---

#### 4. Grounded AI Advisory: `POST /api/advisory/water`
Generates a structured plain-language summary via Groq LLM inference, strictly bounded to pre-calculated parameters.

**Request Payload:**
```json
{
  "focus": "managing committee presentation",
  "society_name": "Evergreen Heights CHS",
  "flats": 50,
  "occupants_per_flat": 4.0,
  "annual_demand_litres": 12466575.0,
  "annual_yield_litres": 1617840.0,
  "estimated_capex_inr": 576000.0,
  "current_annual_water_cost_inr": 203100.0,
  "payback_years": "Year 2",
  "self_sufficiency_percent": 130.0,
  "recommended_configuration": "Hybrid",
  "monte_carlo_median_breakeven_year": 2,
  "monte_carlo_never_break_even_percent": 0.0
}
```

**Response:**
```json
{
  "summary": "Evergreen Heights CHS demonstrates strong financial and hydrological viability for Rainwater Harvesting. With a high self-sufficiency potential of 130% relative to non-potable demand, capital expenditure of ₹5.76 Lakhs is projected to break even within Year 2 under typical monsoon conditions.",
  "recommendations": [
    "Adopt the recommended Hybrid system combining a 50 kL storage tank with overflow routed to the existing 95 m borewell.",
    "Present the 10-year financial projection to the managing committee highlighting the 91% probability of full payback by Year 4.",
    "Commission a licensed civil engineer to inspect rooftop downpipe locations and structural slab load limits prior to final procurement."
  ],
  "risks": [
    "Rainfall concentration is highly monsoonal; tank overflow will occur during intense July bursts if filtration maintenance is neglected.",
    "Payback timing depends on continued tanker water substitution; if municipal tanker supply stabilizes, monetary savings will accrue slower."
  ],
  "assumptions": [
    "Domestic demand assumes IS:1172 baseline of 135 LPCD with 15% distribution losses and 10% peak surge buffer.",
    "Tanker water replacement savings assume private water tanker tariffs escalating at 8% per annum."
  ]
}
```

---

## 9. Database Schema, Migrations & Persistence

WaterWallet features a relational database schema designed for multi-tenant society profiling, historical billing logs, and immutable analysis snapshots.

### SQLAlchemy Relational Schema ([`models/db_models.py`](file:///d:/VESIT/Capstone/backend/models/db_models.py))

```mermaid
erDiagram
    users ||--o{ societies : owns
    societies ||--o{ billing_entries : contains
    societies ||--o{ society_analyses : records

    users {
        int id PK
        string email UK
        string hashed_password
        string role
        datetime created_at
    }

    societies {
        int id PK
        int user_id FK
        string name
        string pincode
        int num_flats
        float occupants
        string roof_surface_type
        datetime created_at
    }

    billing_entries {
        int id PK
        int society_id FK
        int month
        int year
        float municipal_bill
        int tankers
        float cost_per_tanker
        float tanker_capacity_l
    }

    society_analyses {
        int id PK
        int society_id FK
        float estimated_capex
        float annual_yield_l
        float annual_demand_l
        jsonb computed_data
        datetime created_at
    }
```

### Table Definitions & Foreign Key Cascades
1. **`users` Table:** Stores authenticated user accounts. Features unique email index and role-based metadata.
2. **`societies` Table:** Stores housing society profiles (`num_flats`, `occupants`, `roof_surface_type`). Associated with `user_id` (`ON DELETE SET NULL`) to enforce authorization boundaries.
3. **`billing_entries` Table:** Monthly billing entries with `society_id` (`ON DELETE CASCADE`), storing municipal charges and tanker delivery logs.
4. **`society_analyses` Table:** Historical audit snapshots with `society_id` (`ON DELETE CASCADE`). Contains calculated metrics and a PostgreSQL `JSONB` column storing full serializations of model outputs, coordinates, and Monte Carlo curves.

### Database Migrations (Alembic)
The `alembic/` directory contains automated, forward-compatible migration scripts.
- To execute pending migrations:
  ```bash
  cd backend
  alembic upgrade head
  ```

### Resilient Dual-Store Architecture
To guarantee seamless local development and presentation when PostgreSQL or Supabase credentials are not configured, [`routers/societies.py`](file:///d:/VESIT/Capstone/backend/routers/societies.py) implements a **resilient dual-store pattern**:
- Normal CRUD routes (`POST /api/societies/`, `GET /api/societies/`, etc.) maintain an authenticated, user-scoped in-memory store.
- Explicit database endpoints (`GET /api/societies/database`, `GET /api/societies/{id}/database`, `POST /api/societies/{id}/analyses`) attempt PostgreSQL queries, falling back gracefully to in-memory storage if `SQLAlchemyError` or connection drops occur.

---

## 10. Installation, Configuration & Execution Guide

### Prerequisites
- **Node.js:** v18.0.0 or later (v20+ recommended)
- **npm:** v9.0.0 or later
- **Python:** v3.10 to v3.13 (Python 3.13.1 verified)
- **Git**

---

### Step 1: Clone Repository
```bash
git clone https://github.com/nidhish-shirur/capstone-waterwallet.git
cd capstone-waterwallet
```

---

### Step 2: Backend Setup & Environment Configuration
Open a terminal in the project root:

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (cmd):
.venv\Scripts\activate.bat
# Linux / macOS:
source .venv/bin/activate

# Install exact Python dependencies
pip install -r requirements.txt
```

#### Backend Environment File: `backend/.env`
Create or edit `backend/.env`:
```ini
# Environment
ENV=development

# Authentication (Mandatory: 32+ character random string)
JWT_SECRET_KEY=waterwallet-capstone-jwt-secret-key-super-secure-2026
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# Database (PostgreSQL / Supabase - optional; system falls back to in-memory store if offline)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/waterwallet

# AI Advisory (Groq Cloud API - optional; required for natural language advisory)
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

---

### Step 3: Train or Verify Machine Learning Models
Model artifacts are pre-bundled in `backend/ml_models/`. To retrain the models from scratch:

```bash
# Ensure virtual environment is active in backend directory
python ml_models/train_models.py
```
*This script fetches 15 years of daily rainfall from Open-Meteo, generates 600 synthetic site configurations, trains the Calibrated Random Forest Classifier and Yield Regressor, and updates `model_metadata.json` and `thane_rain_percentiles.csv`.*

---

### Step 4: Launch Backend API Server
```bash
# From backend directory
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
- API will start at: `http://localhost:8000`
- Interactive OpenAPI documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/`

---

### Step 5: Frontend Setup & Dev Server
Open a second terminal in the project root (`D:\VESIT\Capstone`):

```bash
# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
- Frontend will launch at: `http://localhost:5173`

---

### Step 6: Production Build Verification
To validate production compilation and tree-shaking:
```bash
npm run build
```
*Build artifacts are written to `dist/`.*

---

## 11. Verification, Testing & Troubleshooting

### Automated Test Suite Execution
The backend includes automated unit tests verifying daily water-balance equations, leap-year handling, monotonic capacity scaling, and Monte Carlo integration.

From the `backend` directory:
```bash
python -m pytest tests -v
```

#### Test Suite Verification Results

```text
============================= test session starts =============================
platform win32 -- Python 3.13.1, pytest-9.1.1, pluggy-1.6.0
rootdir: D:\VESIT\Capstone\backend
collected 7 items

tests\test_monte_carlo_integration.py::MonteCarloIntegrationTests::test_phase_two_rainfall_is_used_and_reported PASSED [ 14%]
tests\test_monte_carlo_integration.py::MonteCarloIntegrationTests::test_phase_two_rainfall_changes_downstream_result PASSED [ 28%]
tests\test_monte_carlo_integration.py::MonteCarloIntegrationTests::test_phase_two_rainfall_requires_twelve_non_negative_values PASSED [ 42%]
tests\test_tank_sizer.py::TankSizerTests::test_simulator_uses_actual_year_length PASSED [ 57%]
tests\test_tank_sizer.py::TankSizerTests::test_water_reconciliation_holds_for_each_year_and_candidate PASSED [ 71%]
tests\test_tank_sizer.py::TankSizerTests::test_zero_capacity_is_do_nothing_baseline PASSED [ 85%]
tests\test_tank_sizer.py::TankSizerTests::test_outputs_are_monotonic_as_capacity_increases PASSED [100%]

============================== 7 passed in 2.78s ==============================
```

#### What These Tests Prove:
1. `test_simulator_uses_actual_year_length`: Verifies that leap years (2012, 2016, 2020, 2024) are simulated over 366 daily records and standard years over 365 days.
2. `test_water_reconciliation_holds_for_each_year_and_candidate`: Mathematically proves mass conservation: $\text{Useful} + \text{Recharge} + \text{Lost} + \text{Ending Storage} == \text{Total Inflow}$.
3. `test_zero_capacity_is_do_nothing_baseline`: Proves a zero-capacity tank serves 0 L, provides 0% reliability, generates ₹0 savings, and yields no payback.
4. `test_outputs_are_monotonic_as_capacity_increases`: Proves that useful water and reliability strictly increase while overflow and unmet demand strictly decrease as tank capacity grows.
5. `test_phase_two_rainfall_*`: Verifies that site-specific monthly rainfall from Map Studio flows into Monte Carlo simulations, alters payback distributions, and rejects invalid negative rainfall arrays.

---

### Common Troubleshooting Scenarios

| Issue | Root Cause | Solution |
|---|---|---|
| **`scikit-learn version mismatch` on backend startup** | Joblib model files were serialized with a different scikit-learn version than installed in Python environment | Run `python ml_models/train_models.py` in `backend` to re-train and re-serialize the models under current `scikit-learn==1.9.0`. |
| **`ModuleNotFoundError: No module named 'services'` when running pytest** | Pytest invoked from root directory without Python path pointing to backend | Run `python -m pytest tests` from inside the `backend/` directory so the root of the backend package is in `sys.path`. |
| **Map satellite tiles fail to render** | Internet connectivity issue or Leaflet container sizing before DOM layout | Click the map to trigger `map.invalidateSize()`; verify access to `server.arcgisonline.com`. |
| **AI Advisory returns HTTP 503** | `GROQ_API_KEY` is missing in `backend/.env` | Obtain a free API key at `console.groq.com` and add `GROQ_API_KEY=gsk_...` to `backend/.env`. |
| **Database connection error in console** | Local PostgreSQL or Supabase instance is offline | WaterWallet automatically falls back to its in-memory session store. Core calculations remain 100% operational. |

---

## 12. Implementation Status, Honest Limitations & Future Scope

### Implementation Status Matrix

| Feature / Module | Implementation Status | Verification Evidence | Notes |
|---|---|---|---|
| **Phase 1: Demand Engine** | **Completed** | `demand_engine.py`, `waterConstants.js` | Canonical IS:1172, UFW losses, peak buffer fully synchronized |
| **Historical Billing Tracker** | **Completed** | `VirtualMeter.jsx`, `societies.py` | Full multi-month tabular tracker, volume and expenditure aggregation |
| **Metered Data Override** | **Completed** | `VirtualMeter.jsx` | Supports monthly, quarterly, annual metered bill inputs |
| **Phase 2: Leaflet Map Studio** | **Completed** | `MapStudio.jsx`, Turf.js | Geodesic area, 20% obstacle factor, centroid extraction |
| **Open-Meteo Weather Integration** | **Completed** | `rainfall_api.py` | 15-yr daily and monthly precipitation fetched via HTTPX |
| **Dynamic Auto-SARIMA Forecasting** | **Completed** | `rainfall_forecast.py` | Stepwise seasonal SARIMA AIC search on historical coordinates |
| **Phase 3: Multi-Scenario Cash Flow** | **Completed** | `ROIDashboard.jsx`, `roi_engine.py` | Conservative (6%), Current (8%), High-Risk (12%) curves |
| **Tier 1 Hydrogeological Safety Gate**| **Completed** | `tier1_safety.py` | 4 hard physical checks take absolute precedence over ML |
| **Tier 2 Calibrated RF Classifier** | **Completed** | `ml_engine.py`, `train_models.py` | Calibrated Random Forest (100% accuracy, calibrated probabilities) |
| **TreeSHAP Explainability** | **Completed** | `ml_engine.py`, `shap` | Marginal feature weights & plain-English summary generation |
| **RF Monthly Yield Regressor** | **Completed** | `ml_engine.py` | 10 features, MAE 4.89 kL, $R^2 = 0.9865$, physics fallback |
| **1,000-Scenario Monte Carlo ROI** | **Completed** | `monte_carlo.py` | Probabilistic break-even distribution from historical quantiles |
| **Daily Water-Balance Tank Sizer** | **Completed** | `tank_sizer.py`, `test_tank_sizer.py` | 8 candidate capacities, leap-year handling, mass conservation |
| **Interactive What-If Controls** | **Completed** | `ROIDashboard.jsx` | 8 real-time sliders for roof, depth, soil, coast, capex, tank |
| **Grounded Groq AI Advisory** | **Completed** | `advisory.py` | JSON-constrained LLM advisory on validated facts |
| **In-Browser PDF Report Generator** | **Completed** | `ROIDashboard.jsx` | Native print-to-PDF with self-contained, escaped HTML styling |
| **JWT User Authentication** | **Completed** | `auth.py`, `AuthContext.jsx` | Bcrypt hashing, signed JWT tokens, protected frontend routes |
| **PostgreSQL / SQLAlchemy Schema** | **Completed** | `db_models.py`, `alembic/` | Users, societies, billing, analyses with JSONB snapshots |
| **Server-Side WeasyPrint PDF** | **Deprecated / Replaced** | `report.py` replaced | Replaced by in-browser print path to remove GTK3 system library dependency |
| **Real Field Site Classifier Data** | **Partial (1 Site Validated)** | Field collection | 600 synthetic training samples + 1 real Thane society validation |

---

### Honest Engineering Limitations
1. **Synthetic Classifier Training Data:** The 600 training samples for the Tier 2 Random Forest classifier are generated from BMC, CGWB, and CPHEEO engineering rules rather than field surveys of 600 constructed sites. While the model accurately recovers complex rule boundaries and provides smooth uncertainty gradients, broader empirical training on 50+ real housing societies is desirable.
2. **Rainfall Reanalysis vs. Micro-Catchment Rain Gauges:** Open-Meteo utilizes ERA5/CERRA satellite and radar reanalysis ($0.1^\circ$ grid $\approx 9\text{ km}$). Highly localized convective rainstorms occurring over individual hills or coastal pockets in the MMR are smoothed over the grid cell.
3. **Pre-Consultation Boundary:** WaterWallet does not replace structural load assessments (confirming whether an existing terrace slab can support a 50-tonne water tank) or licensed hydrogeologist borehole logging.
4. **Municipal Sewer Proximity:** BMC does not publish open GIS vector layers for underground municipal sewer networks. Consequently, the CGWB guideline requiring artificial recharge borewells to maintain a 15-metre buffer from underground sewers cannot currently be automated on the map.

---

### Future Scope
1. **Empirical MMR Field Survey Expansion:** Partner with cooperative housing federations in Thane and Mumbai Suburban to survey 50 installed RWH systems, replacing synthetic classifier training data with empirical performance observations.
2. **High-Resolution Drone / 3D Photogrammetry Ingestion:** Enable society committees to upload drone photogrammetry or high-resolution orthomosaics to automatically detect terrace equipment (solar panels, lift rooms, plumbing shafts) using computer vision semantic segmentation (U-Net).
3. **Automated BMC Rebate Application Generator:** Integrate BMC's official property tax rebate forms (which grant a 2% to 5% property tax discount for compliant RWH systems) into the reporting pipeline.
4. **Real-Time IoT Virtual Metering Integration:** Provide an optional API webhook for societies that install digital flow meters on their downpipes, comparing real-time harvested yield against WaterWallet's predictive model.

---

*WaterWallet — Turning Monsoon Rain into Financial Proof.*  
*VESIT Capstone 2025–26 | Department of Computer Engineering*
