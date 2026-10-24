# WaterWallet: Complete Codebase Audit & System Remediation Plan

Comprehensive audit and systematic remediation plan for WaterWallet — an intelligent rainwater harvesting demand, catchment yield, and financial ROI simulation platform for residential housing societies in the Mumbai Metropolitan Region (MMR).

***

## User Review & Critical Decisions

> [!IMPORTANT]
> The audit identified 10 primary issues across data schemas, engine edge-cases, error guards, and test coverage. Following your confirmed preference, all findings are documented here first, and will be fixed systematically with expanded unit and integration tests across all application phases.

- **Confirmed Decision 1**: Document all findings first, then systematically apply fixes starting with critical/high severity.
- **Confirmed Decision 2**: Expand both unit and integration tests across all calculation engines and API routes (IS 1172 demand, catchment yield, tier 1 safety gate, RF/SHAP recommendation, Monte Carlo break-even, and daily tank sizer).

***

## 1. Overview & Core Concept

- **What It Does**: WaterWallet guides housing society committees through a 3-phase feasibility workflow:
  1. **Phase 1 (Virtual Meter)**: Establish society demographics, calculate IS 1172 potable/non-potable water demand baselines, and log historical tanker and municipal bills.
  2. **Phase 2 (Catchment & Hydrological Auditor)**: Trace rooftop polygons on high-resolution satellite imagery via Turf.js, compute gross and net usable catchment areas, fetch 15-year Open-Meteo rainfall baselines, and evaluate ML vs. physics yields.
  3. **Phase 3 (Comparator & Financial ROI Engine)**: Simulate 10-year cashflow trajectories under 3 inflation scenarios, test dual-tier safety rules (coastal distance, borewell depth, soil permeability), run 1,000-scenario Monte Carlo break-even distributions, optimize tank capacity at the economic knee point, and generate grounded AI advisories.
- **Target Audience**: Housing society managing committees, facility managers, and sustainability auditors.
- **Key Value**: Replaces guesswork and vendor bias with deterministic engineering formulas, physics-grounded models, and transparent financial break-even projections.

***

## 2. Comprehensive Audit Findings & Catalog of Issues

| Issue ID | Affected Module / Feature | Location | Severity | Problem Summary | Impact | Detection Mode |
|---|---|---|---|---|---|---|
| **WW-AUDIT-01** | Phase 1 / Database Seeds | `server/routes/societies.js` (lines 22-26) | **High** | Seed billing entries used `{ tanker_spend_inr, tanker_volume_kl, municipal_bill_inr }`, whereas `VirtualMeter.jsx` reads `entry.municipal_bill`, `entry.tankers`, `entry.cost_per_tanker`, `entry.tanker_capacity_l`. | Loading demo society 1 populates 0 tankers and empty bills. | Code Inspection & API Verification |
| **WW-AUDIT-02** | Phase 2 / Forecast Badge | `server/services/rainfallApi.js` (line 171) vs `MapStudio.jsx` (line 148) | **Medium** | `forecastMonthlyRainfall` returned `model_order` as a string, but `MapStudio.jsx` accesses `forecastData.model_order.order?.join(',')`. | Badge renders `SARIMA()()12 · 95% CI` with empty parameter parentheses. | Code Inspection |
| **WW-AUDIT-03** | Phase 1 / Demand Engine | `server/services/demandEngine.js` | **High** | Lack of numeric sanitization on `num_flats` and `occupants_per_flat` allows negative numbers or `NaN` to produce corrupted demand values. | Corrupted calculations propagate to all downstream phases. | Code Inspection |
| **WW-AUDIT-04** | Phase 3 / ROI Simulator | `server/services/roiEngine.js` (line 33) | **High** | Throws error when `water_tariff_per_kl <= 0`. Societies with 100% tanker reliance or unmetered municipal water fail simulation. | Complete crash of 10-year ROI simulation for tanker-only societies. | Execution / Edge Case Test |
| **WW-AUDIT-05** | Phase 3 / ROI Payback | `server/services/roiEngine.js` (line 65) | **Medium** | Potential division by zero in payback year interpolation if `net_savings` is zero or near-zero during the crossover year. | Payback displays `NaN` or `-Infinity`. | Code Inspection |
| **WW-AUDIT-06** | Phase 2 / Catchment Routing | `server/routes/catchment.js` & `rainfallApi.js` | **Medium** | Coordinates not sanitized for non-numeric/missing values before calling Open-Meteo archive API. | Causes preventable 400 error from Open-Meteo before fallback is triggered. | Code Inspection |
| **WW-AUDIT-07** | Phase 3 / Monte Carlo Engine | `server/services/monteCarlo.js` | **Medium** | If `monthly_demand_kl` is 0 or negative, `annualDemandLitres` is 0, causing division by zero in deficit calculation. | Monte Carlo simulation returns `NaN` break-even percentiles. | Code Inspection |
| **WW-AUDIT-08** | ML Engine / Safety Gate | `server/services/tier1Safety.js` | **Medium** | `coastal_km` and `borewell_depth` accept negative numbers or NaN without sanitization, leading to garbled safety reason strings. | UI displays unformatted `"Site is only NaN km from the coast"`. | Code Inspection |
| **WW-AUDIT-09** | Testing & Verification | `src/utils/__tests__` vs `server/services` | **High** | Zero test coverage for the 6 core server calculation engines (`demandEngine`, `yieldEngine`, `tier1Safety`, `roiEngine`, `monteCarlo`, `tankSizer`). | Regressions in business logic cannot be detected automatically. | Codebase Inspection |
| **WW-AUDIT-10** | Security & Reliability | `server.js` | **Low** | Absence of standard HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) and graceful JSON payload error handling. | Minor security hardening gap in fullstack Node process. | Code Inspection |

