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
| 🏗️ **Virtual Meter** | Configure society parameters (flats, occupants, amenities) to compute baseline daily water demand using IS:1172 (135 LPCD) — with live adjustment multipliers for amenities |
| 🧾 **Billing Log Table** | Editable month-by-month historical log of municipal bills + private tanker procurement. Auto-highlights months with abnormally high tanker reliance |
| 🗺️ **Map Studio** | Click-to-trace polygon tool on a satellite map (Leaflet + ESRI World Imagery) to measure rooftop catchment area in real-time using Turf.js geometry |
| 🌧️ **Live Weather** | Fetches 10-year daily precipitation data from Open-Meteo archive API (2015–2024) for Thane, MH to compute a hydrologically accurate annual rainfall average |
| 📐 **RWH Capex Estimator** | Calculates parametric CAPEX at ₹600/m² (MMR DSR rate) applying a 0.90 runoff coefficient and 20% obstacle deduction — methodology sourced from peer-reviewed literature |
| 📈 **ROI Simulator** | 10-year compounding financial model: "Cost of Doing Nothing" (8% tanker inflation + 5% municipal tax escalation) vs. "Cost with RWH" (3% AMC). Plots break-even intersection dynamically |
| 🔁 **Live Context Propagation** | All three views are connected via React Context — changes in Step 1 instantly feed into the ROI model in Step 3 |

---

## 🏛️ Architecture

```
src/
├── App.jsx                    # Root — BrowserRouter, layout shell
├── main.jsx                   # React 19 entry point
├── index.css                  # Global styles + custom toggle switch CSS
│
├── context/
│   └── WaterWalletContext.jsx # Global state provider (React Context API)
│
├── components/
│   ├── Sidebar.jsx            # Navigation — 3-step wizard sidebar
│   └── Topbar.jsx             # Top header bar
│
└── views/
    ├── VirtualMeter.jsx       # Step 1 — Society config + billing log
    ├── MapStudio.jsx          # Step 2 — Interactive satellite map + Capex calc
    └── ROIDashboard.jsx       # Step 3 — 10-year ROI chart + KPI cards
```

### State Management

State flows top-down via a single `WaterWalletContext` provider:

```
VirtualMeter  →  societyName, flats, occupants, totalSpend, billingMonths
MapStudio     →  estimatedCapex
ROIDashboard  ←  Reads all of the above to run the financial model
```

No external state library (Redux, Zustand) is used — the problem scope is well-suited for React's built-in Context + `useMemo` hooks.

---

## 🔬 Technical Methodology

### Water Demand (IS:1172)
```
Base Daily Demand = Flats × Avg. Occupants × 135 LPCD
Adjusted Demand   = Base × (1 + ΣAmenity Multipliers)
```
Amenity multipliers: Garden (+12%), Car Wash (+8%), Pool (+20%)

### Rainfall Harvesting Yield (Karnal Research Paper)
```
Usable Catchment Area = Traced Gross Area × 0.80  (obstacle deduction)
Annual Yield (L)      = Usable Area (m²) × Annual Rainfall (mm) × 0.90 (runoff coefficient)
Parametric Capex (₹)  = Usable Area (m²) × ₹600/m²
```

### 10-Year ROI Engine
```
Annual "Do Nothing" Cost (Year i) = Tanker × 1.08^(i-1) + Municipal × 1.05^(i-1)
Annual "With RWH" Cost  (Year i) = Municipal × 1.05^(i-1) + Capex × 0.03  (AMC)
```
Break-even is detected when `cumulative(With RWH) < cumulative(Do Nothing)`.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 8 |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v4 |
| Maps | React-Leaflet v5 + ESRI World Imagery tiles |
| Geospatial | Turf.js v7 (polygon area calculation) |
| Charts | Recharts v3 (ComposedChart, Area, Line, ReferenceLine) |
| Weather API | Open-Meteo Archive API (free, no key required) |
| Icons | Lucide React |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd capstone

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📸 Application Walkthrough

### Step 1 — Virtual Meter
Enter your society's name, number of flats, and average occupants. The tool instantly computes your IS-standard baseline daily water demand. Check off water-heavy amenities (garden, pool, car wash) to apply demand multipliers. Then log month-by-month historical bills — municipal and private tankers — to establish your actual water spend.

### Step 2 — Map Studio
The app opens a high-resolution satellite view centered on Thane, MH. Click directly on your building's rooftop to place polygon vertices. Once 3+ points are plotted, Turf.js calculates the catchment area in real-time. The sidebar simultaneously shows live annual rainfall (fetched from Open-Meteo) and derives the harvestable yield and parametric CAPEX — all updating with every click.

### Step 3 — ROI Dashboard
The dashboard reads all data from the previous two steps and runs a 10-year compounding simulation. Three KPI cards show the cumulative "water bleed," the RWH project budget, and the projected break-even year. The Recharts graph plots both cost trajectories; the green break-even line appears dynamically at the intersection point.

---

## 🌐 External APIs & Data Sources

| Source | Usage | Notes |
|--------|-------|-------|
| **Open-Meteo Archive API** | 10-year daily precipitation data for Thane (19.2183°N, 72.9781°E) | Free, no API key required. Falls back to 2500 mm on error |
| **ESRI World Imagery** | Satellite map tiles | Free for non-commercial use |
| **IS:1172** | Per-capita water demand standard (135 LPCD) | Indian Standards document |
| **MMR DSR** | Parametric RWH Capex rate (₹600/m²) | Mumbai Metropolitan Region District Schedule of Rates |

---

## 🏫 Academic Context

This project was developed as a **Capstone Project** at **VESIT (Vivekanand Education Society's Institute of Technology)**, Mumbai.

**Domain:** Environmental Engineering × Full-Stack Web Development  
**Problem Statement:** Quantifying urban water insecurity in residential housing societies and building a financial case for decentralized rainwater harvesting adoption in the Mumbai Metropolitan Region.

---

## 📝 License

This project is for academic and educational purposes.
