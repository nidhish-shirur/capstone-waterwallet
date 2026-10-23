# WaterWallet

> A full-stack rainwater-harvesting decision-support platform that helps housing societies quantify water demand, estimate rooftop yield, compare RWH configurations, and evaluate financial payback.

[![Build](https://img.shields.io/badge/build-local%20validation-informational)](https://github.com/nidhish-shirur/capstone-waterwallet)
[![Version](https://img.shields.io/badge/version-0.0.0-blue)](./package.json)
[![License](https://img.shields.io/badge/license-not%20specified-lightgrey)](#license)

## About

WaterWallet is a capstone project for residential housing societies in the Mumbai Metropolitan Region. It brings together society demand data, tanker and municipal billing history, map-derived rooftop area, location-specific rainfall, rainwater-harvesting recommendations, and ROI analysis in one workflow.

The application is designed for feasibility screening and committee decision support. Its calculations and recommendations help users ask better questions before commissioning detailed civil or hydrogeological engineering work; they are not a substitute for a final site design or regulatory approval.

## Key Features

- **Virtual Meter:** Calculate baseline daily and annual demand using IS:1172-style 135 LPCD demand, optional 15% UFW losses, and a 10% peak-demand buffer.
- **Billing and tanker analysis:** Record municipal bills, tanker counts, tanker capacity, and tanker spend to quantify current water costs.
- **Map Studio:** Trace a rooftop catchment polygon on a Leaflet satellite map and calculate geodesic area with Turf.js.
- **Rainfall and yield estimation:** Fetch historical precipitation from Open-Meteo and convert monthly rainfall into harvestable yield.
- **Rainfall forecasting:** Forecast monthly rainfall with seasonal Auto-SARIMA when the forecasting dependencies and data support it.
- **RWH configuration recommendation:** Apply a Tier 1 hydrogeological safety gate before using the Random Forest classifier.
- **Explainable ML:** Return configuration confidence and SHAP feature contributions when the classifier path is used.
- **ROI simulation:** Compare deterministic multi-year savings, payback, and a 1,000-scenario Monte Carlo break-even distribution.
- **Tank sizing:** Evaluate candidate tank capacities against historical daily rainfall, demand, reliability targets, overflow, and recharge settings.
- **AI advisory:** Optionally generate a plain-language committee advisory through Groq using already-calculated metrics.
- **Connected workflow:** React Context carries society, catchment, yield, and ROI state across the Virtual Meter, Map Studio, and ROI Dashboard views.
- **API documentation:** FastAPI exposes interactive OpenAPI documentation at `/docs`.

## Tech Stack

### Frontend

- JavaScript (ES modules)
- React 19
- Vite 8
- React Router
- Axios
- Leaflet and React Leaflet
- Turf.js
- Recharts
- Tailwind CSS via the Vite plugin
- ESLint

### Backend

- Python 3
- FastAPI and Uvicorn
- Pydantic v2 and `pydantic-settings`
- SQLAlchemy and Alembic
- PostgreSQL support through `psycopg2-binary`
- HTTPX for Open-Meteo and Groq API calls
- scikit-learn, pandas, NumPy, Joblib, SHAP
- pmdarima and statsmodels for rainfall forecasting
- python-jose and Passlib for the authentication code path

### External services and data

- **Open-Meteo Archive API:** Rainfall and daily precipitation use a rolling 15-complete-calendar-year window. Monthly aggregation is used for yield estimation; daily resolution is used for tank sizing. Monthly catchment and forecast responses identify when regional fallback data is used.
- **Groq API (optional):** Natural-language water advisories.
- **Esri World Imagery tiles:** Satellite imagery displayed by Map Studio.
- **Bundled model artifacts:** Random Forest classifier and yield model files under [`backend/ml_models/`](./backend/ml_models/).

## Architecture and Data Flow

```text
React + Vite
  ├── Virtual Meter ── society demand and billing inputs
  ├── Map Studio ──── rooftop polygon, rainfall, yield, and recommendation inputs
  └── ROI Dashboard ─ savings, tank sizing, and break-even analysis
          │
          ▼
FastAPI
  ├── Demand and society routes
  ├── Catchment and rainfall routes ── Open-Meteo
  ├── ML recommendation and yield routes
  ├── ROI, Monte Carlo, and tank-sizing routes
  └── Optional advisory route ──────── Groq
```

## Directory Structure

```text
.
├── backend/
│   ├── main.py                  # FastAPI application and router registration
│   ├── config.py                # Environment-backed settings
│   ├── database.py              # SQLAlchemy engine and sessions
│   ├── requirements.txt         # Python dependencies
│   ├── alembic/                 # Database migrations
│   ├── models/                  # ORM models, schemas, and constants
│   ├── routers/                 # HTTP API endpoints
│   ├── services/                # Demand, rainfall, yield, ROI, ML, and tank logic
│   ├── ml_models/               # Trained model artifacts and training utilities
│   └── tests/                   # Backend unit tests
├── public/                      # Static frontend assets
├── src/
│   ├── App.jsx                  # Routes and application shell
│   ├── api/waterwallet.js       # Axios API client
│   ├── components/              # Sidebar and top bar
│   ├── context/                 # Shared React state
│   ├── utils/                   # Constants and formatters
│   └── views/                   # Virtual Meter, Map Studio, ROI Dashboard
├── index.html                   # Vite HTML entry point
├── package.json                 # Frontend scripts and dependencies
├── Capstone.md                  # Project design and implementation notes
├── POC_REPORT.md                # Scope, evidence, limitations, and POC verdict
└── TECHNICAL_REFERENCE.md       # Formulas, API contracts, and model details
```

## Getting Started

### Prerequisites

- Node.js **20.19+** or **22.12+**
- npm
- Python **3.10+** (Python 3.11 is a practical choice for the listed data-science packages)
- A PostgreSQL database for the SQLAlchemy/Alembic persistence path
- A modern browser with JavaScript enabled
- Optional: a Groq API key for the AI advisory endpoint

### 1. Install frontend dependencies

From the repository root:

```powershell
npm install
```

### 2. Create and configure the backend environment

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create `backend/.env` with a database connection and any optional integrations:

```dotenv
DATABASE_URL=postgresql+psycopg2://waterwallet:password@localhost:5432/waterwallet

# Optional: enables POST /api/advisory/water
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

# Set a strong, unique secret before deploying the authenticated application.
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```

Do not commit `backend/.env` or real credentials. The frontend reads its API URL from a root `.env` file. The default is `http://localhost:8000`, so a root `.env` is optional for local development:

```dotenv
VITE_API_URL=http://localhost:8000
```

### 3. Apply database migrations

With the virtual environment active and `backend/.env` available:

```powershell
cd backend
alembic upgrade head
```

### 4. Start the backend

From `backend/`:

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Verify the API:

```powershell
Invoke-RestMethod http://localhost:8000/
```

Expected response:

```json
{"status":"ok","service":"WaterWallet API"}
```

### 5. Start the frontend

Open a second terminal at the repository root:

```powershell
npm run dev
```

Open <http://localhost:5173>. The frontend redirects the root route to `/virtual-meter`.

## Usage

### Typical workflow

1. Open **Virtual Meter** and enter the society name, flats, occupants, billing rows, and tanker costs.
2. Review baseline demand, tanker expenditure, and annualized water requirements.
3. Open **Map Studio** and click around the rooftop to create a polygon. Close the polygon to calculate area, rainfall, yield, and estimated capex.
4. Provide site details such as soil permeability, borewell status, borewell depth, and distance from the coast when requesting an RWH configuration.
5. Open **ROI Dashboard** to review deterministic payback, Monte Carlo break-even probabilities, and tank-sizing outputs.
6. Use the browser print flow if a shareable report is needed.

### Example API request

Calculate baseline demand for a 50-flat society with four occupants per flat:

```powershell
$body = @{
  num_flats = 50
  occupants_per_flat = 4
  include_losses = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://localhost:8000/api/societies/baseline `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Explore all request and response schemas at <http://localhost:8000/docs>.

### Useful commands

```powershell
# Frontend development server
npm run dev

# Production frontend build
npm run build

# Lint the frontend
npm run lint

# Preview the production frontend build
npm run preview

# Run backend unit tests from backend/
python -m unittest discover -s tests
```

## API Surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | API health check |
| `POST` | `/api/societies/baseline` | Calculate society demand |
| `POST` | `/api/societies/` | Create a society record |
| `GET` | `/api/societies/` | List society records |
| `POST` | `/api/catchment/calculate` | Fetch rainfall and calculate catchment yield |
| `POST` | `/api/catchment/forecast` | Forecast rainfall and calculate forecast yield |
| `POST` | `/api/roi/simulate` | Run deterministic ROI simulation |
| `POST` | `/api/roi/monte-carlo` | Run probabilistic ROI simulation |
| `POST` | `/api/roi/tank-sizer` | Evaluate tank capacities |
| `POST` | `/api/ml/recommend` | Get a safety-gated ML configuration recommendation |
| `POST` | `/api/ml/yield` | Predict monthly yield with a physics fallback |
| `POST` | `/api/advisory/water` | Generate an optional Groq-powered advisory |

## Current Limitations

- Login and protected frontend routes are active, and society routes enforce bearer-token ownership. Calculation endpoints are not uniformly authenticated; do not expose the API publicly until route-level authorization is reviewed.
- Normal society CRUD currently uses a temporary in-memory store; database read-only loader routes are separate.
- The advisory endpoint requires `GROQ_API_KEY` and network access; it is not required for the core calculations.
- External rainfall, satellite-tile, and AI services can fail or be rate-limited.
- Bundled ML models support the prototype workflow but require broader validation with real labelled sites before production use.
- The project is a feasibility prototype, not a substitute for certified structural, drainage, groundwater, or regulatory review.

See [`POC_REPORT.md`](./POC_REPORT.md) for the evidence-based scope, known gaps, and production-readiness assessment.

## Roadmap

- Apply consistent authentication and authorization to calculation endpoints before public deployment.
- Replace temporary in-memory CRUD with complete transactional database persistence.
- Add frontend component, API integration, and end-to-end tests.
- Expand ML training data and publish model validation metrics.
- Add production deployment configuration, observability, and secret management.
- Complete server-side report generation and downloadable report storage.
- Improve site-specific hydrological inputs and validation with domain experts.

## Contributing

1. Create a focused branch from the current default branch.
2. Keep frontend changes under `src/` and backend changes under `backend/`.
3. Update relevant API or technical documentation when behavior changes.
4. Run the smallest applicable checks before opening a pull request:

   ```powershell
   npm run lint
   npm run build
   cd backend
   python -m unittest discover -s tests
   ```

5. Describe configuration changes, database migration requirements, and known limitations in the pull request.

There is currently no separate `CONTRIBUTING.md`; this section is the contribution guide for the prototype.

## License

This repository does not currently include a `LICENSE` file or declare a license in `package.json`. Add a license before distributing or reusing the project. Until then, copyright and reuse permissions remain with the repository owner.

## Additional Documentation

- [`Capstone.md`](./Capstone.md) — system design and implementation notes
- [`POC_REPORT.md`](./POC_REPORT.md) — proof-of-concept scope, evidence, and limitations
- [`TECHNICAL_REFERENCE.md`](./TECHNICAL_REFERENCE.md) — formulas, algorithms, schemas, and endpoint examples
