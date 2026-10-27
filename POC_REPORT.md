# WaterWallet Proof-of-Concept Report

**Project:** WaterWallet — Rainwater Harvesting Intelligence Platform  
**Report type:** Proof-of-concept (POC) implementation and feasibility report  
**Prepared:** 10 October 2026  
**Repository:** `nidhish-shirur/capstone-waterwallet`  
**Academic context:** VESIT Capstone 2025–26

---

## 1. Executive Summary

WaterWallet is a web-based decision-support platform for residential housing
societies in the Mumbai Metropolitan Region (MMR). It helps a society
committee estimate current water demand and tanker expenditure, measure a
rooftop catchment area, estimate rainwater yield and project cost, receive a
site-specific rainwater harvesting (RWH) configuration recommendation, and
evaluate the investment through multi-year and probabilistic ROI calculations.

The POC demonstrates the central product hypothesis:

> A housing society can make a more informed RWH investment decision by
> combining its own demand and billing data with map-derived catchment area,
> location-specific rainfall, engineering constraints, explainable machine
> learning, and financial scenario analysis in one workflow.

The implementation is a functioning full-stack prototype rather than only a
static interface. The React/Vite frontend contains the three principal user
phases, and the FastAPI backend exposes calculation, rainfall, ML, ROI, tank
sizing, persistence, and advisory endpoints. The core calculations are
implemented in reusable backend services and are supported by a passing
backend unit-test set.

The POC is **technically viable and suitable for academic demonstration and
controlled pilot evaluation**. It is not yet a production SaaS release. The
most important remaining gaps are consistent API-wide authorization and full database-backed CRUD,
broader ML validation using real labelled sites, production-grade deployment
configuration, end-to-end test coverage, and a completed server-side PDF
reporting path.

### Overall POC verdict

| Dimension | Assessment | Evidence |
|---|---|---|
| User journey | Demonstrated | Virtual Meter → Map Studio → ROI Dashboard |
| Physics calculations | Demonstrated | Demand, runoff, usability, tank-balance and ROI services |
| External data integration | Demonstrated with dependency | Open-Meteo rainfall and forecast services |
| ML decision support | Demonstrated with limitations | Random Forest models, safety gate, SHAP response |
| Financial modelling | Demonstrated | Deterministic ROI and Monte Carlo endpoints |
| Persistence | Demonstrated | Society, billing and analysis writes use PostgreSQL; focused persistence tests pass |
| Security/authentication | Not production-ready | Login and society-level bearer-token checks are active, but calculation endpoints are not uniformly protected |
| Automated verification | Partial | Frontend and backend unit suites run locally; browser end-to-end flows are not covered |
| Production readiness | Not yet | Known operational, data, security and validation gaps remain |

---

## 2. Problem Statement and POC Objective

Housing societies may receive substantial monsoon rainfall while still
depending on municipal supply and private tankers during dry periods. Committee
members generally lack a simple way to answer:

1. How much water does the society actually need?
2. How much does tanker dependency cost over time?
3. How much rooftop water can be captured at this exact site?
4. Is storage, borewell recharge, or a hybrid configuration appropriate?
5. What is the likely payback period under dry, normal, and high-cost scenarios?
6. What assumptions and safety conditions affect the recommendation?

The POC objective is to validate an integrated workflow that answers these
questions without requiring hardware installation or an initial consultant
visit. The application is intended for feasibility screening and committee
decision support, not final civil or hydrogeological design approval.

---

## 3. Intended Users and Use Case

### Primary user

The primary user is a society secretary, treasurer, facility manager, or
management committee member who understands the society's bills and building
parameters but is not expected to be a hydrologist, data scientist, or
financial modeller.

### Demonstrated user scenario

1. Enter the society name, number of flats, occupants, roof surface and
   billing information.
2. Review the calculated daily and annual demand and tanker expenditure.
3. Draw the rooftop boundary on satellite imagery.
4. Obtain the geospatial catchment area and rainfall-based yield estimate.
5. Provide or review site parameters such as borewell status, depth, soil
   permeability and coastal distance.
6. Receive a configuration recommendation with either a Tier 1 safety reason
   or Tier 2 ML/SHAP explanation.