***

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Client (React SPA)                            │
│                                                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │    Phase 1 View     │  │    Phase 2 View     │  │  Phase 3 View   │ │
│  │  VirtualMeter.jsx   │  │    MapStudio.jsx    │  │ ROIDashboard.jsx│ │
│  └──────────┬──────────┘  └──────────┬──────────┘  └────────┬────────┘ │
│             │                        │                      │          │
│             └────────────────────────┼──────────────────────┘          │
│                                      ▼                                 │
│                       WaterWalletContext & API Layer                   │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │ HTTP /api/* (Same Origin, Port 3000)
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Express Fullstack Server                         │
│                                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ /api/auth    │ │/api/societies│ │/api/catchment│ │  /api/roi    │  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │
│         │                │                │                │          │
│  ┌──────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐  │
│  │ JWT / Bcrypt │ │ IS 1172      │ │ Open-Meteo & │ │ Deterministic│  │
│  │ In-Memory DB │ │ Demand Engine│ │ Yield Engine │ │ + Monte Carlo│  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────┬───────┘  │
│                                                            │          │
│                                       ┌────────────────────┴───────┐  │
│                                       │ /api/ml  & /api/advisory   │  │
│                                       │ Tier-1 Gate + Gemini / Rule│  │
│                                       └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

***

## 4. Phase-by-Phase Remediation Plan

### Step 1: Fix Core Server Calculation Engines & Edge Cases
- **`server/services/demandEngine.js`**: Enforce positive finite numbers for flats and occupants (`Math.max(1, Number(num_flats) || 1)`).
- **`server/services/yieldEngine.js`**: Guard against negative roof areas or rainfall.
- **`server/services/tier1Safety.js`**: Guard against negative or non-finite coastal distances and borewell depths.
- **`server/services/roiEngine.js`**: Allow `water_tariff_per_kl >= 0` and guard against division by zero in payback interpolation.
- **`server/services/monteCarlo.js`**: Enforce floor on `monthly_demand_kl` and handle edge cases where annual yield exceeds demand.
- **`server/services/rainfallApi.js`**: Format `model_order` as `{ order: [1, 0, 1], seasonal_order: [1, 1, 1, 12] }` and sanitize coordinates.

### Step 2: Fix API Routes & Database Seeds
- **`server/routes/societies.js`**: Update default seed data for Society 1 so billing entry fields exactly match `VirtualMeter.jsx` schema (`municipal_bill`, `tankers`, `cost_per_tanker`, `tanker_capacity_l`).
- **`server.js`**: Add standard security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`).

### Step 3: Comprehensive Test Suite Creation
Create automated test suites under `server/__tests__/`:
1. `demandEngine.test.js`: Validates IS 1172 residential standard (135 LPCD, 70 potable, 65 non-potable, 15% UFW losses, 10% buffer) and edge cases.
2. `yieldEngine.test.js`: Validates roof coefficients (concrete 0.90, metal 0.90, tiles 0.75, gravel 0.45), 80% usability factor, and zero rainfall.
3. `tier1Safety.test.js`: Tests all 4 CGWB/BMC safety gate conditions in strict priority order.
4. `roiEngine.test.js`: Validates zero tariff handling, tanker offset priority, AMC deduction, and payback year precision.
5. `monteCarlo.test.js`: Validates 1,000-scenario distribution, percentile accuracy (P10, P50, P90), and site-specific rainfall integration.
6. `tankSizer.test.js`: Validates daily water-balance simulation, overflow split (recharge vs lost), and economic knee point detection.

### Step 4: Verification & Linting
- Run all vitest tests (`npm test`).
- Run static analysis (`npm run lint`).
- Verify production build compilation (`npm run build`).
- Verify API connectivity across all endpoints via curl.
