# 💧 WaterWallet — Rainwater Harvesting Intelligence Platform

> A data-driven SaaS web application that helps residential housing societies in the Mumbai Metropolitan Region (MMR) quantify their current water expenditure, design a rainwater harvesting (RWH) system, and simulate its 10-year financial return on investment.

---

## 🧭 Project Overview

WaterWallet is a **capstone engineering project** built as a three-step decision-support tool for cooperative housing societies (CHS) considering the adoption of Rainwater Harvesting (RWH) systems. The platform guides a user from raw billing data all the way through to a compounding ROI simulation — no spreadsheet required.

The core problem it solves: most housing societies in MMR know they're overspending on water (private tankers + municipal bills), but have no way to quantify the problem or build a business case for infrastructure investment. WaterWallet closes that gap.

---

## ✨ Feature Highlights

| Feature | Description |
|---------|-------------|
| 🏗️ **Virtual Meter** | Configure society parameters (flats, occupants) to compute baseline daily water demand using IS:1172 (135 LPCD) |
| ⚖️ **UFW Distribution Losses** | Toggleable 15% Unaccounted-For Water (UFW) loss factor per CPHEEO norms — models pipe leakage, metering error, and unregistered connections |
| 🔢 **Actual Metered Data Override** | Switch from theoretical IS:1172 calculations to real-world metered bills — enter your society's actual consumption and bill per period (Monthly/Quarterly/Half-Yearly/Yearly) to override the model |
| 🧾 **Billing Log Table** | Editable month-by-month historical log of municipal bills + private tanker procurement with configurable tanker capacity (L). Auto-highlights months with abnormally high tanker reliance |
| 🗺️ **Map Studio** | Click-to-trace polygon tool on a satellite map (Leaflet + ESRI World Imagery) with a crosshair cursor to measure rooftop catchment area in real-time using Turf.js geometry |
| 🌧️ **Live Weather & Monsoon Tracking** | Fetches historical daily precipitation data from Open-Meteo archive API for the traced location's coordinates to compute annual rainfall, monthly distribution, and a Monsoon Dependency Score |
| 📐 **RWH Capex Estimator** | Calculates parametric CAPEX applying a 0.90 runoff coefficient and 20% obstacle deduction — with a live sensitivity slider (₹400–₹800/m²) |
| 📈 **Scenario-Based ROI Simulator** | 10-year compounding financial model overlaying three tanker inflation scenarios (Conservative 6%, Current 8%, High-Risk 12%) vs RWH cost. Includes a self-sufficiency rating and dynamic break-even plotting |
| 📄 **Server-Side PDF Reports** | Generates a professional PDF report via the FastAPI backend using WeasyPrint + Jinja2 HTML templates, combining financial and hydrological findings |
| 🔁 **Live Context Propagation** | All three views are connected via React Context — changes in Step 1 instantly feed into the ROI model and self-sufficiency indicators in Step 3 |

---

## 🏛️ Architecture

```
waterwallet/
│
├── backend/                        # Python FastAPI backend
│   ├── main.py                     # FastAPI app entry point + CORS config
│   ├── requirements.txt            # Python dependencies
│   ├── routers/
│   │   ├── societies.py            # CRUD routes & POST /api/societies/baseline
│   │   ├── geospatial.py           # POST /api/catchment/calculate
│   │   ├── roi.py                  # POST /api/roi/simulate
│   │   └── report.py              # POST /api/report/generate (PDF)
│   ├── services/
│   │   ├── demand_engine.py        # IS:1172 demand computation
│   │   ├── rainfall_api.py         # Open-Meteo async HTTP client
│   │   ├── yield_engine.py         # Rooftop yield & CAPEX calc
│   │   ├── roi_engine.py           # Multi-year ROI simulation
│   │   └── pdf_generator.py        # WeasyPrint PDF rendering
│   ├── models/                     # Pydantic request/response schemas
│   └── templates/                  # Jinja2 HTML templates for PDF
│
└── src/                            # React + Vite frontend
    ├── App.jsx                     # Root — BrowserRouter, layout shell
    ├── main.jsx                    # React 19 entry point
    ├── index.css                   # Global styles + custom toggle switch CSS
    │
    ├── api/
    │   └── waterwallet.js          # Axios client — typed wrappers for all API endpoints
    │
    ├── utils/
    │   ├── waterConstants.js       # IS_LPCD, UFW_LOSS_FACTOR, calculateCanonicalDemand()
    │   └── formatters.js           # INR currency & number formatters
    │
    ├── context/
    │   └── WaterWalletContext.jsx  # Global state provider (React Context API)
    │
    ├── components/
    │   ├── Sidebar.jsx             # Navigation — 3-step wizard sidebar
    │   └── Topbar.jsx              # Top header bar
    │
    └── views/
        ├── VirtualMeter.jsx        # Step 1 — Society config, demand calc, billing log
        ├── MapStudio.jsx           # Step 2 — Interactive satellite map + CAPEX calc
        └── ROIDashboard.jsx        # Step 3 — 10-year ROI chart + KPI cards
```

### State Management

State flows top-down via a single `WaterWalletContext` provider:

```
VirtualMeter  →  societyName, flats, occupants, totalSpend, billingMonths, annualDemand
MapStudio     →  estimatedCapex, annualYield, monthlyRainfall
ROIDashboard  ←  Reads all of the above to run the financial model and update self-sufficiency badge
```

No external state library (Redux, Zustand) is used — the problem scope is well-suited for React's built-in Context + `useMemo` hooks.

---

## 🔬 Technical Methodology

### Water Demand (IS:1172 + CPHEEO UFW Norms)

The demand formula is applied in strict sequence:

```
1. baseDemand      = Flats × Avg. Occupants × IS_LPCD (135 L/person/day)
2. afterUFW        = baseDemand × 1.15   [if UFW toggle is ON — CPHEEO standard]
3. adjustedDemand  = afterUFW × 1.10     [10% peak-demand buffer, IS 1172 §4]
```

The UFW step is optional and toggled per-society. All constants are defined in a single source of truth (`src/utils/waterConstants.js`) mirrored by `backend/models/constants.py`.

**Metered Data Override:** Users may bypass the IS:1172 model entirely by enabling the "Use Actual Metered Data" toggle, entering their real consumption, bill, and tanker spend on their society's billing cycle (Monthly/Quarterly/Half-Yearly/Yearly). The system annualises the figures automatically.

### Rainfall Harvesting Yield

```
Usable Catchment Area = Traced Gross Area × 0.80  (20% obstacle deduction)
Annual Yield (L)      = Usable Area (m²) × Annual Rainfall (mm) × 0.90 (runoff coefficient)
Parametric Capex (₹)  = Usable Area (m²) × ₹600/m²  (MMR DSR mid-point)
```

Annual rainfall is fetched live from the Open-Meteo Archive API for the **exact coordinates of the traced polygon centroid**, not a hardcoded location.

### 10-Year ROI Engine (Backend)

The backend ROI engine (`services/roi_engine.py`) caps the usable annual yield against tank capacity (monsoon constraint) and demand, then runs a year-by-year simulation:

```
effective_yield_kl = min(annual_yield, tank_capacity × 4, annual_demand) / 1000
annual_savings(year i) = effective_yield_kl × tariff × (1 + escalation_rate)^(i-1)
payback_year = interpolated year when cumulative_savings ≥ installation_cost
```

The frontend additionally overlays three "Cost of Doing Nothing" tanker inflation trajectories (6%, 8%, 12%) for scenario comparison.

---

## 🛠️ Tech Stack

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 8 |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v4 |
| Maps | React-Leaflet v5 + ESRI World Imagery tiles |
| Geospatial | Turf.js v7 (polygon area calculation) |
| Charts | Recharts v3 (ComposedChart, Area, Line, ReferenceLine) |
| HTTP Client | Axios |
| Icons | Lucide React |

### Backend

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI ≥ 0.115 |
| Server | Uvicorn (ASGI) |
| Validation | Pydantic v2 |
| HTTP Client | httpx (async, for Open-Meteo) |
| PDF Generation | WeasyPrint ≥ 61.2 |
| Templating | Jinja2 ≥ 3.1 |
| Weather API | Open-Meteo Archive API (free, no key required) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18 / npm ≥ 9
- Python ≥ 3.11

### Frontend

```bash
# Clone the repository
git clone <repo-url>
cd capstone

# Install JS dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

> The frontend reads `VITE_API_URL` from `.env` (defaults to `http://localhost:8000` if not set).

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📸 Application Walkthrough

### Step 1 — Virtual Meter

Enter your society's name, number of flats, and average occupants. The tool instantly computes your IS:1172 baseline daily water demand (Flats × Occupants × 135 LPCD). Toggle the **UFW Distribution Losses** switch to add the standard 15% unaccounted-for-water factor for real-world accuracy.

If your society has actual metered bills, enable **"Use Actual Metered Data"** to enter real consumption and spend figures on your billing cycle — overriding the theoretical model entirely.

Below the demand calculator, log month-by-month historical bills in the **Billing Log** — enter municipal bill, number of private tankers purchased, per-tanker cost, and tanker capacity in litres. The table auto-highlights months with ≥10 tankers as high-stress months and computes summary totals.

### Step 2 — Map Studio

The app opens a high-resolution satellite view. Click directly on your building's rooftop to place polygon vertices (a crosshair cursor aids precision). Once 3+ points are plotted, Turf.js calculates the catchment area in real-time. The sidebar shows live annual rainfall (fetched from Open-Meteo for the polygon's exact coordinates) alongside a monthly rainfall distribution chart and a Monsoon Dependency Score. It derives the harvestable yield and parametric CAPEX — all updating with every click.

### Step 3 — ROI Dashboard

The dashboard reads all data from the previous two steps to calculate your rooftop self-sufficiency and run a 10-year compounding simulation via the FastAPI backend. Three KPI cards show the cumulative "water bleed," the RWH project budget, and the projected break-even year range. You can adjust the CAPEX sensitivity slider to see real-time impact on the project budget. The Recharts graph plots three "Cost of Doing Nothing" trajectories (6%, 8%, 12% inflation) against the RWH curve. Finally, click **Download PDF Report** to generate a professional server-side report via WeasyPrint.

---

## 🌐 External APIs & Data Sources

| Source | Usage | Notes |
|--------|-------|-------|
| **Open-Meteo Archive API** | Historical daily precipitation data for any lat/long | Free, no API key required. Fetches the last complete calendar year |
| **ESRI World Imagery** | Satellite map tiles | Free for non-commercial use |
| **IS:1172** | Per-capita water demand standard (135 LPCD) | Indian Standards document |
| **CPHEEO Manual** | UFW loss factor (15%) | Central Public Health and Environmental Engineering Organisation norms |
| **MMR DSR** | Parametric RWH Capex rate (₹600/m²) | Mumbai Metropolitan Region District Schedule of Rates |

---

## 🏫 Academic Context

This project was developed as a **Capstone Project** at **VESIT (Vivekanand Education Society's Institute of Technology)**, Mumbai.

**Domain:** Environmental Engineering × Full-Stack Web Development  
**Problem Statement:** Quantifying urban water insecurity in residential housing societies and building a financial case for decentralized rainwater harvesting adoption in the Mumbai Metropolitan Region.

---

## 📝 License

This project is for academic and educational purposes.