7. Compare RWH costs and savings across inflation scenarios.
8. Review tank sizing and Monte Carlo break-even information.
9. Use the browser print-report workflow to share the analysis with the
   committee.

---

## 4. Scope of the Current POC

### Included

- React 19 and Vite frontend.
- FastAPI backend with Pydantic v2 request/response validation.
- Three connected product phases:
  - Virtual Meter.
  - Map Studio.
  - ROI Dashboard.
- Canonical water-demand calculation using IS:1172 and an optional UFW factor.
- Billing and tanker-volume aggregation.
- Leaflet and Turf.js rooftop polygon tracing.
- Open-Meteo rainfall retrieval and monthly aggregation.
- Seasonal rainfall forecast endpoint using Auto-SARIMA.
- Physics-based yield and capex estimation.
- Random Forest yield and configuration models persisted with joblib.
- Tier 1 hydrogeological safety gate.
- Tier 2 configuration classification and SHAP explainability.
- Deterministic ROI simulation.
- 1,000-scenario-capable Monte Carlo ROI simulation.
- Daily tank water-balance simulation and candidate capacity comparison.
- SQLAlchemy models and Alembic migration foundation.
- Optional grounded AI advisory through Groq when configured.
- Browser-native print-to-PDF report flow.

### Explicitly outside the current POC

- Automatic hardware or IoT meter ingestion.
- Final construction drawings, bill of quantities, or structural certification.
- Guaranteed groundwater recharge outcomes.
- A production multi-tenant identity and authorization system.
- Full real-world calibration of the classifier with a statistically adequate
  number of labelled sites.
- A completed backend WeasyPrint PDF service.
- A live municipal or CGWB groundwater-data pipeline.

---

## 5. Solution Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│ React 19 + Vite frontend                                           │
│                                                                    │
│ VirtualMeter → MapStudio → ROIDashboard                            │
│ WaterWalletContext: society, demand, rainfall, site and ROI state   │
└───────────────────────────────┬────────────────────────────────────┘
                                │ Axios / JSON over HTTP
┌───────────────────────────────▼────────────────────────────────────┐
│ FastAPI backend                                                     │
│                                                                    │
│ Society/demand     Geospatial/rainfall     ROI/tank sizing          │
│ ML recommendation  ML yield               AI advisory              │
└──────────────┬─────────────────────┬───────────────────────────────┘
               │                     │
               ▼                     ▼
       PostgreSQL foundation     Open-Meteo API
       SQLAlchemy + Alembic      historical precipitation
               │
               ▼
       joblib ML artefacts
       classifier, yield model, label encoder, rainfall percentiles
```

### Frontend structure

| Area | Main files | Responsibility |
|---|---|---|
| Application shell | `src/App.jsx` | Routing and shared layout |
| Global state | `src/context/WaterWalletContext.jsx` | Cross-phase state propagation |
| Virtual Meter | `src/views/VirtualMeter.jsx` | Demand, billing and society inputs |
| Map Studio | `src/views/MapStudio.jsx` | Polygon, centroid, rainfall and yield |
| ROI Dashboard | `src/views/ROIDashboard.jsx` | ROI curves, recommendations and reports |
| API client | `src/api/waterwallet.js` | Axios client and endpoint wrappers |
| Constants | `src/utils/waterConstants.js` | Frontend engineering constants |

### Backend structure

| Area | Main files | Responsibility |
|---|---|---|
| Application | `backend/main.py` | FastAPI app, CORS and router registration |
| Schemas | `backend/models/schemas.py` | Pydantic validation and response contracts |
| Demand | `backend/services/demand_engine.py` | Canonical demand calculation |
| Yield | `backend/services/yield_engine.py` | Rainfall-to-yield conversion |
| Forecast | `backend/services/rainfall_forecast.py` | Auto-SARIMA forecast |
| ROI | `backend/services/roi_engine.py` | Multi-year financial simulation |
| Monte Carlo | `backend/services/monte_carlo.py` | Probabilistic break-even analysis |
| Tank sizing | `backend/services/tank_sizer.py` | Daily water-balance simulation |
| Safety | `backend/services/tier1_safety.py` | Non-overridable recharge safety checks |
| ML | `backend/services/ml_engine.py` | Model loading, inference and explanations |
| Persistence | `backend/models/db_models.py`, `backend/database.py` | SQLAlchemy model and session foundation |

---

## 6. Functional Demonstration

### 6.1 Phase 1 — Virtual Meter

The Virtual Meter establishes the society's baseline demand and current water
cost profile. It supports:

- Society name, pincode, flat count and occupants per flat.
- Roof surface type.
- Optional 15% Unaccounted-For Water (UFW) losses.
- Optional actual-metered-data override with annualisation.
- Monthly billing rows.
- Tanker count, tanker capacity and cost per tanker.
- Municipal bill aggregation.
- Context updates for downstream ROI calculations.

The canonical calculation is:

```text
base demand        = flats × occupants per flat × LPCD
after UFW          = base demand × 1.15       [when enabled]
adjusted demand    = after UFW × 1.10         [peak-demand buffer]
annual demand      = adjusted demand × 365
```

The default LPCD is 135, based on the project's IS:1172 assumption. The
frontend implementation in `src/utils/waterConstants.js` and backend
implementation in `backend/services/demand_engine.py` are intended to remain
synchronized.

### 6.2 Phase 2 — Map Studio

Map Studio lets the user click around a rooftop on ESRI World Imagery. Turf.js
then calculates:

- Gross polygon area.
- Polygon centroid.
- Usable area after the 20% obstacle deduction.
- Monthly and annual rainfall.
- Monthly and annual harvestable yield.
- Parametric capex using the configured rate.
- Monsoon dependency and rainfall-versus-demand visualisation.

The main physics relation is:

```text
usable area       = gross area × 0.80
harvested litres  = rainfall mm × usable area m² × runoff coefficient
capex             = usable area m² × capex rate per m²
```

Because 1 mm of rainfall over 1 m² equals 1 litre, the unit conversion is
direct. Concrete and metal default to a 0.90 runoff coefficient, while the
constants also support lower coefficients for gravel and tile surfaces.

### 6.3 ML recommendation

The recommendation endpoint uses a safety-first architecture:

1. Tier 1 checks hard hydrogeological constraints.
2. If a safety condition fails, the endpoint returns `Storage-Only` and a
   plain-language reason without invoking the classifier.
3. If Tier 1 passes, the Random Forest classifier returns a configuration,
   confidence, SHAP values and explanation metadata.

The current safety conditions include:

- Coastal distance at or below 2.5 km.
- No borewell infrastructure.
- Soil permeability below the supported recharge threshold.
- Borewell depth below 30 m.

This is an important POC design choice: model confidence cannot override a
physical safety constraint.

### 6.4 Phase 3 — ROI Dashboard

The ROI Dashboard compares a no-RWH expenditure path against a path that
includes capex, residual water expenditure and annual maintenance. It exposes:

- Conservative, current and high-risk tanker inflation scenarios.
- Break-even year.
- Cumulative cost curves.
- Capex sensitivity from ₹400–₹800/m².
- Self-sufficiency percentage.
- Monte Carlo break-even probability distribution.
- Tank sizing and reliability outputs.
- Configuration recommendation and AI advisory panels.
- Browser-native print-report output.

The Monte Carlo ROI path is demand-gated at eligible non-potable demand
(65 LPCD per occupant), while the total-demand baseline remains available for
society-wide water accounting. The current deterministic engine offsets tanker
water before municipal water and should be aligned with the same non-potable
planning basis before production use.
Annual maintenance is modelled at 3% of installation cost.

### 6.5 Tank sizing

The tank sizer is a particularly useful engineering POC component. It:

- Simulates each complete calendar year independently.
- Handles leap years using the actual number of daily observations.
- Distinguishes useful consumed water from recharge overflow and lost overflow.
- Includes a zero-capacity “do nothing” baseline.
- Selects or reports candidates against a reliability target.
- Refuses to fabricate daily rainfall when complete external data is not
  available.

This separation prevents recharge overflow from being incorrectly counted as
direct financial savings.

---

## 7. ML and Data Science POC

### Model artefacts

The repository contains:

- `backend/ml_models/waterwallet_config_classifier.pkl`
- `backend/ml_models/waterwallet_yield_model.pkl`
- `backend/ml_models/waterwallet_label_encoder.pkl`
- `backend/ml_models/model_metadata.json`
- `backend/ml_models/thane_rain_percentiles.csv`

The metadata identifies a calibrated Random Forest classifier trained on 600
samples and a Random Forest yield regressor trained on 2010–2021 data with
2022–2024 test years.

### Reported model results

The project documentation reports:

| Model/task | Reported result | Interpretation |
|---|---:|---|
| Configuration classifier | Accuracy 1.000; balanced accuracy 1.000; macro F1 1.000 | Excellent fit to the synthetic rule-generated dataset |
| Yield regressor | MAE 4.8973 kL; R² 0.9865 in model metadata | Strong held-out performance within the available data regime |
| Auto-SARIMA rainfall forecast | MAE 63.76 mm in the notebook's 2022–2025 holdout | Notebook benchmark only; not a live-API validation |
| Configuration case study | 97.1% confidence for Hybrid, matching expert assessment | Encouraging single-site validation |

### Interpretation and caution

The classifier's perfect metrics should not be interpreted as proof of
generalisation. The training labels are generated from engineering rules, so
the model primarily demonstrates that the system can learn and explain a
defined decision surface. The project documentation correctly identifies
collection of real labelled MMR sites as the highest-priority validation task.

The rainfall model is also geographically scoped. A model fitted for Thane
should not automatically be treated as a calibrated model for every MMR
location without local validation or refitting.

---

## 8. API Surface

The active FastAPI application registers the following route families:

| Endpoint | Purpose | POC status |
|---|---|---|
| `GET /` | Health check | Active |
| `POST /api/societies/baseline` | Demand calculation | Active |
| `POST /api/societies/` | Create society | Active; persists to PostgreSQL |
| `GET /api/societies/` | List societies for authenticated user | Active; reads PostgreSQL |
| `GET /api/societies/{id}` | Read society and billing history | Active; reads PostgreSQL |
| `PUT /api/societies/{id}` | Update society | Active; persists to PostgreSQL |
| `POST /api/societies/{id}/billing` | Replace billing history | Active; transactional PostgreSQL write |
| `GET /api/societies/database` | Read persisted societies | Compatibility alias |
| `GET /api/societies/{id}/database` | Read persisted society | Compatibility alias |
| `GET /api/societies/{id}/billing` | Read persisted billing | Active; reads PostgreSQL |
| `POST /api/catchment/calculate` | Rainfall and yield | Active |
| `POST /api/catchment/forecast` | Rainfall forecast and yield | Active |
| `POST /api/ml/yield` | ML yield prediction | Active with model service |
| `POST /api/ml/recommend` | Safety gate + classifier + SHAP | Active |
| `POST /api/roi/simulate` | Deterministic ROI | Active |
| `POST /api/roi/monte-carlo` | Probabilistic ROI | Active |
| `POST /api/roi/tank-sizer` | Daily tank simulation | Active |
| `POST /api/advisory/water` | Grounded natural-language advisory | Optional; requires Groq key |

Authentication routes are registered in `backend/main.py`, and the frontend
has login, guest access, and protected application routes. Society CRUD/read
routes apply bearer-token ownership checks. Protection is incomplete across
the API: calculation, rainfall, ML, ROI, tank-sizing, and advisory routes do
not all require authentication. The POC must not be exposed publicly until
those endpoints and deployment boundaries receive a consistent authorization
review.

---

## 9. Persistence and Data Management

The repository includes a credible persistence foundation:

- SQLAlchemy ORM.
- PostgreSQL driver.
- Alembic configuration and initial migration.
- User, society, billing-entry and society-analysis models.
- JSONB storage for computed analysis data.

Society, billing and analysis records now use the PostgreSQL models as their
source of truth. Society and billing writes are committed to the database;
billing replacement is transactional, and society queries are scoped to the
authenticated owner. The older `/database` society routes remain as
compatibility aliases:

| Capability | Current state |
|---|---|
| Persisted schema | Implemented |
| Migration foundation | Implemented |
| Standard create/update/list/read flow | Database-backed; society records are scoped to their owner |
| Billing writes and reads | Database-backed; replacement is committed as one transaction |
| Analysis writes and reads | Database-backed and scoped to society ownership |
| Automated persistence coverage | Focused tests verify writes survive new database sessions |
| Delete endpoint | Not currently exposed |

Database connection or write failures are returned as service errors rather
than falling back to process-local data. The API therefore requires the
configured database to be available for society, billing and analysis
operations.

### Monte Carlo caveats

The Monte Carlo response exposes both the diagnostic `scenarios_used` value and
the stable boolean `is_site_specific`. If the percentile CSV is unavailable,
the backend uses a hard-coded Thane-like monthly rainfall distribution, returns
`is_site_specific: false`, and the frontend displays a warning. Results from
this fallback are not site-specific and must not be presented as calibrated
estimates.

On the normal path, each month's rainfall is sampled independently between its
P10 and P90 values. This breaks within-year rainfall correlation and is a
correctness limitation for a rainfall-volatility model. The pilot-hardening
plan should replace this with bootstrap sampling of complete historical years,
consistent with the historical-year approach already used by the Tank Sizer.

### Demand rounding caveat

`demand_engine.py` currently calculates `total_occupants` with
`int(num_flats * occupants_per_flat)`. Fractional occupants are therefore
truncated rather than rounded to the nearest person or retained as a
fraction. This is a conservative modelling policy for the POC and should be
made explicit in the UI or replaced with a documented rounding rule before
production use.

---

## 10. Validation and Verification Evidence

Validation was performed against the repository state on 10 October 2026.

### Frontend build

Command:

```text
npm run build
```

Result: **Passed.** Vite transformed 2,662 modules and produced a production
bundle. The build emitted a chunk-size warning because the minified JavaScript
bundle is approximately 905 kB.

### Frontend lint

Commands:

```text
npm run lint
npx eslint src
```

Result: **Not clean.** The full `npm run lint` command scans a vendored
dependency bundle at
`backend/.venv/Lib/site-packages/shap/plots/resources/bundle.js`; that
third-party file produces unrelated lint noise, so vendor exclusion is
necessary. Source-level findings also exist independently: running
`npx eslint src` reports 8 errors and 3 warnings:

| File | Lines | Findings |
|---|---:|---|
| `src/context/AuthContext.jsx` | 16, 27, 59 | Unused caught error; synchronous state update in an effect; Fast Refresh component-export warning |
| `src/views/MapStudio.jsx` | 211–214 | Synchronous state updates in an effect |
| `src/views/ROIDashboard.jsx` | 30, 589, 710, 787, 792, 859 | Unused variable; three hook-dependency warnings; unused caught error; unused computed value |
| `src/views/VirtualMeter.jsx` | 124 | Unused computed value |

The next validation improvement must therefore do both: exclude virtual
environments and other vendored/generated artefacts, and resolve the source
findings separately.

### Backend unit tests

Command used after correcting the import context:

```text
Push-Location backend
$env:PYTHONPATH=(Get-Location).Path
python -m unittest discover -s tests -v
```

Result: **Passed — 4 tests.**

Covered behaviours:

1. Actual year length, including leap years.
2. Water-balance reconciliation.
3. Zero-capacity do-nothing baseline.
4. Monotonicity of useful water, reliability, overflow and unmet demand as
   capacity increases.

The initial repository-root test command failed because the test imports
`services` as a backend-local package. That was an invocation-context issue;
the corrected backend-context run passed.

### Validation coverage still needed

- Backend route tests using FastAPI's test client.
- Schema validation tests for malformed and boundary inputs.
- ML model-loading and fallback tests.
- Open-Meteo timeout and unavailable-data tests.
- Frontend component tests.
- Browser end-to-end test for the full three-phase flow.
- Persistence integration tests against PostgreSQL.
- Complete authentication and authorization tests across all API routes.

---

## 11. Strengths of the POC

1. **Clear user workflow:** The three-phase flow maps well to the user's
   decision process.
2. **Physics before prediction:** Demand, yield, demand-gating and safety rules
   are not delegated blindly to a black-box model.
3. **Safety-first ML:** The Tier 1 gate can override the classifier when
   recharge is physically unsafe or infeasible.
4. **Explainability:** SHAP values and plain-language responses make model
   output more suitable for committee review.
5. **Location specificity:** The rooftop polygon and centroid are used to
   retrieve rainfall for the selected site.
6. **Financial realism:** Inflation scenarios, AMC, demand gating and Monte
   Carlo analysis are more useful than a single deterministic payback figure.
7. **Accounting discipline:** Tank sizing separates consumed water,
   environmentally useful recharge overflow and lost overflow.
8. **Good engineering separation:** API routers, schemas, services, constants,
   models and frontend views have distinct responsibilities.
9. **Explicit limitations:** Project documentation discloses synthetic data,
   limited real validation and geographic model scope instead of overstating
   the results.

---

## 12. Limitations, Risks and Mitigations

| Risk | Impact | Current mitigation | Required next step |
|---|---|---|---|
| Synthetic classifier labels | High risk of overstated generalisation | Engineering rules and disclosure | Collect 30–50+ real labelled sites and expert assessments |
| Single-site real validation | Insufficient statistical evidence | Thane case-study comparison | Run multi-site, stratified validation |
| Thane-specific rainfall calibration | Poor transfer to other locations | Open-Meteo location retrieval | Fit or validate models per MMR zone |
| External API outage | Map and rainfall workflow can be unavailable | Explicit errors and some UI fallback state | Add controlled caching, retries and observable service status |
| Partial API authorization | Calculation and analysis routes can be called without a bearer token | Society routes enforce owner checks | Apply consistent API authentication and authorization |
| Database availability | Society, billing and analysis operations are unavailable if PostgreSQL cannot be reached | Explicit service errors; database-backed persistence tests | Add deployment monitoring, backups and restore drills |
| Monte Carlo fallback | Generic fallback can look like calibrated output | `scenarios_used` response field and UI warning | Fail clearly or require a site-specific dataset for pilot decisions |
| Independent-month Monte Carlo sampling | Breaks within-year rainfall correlation | Documented assumption | Bootstrap complete historical years |
| Fractional occupant truncation | Demand may be understated for fractional averages | Current `int()` behavior is documented | Adopt and test an explicit rounding policy |
| Advisory API key/provider dependency | Advisory unavailable or costly | Returns explicit 503/502 errors | Add provider abstraction, quotas, logging and safe fallback |
| Backend PDF path incomplete | Server-generated report unavailable | Browser print-to-PDF path | Install/contain PDF dependencies and add report tests |
| No construction validation | Users could treat estimates as design approval | Documentation states pre-consultation boundary | Add prominent UI disclaimers and engineer review checklist |
| Frontend bundle size | Slower first load | Vite production build succeeds | Code-split views and lazy-load map/chart dependencies |
| Lint scans virtual environment and source has findings | Noisy CI plus 8 errors and 3 warnings in source | Findings recorded by file and line | Exclude vendor paths and fix source lint errors |
| Input assumptions | ROI can vary materially with tariffs, demand and capex | Inputs and scenario controls exposed | Add assumptions panel, provenance and editable source dates |

---

## 13. Production Readiness Assessment

The POC should be promoted in stages rather than deployed directly as a
public-facing financial or engineering authority.

### Ready for

- Academic demonstration.
- Controlled usability testing with selected societies.
- Internal stakeholder review.
- Comparative evaluation of RWH scenarios.
- Further model/data collection.

### Not ready for

- Public multi-tenant SaaS.
- Unauthenticated production deployment.
- Automated construction procurement.
- Guaranteed groundwater recharge advice.
- High-stakes financial commitments without human review.

### Minimum release gates

1. Apply and test authentication and user-level authorization across every API route.
2. Convert all active CRUD and analysis writes to PostgreSQL transactions.
3. Add API, schema, integration and browser end-to-end tests.
4. Establish a real-data ML validation protocol and publish confidence limits.
5. Add monitoring, structured logs, rate limits and external API timeouts.
6. Exclude vendor paths and require a clean source lint result.
7. Complete and test the chosen PDF report path.
8. Add a visible “feasibility estimate, not construction design” warning.
9. Review all engineering constants and references with a qualified domain
   expert before pilot deployment.

---

## 14. Recommended Next-Phase Plan

### Phase A — Stabilise the prototype

- Add a test configuration that excludes `backend/.venv`.
- Add FastAPI route tests for health, demand, ROI, ML safety and validation
  failures.
- Add a frontend smoke test covering navigation and state propagation.
- Resolve the 8 source-level lint errors and 3 warnings separately from vendor
  exclusion.
- Reduce initial bundle size through route-level lazy loading.
- Treat the approximately 905 kB production bundle as a known optimisation
  issue; route-level code splitting is the intended fix.

### Phase B — Complete application integrity

- Apply consistent authentication in backend routes; frontend login and protected navigation are already active.
- Replace independent-month Monte Carlo sampling with complete historical-year
  bootstrap sampling.
- Add database migration and rollback checks.
- Store model version, rainfall source, assumptions and calculation timestamp
  with every analysis snapshot.

### Phase C — Strengthen scientific validity

- Collect real site assessments from a representative MMR sample.
- Record expert labels and the evidence supporting each label.
- Use a geographic holdout rather than random-only splitting where possible.
- Calibrate confidence and report uncertainty.
- Validate rainfall models across multiple coordinates and time periods.
- Integrate recharge savings into the Monte Carlo engine only after the
  recharge accounting and safety assumptions are independently reviewed.

### Phase D — Pilot deployment

- Deploy a protected staging environment.
- Add secrets management rather than repository-local secrets.
- Add API observability and external-service health metrics.
- Conduct usability sessions with society committee members.
- Compare estimates against measured rainfall, bills and post-installation
  outcomes.

---

## 15. Final Conclusion

WaterWallet successfully demonstrates the feasibility of a physics-informed,
explainable RWH decision-support product. Its strongest contribution is not
one isolated formula or model; it is the integration of demand measurement,
site mapping, rainfall data, safety logic, ML explanation and financial
uncertainty into a workflow that a non-specialist committee can understand.

The current evidence supports the claim that the project is a credible POC.
The evidence does **not** yet support claims of production security, universal
geographic accuracy, or broad ML generalisation. Those claims require the
database/authentication completion, stronger automated validation and real
multi-site field data identified above.

**POC decision:** Proceed to controlled pilot hardening and data-collection
phase, while keeping the product positioned as a feasibility and decision
support tool rather than a substitute for licensed engineering design.

---

## 16. Source Files Reviewed

- [README.md](./README.md)
- [Capstone.md](./Capstone.md)
- [TECHNICAL_REFERENCE.md](./TECHNICAL_REFERENCE.md)
- [WaterWallet_Complete_Guide.md](./WaterWallet_Complete_Guide.md)
- [package.json](./package.json)
- [backend/main.py](./backend/main.py)
- [backend/models/schemas.py](./backend/models/schemas.py)
- [backend/models/db_models.py](./backend/models/db_models.py)
- [backend/routers/societies.py](./backend/routers/societies.py)
- [backend/routers/geospatial.py](./backend/routers/geospatial.py)
- [backend/routers/ml_recommend.py](./backend/routers/ml_recommend.py)
- [backend/routers/ml_yield.py](./backend/routers/ml_yield.py)
- [backend/routers/roi.py](./backend/routers/roi.py)
- [backend/routers/advisory.py](./backend/routers/advisory.py)
- [backend/services/demand_engine.py](./backend/services/demand_engine.py)
- [backend/services/yield_engine.py](./backend/services/yield_engine.py)
- [backend/services/roi_engine.py](./backend/services/roi_engine.py)
- [backend/services/tier1_safety.py](./backend/services/tier1_safety.py)
- [backend/services/tank_sizer.py](./backend/services/tank_sizer.py)
- [backend/services/monte_carlo.py](./backend/services/monte_carlo.py)
- [backend/ml_models/model_metadata.json](./backend/ml_models/model_metadata.json)
- [backend/tests/test_tank_sizer.py](./backend/tests/test_tank_sizer.py)
- [src/App.jsx](./src/App.jsx)
- [src/context/WaterWalletContext.jsx](./src/context/WaterWalletContext.jsx)
- [src/views/VirtualMeter.jsx](./src/views/VirtualMeter.jsx)
- [src/views/MapStudio.jsx](./src/views/MapStudio.jsx)
- [src/views/ROIDashboard.jsx](./src/views/ROIDashboard.jsx)
