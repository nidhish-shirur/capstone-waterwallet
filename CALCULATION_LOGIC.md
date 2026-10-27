# WaterWallet Calculation Logic

This document describes the calculation paths used by the three application
phases: **Virtual Meter**, **Map Studio**, and **ROI Dashboard**. It follows the
current frontend and Python backend implementation. It is intended to explain
how displayed estimates are produced, not to certify a site design.

> **Important:** These are planning estimates. Rainfall history is not a
> guarantee of future rainfall, and roof yield is not the same as water
> delivered to a point of use. Tank sizing, water quality, structural loading,
> recharge feasibility, and regulatory requirements need site-specific
> engineering review.

## Contents

1. [System flow and units](#1-system-flow-and-units)
2. [Phase 1 — Virtual Meter](#2-phase-1--virtual-meter)
3. [Phase 2 — Map Studio](#3-phase-2--map-studio)
4. [Phase 3 — ROI Dashboard](#4-phase-3--roi-dashboard)
5. [Shared assumptions and interpretation](#5-shared-assumptions-and-interpretation)
6. [Source files](#6-source-files)

## 1. System flow and units

The phases share values through `WaterWalletContext`:

```text
Phase 1: society + demand + water bills
    ├── annual total demand (L/year)
    ├── eligible non-potable demand (L/year)
    ├── tanker spend, volume, municipal spend
    └── society profile and billing rows
              ↓
Phase 2: roof polygon + location + rainfall + roof surface
    ├── gross traced roof area (m²)
    ├── historical monthly rainfall (mm)
    ├── annual harvestable yield (L/year)
    ├── estimated installation capex (₹)
    └── optional ML yield and rainfall forecast
              ↓
Phase 3: selected yield + demand + costs + tank
    ├── deterministic ROI projections
    ├── stochastic ROI/payback distribution
    └── daily historical tank sizing and reliability
```

### Units used

| Quantity | Unit |
|---|---|
| Water demand, tank storage, yield | litres (L) |
| Rainfall | millimetres (mm) |
| Roof area | square metres (m²) |
| Water tariff | rupees per kilolitre (₹/kL) |
| `1 kL` | `1,000 L` |
| `1 mm × 1 m²` | `1 L` of incident rain, before losses |
| ROI chart spend and capex | ₹ lakhs (`₹ / 100,000`) |

## 2. Phase 1 — Virtual Meter

**Purpose:** Record society inputs, estimate water demand, and aggregate
municipal and tanker billing rows.

### 2.1 Occupants and baseline demand

The browser and backend use the canonical calculation in
[`waterConstants.js`](./src/utils/waterConstants.js) and
[`demand_engine.py`](./backend/services/demand_engine.py).

Let:

- `F` = number of flats
- `O` = average occupants per flat
- `LPCD` = litres per capita per day, default `135`
- `UFW` = distribution loss factor, `0.15` when enabled and `0` when disabled
- `B` = demand buffer, always `0.10`

The calculation is:

```text
occupants = floor(F × O)
base daily demand (L/day) = occupants × LPCD
after distribution losses = base × (1 + UFW)
buffered daily demand (L/day) = round_half_up(after distribution losses × 1.10)
annual demand (L/year) = buffered daily demand × 365
```

Rounding of the buffered daily quantity is half-up to a whole litre. The
occupant count is truncated down to a whole person before demand is calculated.
The UI defaults to 135 LPCD and has a toggle for the 15% Unaccounted-For Water
(UFW) allowance.

**Example: 50 flats, 4 occupants per flat, UFW enabled**

```text
occupants = floor(50 × 4) = 200
base = 200 × 135 = 27,000 L/day
after UFW = 27,000 × 1.15 = 31,050 L/day
buffered = round_half_up(31,050 × 1.10) = 34,155 L/day
annual demand = 34,155 × 365 = 12,466,575 L/year
```

### 2.2 Potable and non-potable split

The canonical baseline allocates daily demand in the ratio `70:65`, matching
the configured potable and non-potable LPCD values (`70 + 65 = 135`):

```text
potable demand = round_half_up(buffered demand × 70 / 135)
non-potable demand = buffered demand − potable demand
annual potable/non-potable demand = daily component × 365
```

The ROI workflow treats the non-potable part as the eligible RWH demand cap.
When actual metered consumption is enabled in the Virtual Meter, the UI instead
annualizes the entered consumption and splits it using the same `70/135` and
`65/135` proportions.

For the 50-flat example above:

```text
potable = round_half_up(34,155 × 70 / 135) = 17,710 L/day
non-potable = 34,155 − 17,710
            = round_half_up(34,155 × 65 / 135)
            = 16,445 L/day
eligible annual non-potable demand = 16,445 × 365
                                    = 6,002,425 L/year
```

This `16,445 L/day` value is the seeded baseline consumed by the ROI
Dashboard and daily tank sizer until a user supplies actual metered data.

### 2.3 Seasonal monthly demand distribution

Map Studio's monthly demand line uses the frontend context's 12 seasonal
weights, in January-to-December order:

```text
[0.90, 0.90, 1.10, 1.20, 1.20, 0.90, 0.80, 0.80, 0.90, 1.00, 0.95, 0.95]
sum of weights = 11.60
monthly demand[i] = annual total demand × weight[i] / 11.60
```

The weights are normalized so that the 12 monthly values sum to annual total
demand. The rainfall chart rounds the demand line to whole kilolitres for
display. This weighted chart is a visualization; Phase 3's Monte Carlo model
uses a constant one-twelfth of eligible non-potable demand in each month, and
the daily tank sizer uses a constant daily eligible demand.

### 2.4 Metered input annualization

When **Use actual metered data** is selected, one entered period is multiplied
by a frequency factor:

| Selected frequency | Annualization factor |
|---|---:|
| Monthly | 12 |
| Quarterly | 4 |
| Half-yearly | 2 |
| Yearly | 1 |

For period measurements `C` litres consumed, `M` rupees municipal bill, and `V`
litres of tanker water:

```text
annual metered consumption = C × factor
annual municipal bill = M × factor
annual tanker volume = V × factor
annual potable demand = round(annual consumption × 70 / 135)
annual non-potable demand = round(annual consumption × 65 / 135)
```

This path uses the supplied meter values instead of theoretical
`flats × occupants × LPCD` demand. Tanker spend is annualized from the current
billing-row aggregate divided by the row count and multiplied by 12.

### 2.5 Billing-row aggregation

Each editable row contains month, year, municipal bill, tanker count, tanker
price, and tanker capacity.

```text
row tanker spend (₹) = tanker count × cost per tanker
row tanker volume (L) = tanker count × tanker capacity (L)
total tanker spend = sum(row tanker spend)
total municipal spend = sum(row municipal bill)
total tanker volume = sum(row tanker volume)
average bill per row = round((total tanker spend + total municipal spend) / row count)
```

The average displayed here is per entered row, not necessarily per calendar
month; missing months are not imputed. Phase 3 annualizes the aggregate using
the number of rows:

```text
annualized value = (row total / row count) × 12
```

The UI initially contains sample billing rows. They are demonstration values:
replace them with actual records before interpreting ROI results.

The first-load context also has demonstration profile defaults (50 flats,
4 occupants per flat), a 1,200 m² gross roof, 1,500,000 L/year yield, and a
10,000 L tank. The seeded capex is `1,200 × 0.80 × ₹450 = ₹432,000`, while
Map Studio's live default capex rate is ₹600/m². These initial context values
are placeholders until a polygon and current inputs replace them; they are not
measurements of the selected society.

### 2.6 Persistence

On save, the society profile and billing rows are written through the
authenticated society API to PostgreSQL. Billing save replaces that society's
current billing-row set transactionally. Persistence affects storage, not the
formulas above.

## 3. Phase 2 — Map Studio

**Purpose:** Trace a roof area, estimate rainfall-derived yield and capex, and
optionally view a rainfall forecast or ML yield estimate.

### 3.1 Roof polygon and area

Map clicks create vertices stored as latitude/longitude pairs. The frontend
converts them to GeoJSON order `[longitude, latitude]`, closes the polygon, then
uses Turf.js geodesic area on WGS84:

```text
gross roof area (m²) = Turf area(closed GeoJSON polygon)
```

The polygon's centroid is used for rainfall coordinates. A non-finite or
non-positive polygon area is rejected by the UI calculation. Coordinates and
the polygon are also retained for downstream analysis.

### 3.2 Usable area, runoff, yield and capex

The app applies an 80% usable-roof factor for obstacles and a surface-specific
runoff coefficient:

| Roof surface | Runoff coefficient |
|---|---:|
| Concrete | 0.90 |
| Metal | 0.90 |
| Gravel | 0.45 |
| Tiles | 0.75 |

```text
usable roof area (m²) = gross traced area × 0.80
monthly harvestable yield (L) = usable area × monthly rainfall (mm) × runoff coefficient
annual yield (L/year) = sum(monthly harvestable yield)
estimated capex (₹) = usable area × ₹600/m²
```

The factor `mm × m² = litres` follows from the depth-volume unit identity.
The yield calculation is performed by the backend `calculate_yield`; it
applies the 0.80 usability factor internally. The browser's live planning
estimate also uses `gross area × 0.80` before applying rainfall and runoff.
Thus usability is applied once in each path, not twice.

**Illustrative example:** for 1,000 m² gross concrete roof and 2,000 mm annual
rainfall:

```text
usable area = 1,000 × 0.80 = 800 m²
annual yield = 800 × 2,000 × 0.90 = 1,440,000 L/year
capex estimate = 800 × ₹600 = ₹480,000
```

The estimate is theoretical catchment yield before storage overflow, first
flush, conveyance losses beyond the modeled coefficients, treatment, and
operational constraints. The `₹600/m²` is a configurable planning rate, not a
contractor quotation.

### 3.3 Historical rainfall baseline

The backend requests daily `precipitation_sum` from the Open-Meteo Archive for
the most recent 15 complete calendar years at the traced centroid. For each
calendar year, daily values are summed into 12 month totals; each month's
totals are then averaged across all 15 years:

```text
monthly normal[m] = sum(yearly monthly total[y, m]) / 15
annual rainfall normal = sum(monthly normal[Jan..Dec])
```

Each month is averaged separately, retaining the seasonal pattern while
reducing dependence on any single wet or dry year. The catchment endpoint
returns both monthly and annual yield and includes `source` and `fallback_used`
metadata.

If the archive request fails, the backend explicitly logs the error and uses a
regional MMR climatological monthly normal. The response marks this as a
fallback; the UI flags it instead of presenting the fallback as site-specific
archive data. If the whole backend request fails, the map UI also has a local
regional fallback: its annual total is configured as 2,447 mm while its
configured monthly array sums to 2,347 mm. Consequently the offline fallback's
annual yield and monthly rainfall chart do not reconcile exactly. This is a
fallback-data inconsistency, not a conversion formula.

### 3.4 Rainfall forecast (optional view)

The forecast endpoint preserves the chronological 180-month history through
the most recently completed month and requires at least 36 monthly
observations. It fits seasonal Auto-SARIMA with period `m = 12`, selecting
orders by AIC, then forecasts 1–24 months (the UI requests 12). Negative
rainfall predictions and confidence bounds are clipped to zero. The service
returns model orders, training-month count, confidence intervals, and the
first forecast month.

Forecast yield uses the same physical yield formula as historical yield. The
forecast is a scenario and does **not** replace the long-run historical normal
used for the baseline yield estimate. If forecasting is unavailable, the UI
retains the historical result.

If the historical monthly time-series request fails, the forecast service
builds a deterministic synthetic regional history by multiplying each
regional monthly normal by a seeded random factor per year. The forecast
response exposes `history_source` and `fallback_used`; this is not observed
site history.

The separate **Next 12-Month Water Outlook** propagates each month’s lower
confidence bound, forecast value, and upper confidence bound through three
independent sequential water-balance scenarios. Forecast rainfall is converted
to yield as `rainfall × gross roof area × 0.80 usable-area factor × runoff
coefficient × (1 − 0.05 first-flush fraction)`. Seasonal non-potable demand
uses the Phase 1 weights normalized to 12 months. Each scenario starts at the
user-selected storage level (empty by default); served water is capped at
monthly demand, ending storage is capped at tank capacity, and excess becomes
overflow. Low/expected/high are rainfall scenarios and their bounds are not a
joint 95% annual probability interval.

The outlook is separate from baseline annual yield, ROI, and tank sizing. If
`fallback_used` is true, the UI shows an illustrative synthetic-history
warning and suppresses shortfall/overflow operational guidance while retaining
the monthly scenario table.

### 3.5 Optional ML yield

The ML endpoint uses a trained Random Forest regressor, if the artifacts are
available and compatible with the installed scikit-learn version. It predicts
monthly kilolitres using roof area, month, rainfall, annual rainfall, a monthly
rainfall/30 peak-day proxy, prior-month rainfall lags, and cyclic month
features (`sin`/`cos`).

If model loading fails because artifacts are unavailable, the service returns
the physics formula instead. Both sources are identified in the response, and
the response includes physics yield and ML deviation when applicable. The Map
Studio retains historical physics yield as its main baseline; the ROI
Dashboard has a source toggle to use the ML yield when available.

### 3.6 Monsoon concentration and configuration recommendation

The monsoon dependency percentage is:

```text
monsoon share (%) = 100 × (rainfall[Jun] + rainfall[Jul] + rainfall[Aug] + rainfall[Sep])
                         / sum(all 12 monthly rainfall values)
```

This is a concentration indicator, not tank reliability or a probability of
water shortage.

The ROI Dashboard requests a configuration recommendation from a two-tier
engine:

1. **Tier 1 safety gate:** forces `Storage-Only` if coast distance is at or
   below 2.5 km, if no borewell exists, if soil permeability class is below 2,
   or if a present borewell is shallower than 30 m. A triggered gate bypasses
   the classifier; model confidence cannot override it.
2. **Tier 2 classifier:** if the gate passes, a Random Forest classifies the
   site as `Storage-Only`, `Borewell-Recharge`, or `Hybrid`. Features are roof
   area, borewell presence/depth, soil class, coast distance, annual rainfall,
   and peak-day rainfall proxy. The API returns class confidence and SHAP
   contributions when explanation is available.

The rainfall peak-day proxy submitted by the ROI UI is `max(50, max monthly
rainfall / 4)`. This is a proxy, not an observed daily maximum. These
recommendations support screening only; the input thresholds and model output
do not substitute for geotechnical or groundwater assessment.

## 4. Phase 3 — ROI Dashboard

**Purpose:** Compare continued water purchases with an RWH investment under
different cost assumptions, report stochastic payback, and evaluate tank
capacity with daily historical rainfall.

### 4.1 Phase 3 inputs and annualization

Billing totals from Phase 1 are annualized to rupees and litres per year:

```text
months = billing row count (or 1 if unavailable)
annual tanker spend (₹) = tanker spend total / months × 12
annual municipal spend (₹) = municipal spend total / months × 12
annual tanker volume (L) = tanker volume total / months × 12
capex (₹) = Phase 2 estimated capex (subject to capex-rate control)
```

The dashboard's eligible annual demand is non-potable demand. Its baseline
fallback is `flats × occupants × 65 LPCD × 365`, but normally it receives the
non-potable demand calculated in Phase 1. Daily eligible demand is annual
eligible demand divided by 365.

If annual tanker volume and municipal spend yield a valid municipal volume,
the dashboard estimates the municipal tariff as:

```text
residual municipal volume (L) = max(0, non-potable demand − tanker volume)
municipal tariff (₹/kL) = annual municipal spend / (residual municipal volume / 1,000)
```

Otherwise it uses an explicit ₹15/kL fallback and flags the fallback in the UI.

### 4.2 Rainfall reduction and yield selection

The user can select historical physics yield or the optional ML yield when
available, then apply a rainfall reduction percentage `r`:

```text
effective annual yield = selected annual yield × (1 − r / 100)
```

RWH benefit is demand-gated:

```text
effective usable yield = min(effective annual yield, eligible annual demand)
```

The deterministic engine allocates this volume against tanker purchases first,
then remaining eligible municipal demand. Tanker water is prioritized because
the UI assumes it is the higher-cost source.

### 4.3 Local planning chart and break-even curves

The dashboard computes local chart data as a fallback and for immediate
rendering. Three tanker-inflation scenarios are evaluated:

| Scenario | Annual tanker inflation |
|---|---:|
| Conservative | 6% |
| Current | 8% |
| High-Risk | 12% |

All scenarios use 5% annual municipal inflation and annual maintenance equal
to 3% of capex. Inputs and chart values are represented in ₹ lakhs. First-year
savings are computed volumetrically:

```text
tanker rate (₹/L) = annual tanker spend / annual tanker volume
tanker offset (L) = min(effective usable yield, annual tanker volume)
municipal offset (L) = min(remaining yield, remaining eligible demand)
tanker savings (₹) = tanker offset × tanker rate
municipal savings (₹) = municipal offset × municipal tariff (₹/kL) / 1,000
```

For each year `y = 1..10`:

```text
tanker spend[y] = annual tanker spend × (1 + tanker inflation)^(y−1)
municipal spend[y] = annual municipal spend × 1.05^(y−1)
gross savings[y] = tanker savings × (1 + tanker inflation)^(y−1)
                   + municipal savings × 1.05^(y−1)
RWH maintenance[y] = capex × 0.03
with-RWH spend[y] = do-nothing spend[y] − gross savings[y] + maintenance[y]
cumulative with-RWH spend = initial capex + sum(with-RWH spend[1..y])
```

The local chart marks break-even at the first year-end where cumulative
with-RWH spend is less than or equal to cumulative do-nothing spend. The chart
marker is placed at that discrete year-end, while the deterministic payback
summary interpolates within the crossing year. Because tanker inflation differs
by scenario, the RWH cost trajectory can also differ between scenarios. If all
backend ROI requests succeed, the chart uses backend cumulative cost
trajectories instead. The backend interpolates the payback point within the
year. Both paths expose the rounded-to-two-decimal payback duration in the
summary; the chart marker remains the first crossing year. If backend requests
fail or return an incomplete 10-year result, the local calculation is used.
The local calculation uses the same derived municipal tariff as the backend,
not a hard-coded fallback tariff.

The capex control changes the per-square-metre planning rate (typically
₹400–₹800/m²). The UI estimates usable area as `gross roof area × 0.80` and
recalculates capex with that area and the selected rate.

The dashboard's roof-area control changes gross area (100–1,800 m² in
25 m² steps; its handler enforces a 50 m² minimum), recalculates capex, and
recalculates physics yield from gross area × 0.80 × total monthly rainfall ×
runoff coefficient. If no positive monthly rainfall is available, this
control's yield calculation uses 2,424 mm as its rainfall fallback.
The capex-rate control ranges from ₹400 to ₹800/m² in ₹50 increments. The
rainfall-reduction control ranges from 0% to 50% in 5% steps; the tank capacity
slider ranges from 10,000 to 100,000 L in 5,000 L steps. Applying a tank-sizer
recommendation clamps its capacity to 5,000–100,000 L before updating the
slider.

The dashboard's headline rooftop self-sufficiency percentage is
`min(100, round(effective annual yield / annual eligible non-potable demand ×
100))`. It displays no badge if either input is zero. A result at or above 50%
is styled as the higher-coverage state; the styling threshold is not an
engineering viability test.

### 4.4 Backend deterministic ROI simulation

The dashboard also calls `POST /api/roi/simulate`. The Python engine is
[`roi_engine.py`](./backend/services/roi_engine.py). It computes annual
eligible demand from daily demand:

```text
annual eligible demand (L) = daily eligible demand × 365
effective annual yield (L) = min(annual yield, annual eligible demand)
tanker offset (L) = min(effective yield, annual tanker volume)
municipal offset (L) = min(effective yield − tanker offset,
                            max(0, annual demand − annual tanker volume))
tanker rate (₹/kL) = annual tanker spend / (annual tanker volume / 1,000)
```

If tanker volume is zero, the backend uses ₹150/kL as the tanker-rate
calculation fallback, but no tanker volume is offset. Net savings each year
are:

```text
gross savings[y] = tanker offset[kL] × tanker rate[y]
                   + municipal offset[kL] × municipal tariff[y]
net savings[y] = gross savings[y] − 0.03 × installation cost
tanker rate[y+1] = tanker rate[y] × (1 + scenario escalation)
municipal tariff[y+1] = municipal tariff[y] × 1.05
```

Payback is the first year cumulative net savings reaches installation cost;
the engine interpolates within that year. It returns year-by-year cumulative
spend with and without RWH. Although `tank_capacity_litres` is accepted by this
endpoint, this deterministic calculation does not simulate a tank water
balance. Interpret it as an idealized annual-yield ceiling, not a
storage-constrained forecast. Use Monte Carlo and tank sizing for storage
constraints.

The dashboard requests three backend calculations, one per tanker escalation
scenario (6%, 8%, 12%). Their cumulative expenditure series populate the
chart. The current scenario's cumulative cost curves are also used to derive
year-over-year net-savings rows for the audit export; the displayed payback
label is the rounded-up scenario-specific result.

### 4.5 Monte Carlo ROI

The ROI UI requests 1,000 Monte Carlo scenarios. It supplies the Phase 2
monthly rainfall baseline only when that baseline is tagged as actual
historical Open-Meteo data. Otherwise the backend uses its percentile CSV or
an explicit generic fallback. The response includes `scenarios_used` and
`is_site_specific`.

For each scenario, the backend samples each month independently:

- With a Phase 2 rainfall baseline: uniformly between 80% and 120% of that
  month's historical normal.
- With the percentile table: uniformly between that month's P10 and P90.
- Without the table: uniformly within fixed rough MMR-like monthly ranges.

The fixed random seed is 42, so identical inputs produce a repeatable scenario
sequence. For each sampled month:

```text
inflow (kL) = roof area × sampled rainfall (mm) × usability 0.80
              × roof runoff coefficient / 1,000
```

The monthly water balance carries tank storage forward:

```text
available = prior storage + monthly inflow
served = min(available, monthly eligible demand)
next storage = min(max(available − served, 0), tank capacity)
```

Unused inflow beyond capacity spills. This is a monthly bucket model; it does
not resolve day-by-day timing within a month. Monthly demand is a constant
`annual non-potable demand / 12`.

Tank capacity is applied as a one-time storage ceiling each month; the level
starts empty at the beginning of each sampled scenario-year and carries only
between the 12 months of that year. The 12 monthly demand caps sum to annual
non-potable demand. For annual financial offsets, the engine computes:

```text
annual eligible demand (L) = monthly demand (kL) × 1,000 × 12
tanker offset (kL) = min(annual usable yield (kL), annual tanker volume (L) / 1,000)
municipal offset (kL) = min(max(0, annual usable yield − tanker offset),
                            max(0, annual eligible demand − annual tanker volume) / 1,000)
```

First-year savings are offset volumes times their respective ₹/kL rates.
Annual maintenance is `0.03 × capex`. Net savings in year `y` are gross
savings escalated by tanker inflation and 5% municipal tariff escalation,
less maintenance. The simulation starts cumulative balance at `−capex`,
interpolates the first within-year crossing at zero, and records no-break-even
scenarios as year 11 for percentile calculations.

Break-even probability by year `y` is the fraction of all scenarios whose
interpolated break-even is at or before `y`. The median and P10/P50/P90 use
the full array, including year-11 right-censored cases; the median therefore
matches P50. The mean is conditional on scenarios that break even within 10
years. `never_break_even_pct` is the share of scenarios that do not break even
within 10 years. The UI displays censored percentile outcomes as `>10 years`
rather than implying that break-even occurs in year 11.

Independent monthly sampling does not preserve observed correlations between
months or between wet/dry years. The output is scenario analysis, not a
calibrated probability forecast.

### 4.6 Daily tank sizing

The optional tank sizer endpoint obtains daily precipitation grouped by
complete calendar year and tests the configured candidate capacities. It does
not fabricate daily rainfall if the external data request fails.

The API applies the 80% usability factor to gross roof area once. For each day:

```text
daily inflow (L) = rainfall (mm) × usable roof area (m²) × runoff coefficient
                   × (1 − first-flush fraction)
available water = previous tank storage + daily inflow
useful water = min(available water, daily eligible non-potable demand)
overflow = max(available water − useful water − tank capacity, 0)
next storage = min(available water − useful water, tank capacity)
```

The default candidate capacities are 5,000, 10,000, 15,000, 20,000, 25,000,
30,000, 40,000, 50,000, and 70,000 L. The request schema sorts candidates,
removes duplicates, and rejects negative capacities. The dashboard leaves
the candidate list at that backend default, requests a 40% reliability target,
and enables recharge overflow accounting when a borewell is marked present.
Other request defaults are a 5% first-flush loss, ₹4/L tank cost, ₹7,200 fixed
system cost, and ₹0.175/L tanker water cost (₹175/KL) when the dashboard has no positive
annual tanker volume. The nominal recharge overflow capacity is 10,000 L/day.

If recharge is enabled, overflow up to the recharge system's configured daily
capacity is counted as recharge overflow; any remainder is lost overflow.
Without recharge, all overflow is lost overflow. Recharge overflow is never
counted as financial savings. Unmet demand is the sum of `daily demand −
served` across days; useful water plus unmet demand equals total modeled
demand. At zero tank capacity, the service records no useful water and treats
all inflow as overflow (rechargeable only up to the configured daily recharge
limit when recharge is enabled).

Each historical year is simulated independently from an empty tank; storage
does not carry from one calendar year to the next. A leap year is simulated
with 366 daily records and its reliability denominator uses the actual number
of records. For each capacity, the returned annual volumes and reliability are
arithmetic means of the per-year results:

```text
reliability (%) = useful water / (daily demand × number of days) × 100
candidate capex (₹) = fixed system cost + capacity × tank cost per litre
annual savings (₹) = average useful water (L/year) × tanker rate (₹/L)
payback (years) = candidate capex / annual savings, when savings > 0
```

This tank-sizer payback is a simple capex-to-gross-savings ratio; it excludes
annual maintenance and tariff escalation. It is not the deterministic ROI
payback shown in the main dashboard.

Selection prefers the smallest candidate meeting the requested reliability
target. If none qualifies and the requested target is higher than 40%, the code
tries the smallest candidate meeting the 40% MMR fallback target; that result
is explicitly marked as not meeting the requested target. If still unmet, it
sorts positive-capacity candidates and moves up from the smallest while each
step yields at least 1.5 additional litres of annual useful water per
additional litre of tank capacity. It stops at the first step below that
threshold. This is an economic-knee heuristic, not a physical constant. If
there are no positive candidates, the first candidate is selected.

The service's returned `years` array contains each individual year's inflow,
useful water, overflow, unmet demand, reliability, and ending storage, in
addition to its across-year candidate averages. Each year record also carries
12 monthly totals for inflow, useful water, unmet demand, and exact daily
simulation month-end storage, plus recharge overflow and lost overflow.

### 4.7 Tank level visualization

The dashboard visualizes the selected candidate's exact daily simulation for
one complete historical year at a time. By default it chooses the year closest
to the median annual useful-water result; users can select any simulated year.
Every year starts with an empty tank, matching the sizing model. Month-end
storage, collected inflow, useful water, and unmet demand come directly from
the daily simulation, including the configured runoff and first-flush loss.
Overflow and recharge are displayed separately from month-end storage because
monthly total inflow minus monthly demand is not the storage change: water can
overflow on a high-rainfall day and the remaining tank water can be consumed
later in that same month.
The tank graphic opens on the month with the highest simulated month-end
storage in that year. It does not synthesize monthly rainfall or carry storage
between years, and it does not change sizing, ROI, or the selected capacity.

### 4.8 Dashboard indicators, advisory, and exports

The displayed annual maintenance estimate is:

```text
annual AMC (₹) = adjusted capex × 0.03
```

For each chart year, the dashboard derives cumulative net benefit as
`cumulative cost without RWH − cumulative cost with RWH`. Its year-over-year
net-savings row is the change in that cumulative net benefit, clamped to zero
for display; this clamp affects the audit-row presentation, not the source
ROI simulations. "Cost Without RWH by Payback" uses the current-scenario
cumulative do-nothing cost at the displayed payback year; if no payback occurs
within the horizon, it uses the final chart year.

The decision banner is a UI rule, not the ML configuration recommendation:

1. If displayed current-scenario payback is beyond 10 years, show
   **Recommended with caution**.
2. Otherwise, if effective annual yield is zero or less, show
   **Not currently recommended**.
3. Otherwise, show **Recommended**.

Because the payback check occurs first, a no-yield case whose payback is also
beyond the horizon resolves to "Recommended with caution." These labels are
not a separate financial or engineering validation.

The AI advisory endpoint does not calculate water metrics. The UI sends the
already-computed demand, effective yield, capex, annual water spend, payback,
self-sufficiency, configuration recommendation, and Monte Carlo summary to
the optional text-generation service, which is instructed to explain those
facts without recalculating them.

The downloadable audit CSV/JSON are summaries of current state:

- The CSV's effective tanker tariff is `annual tanker spend / annual tanker
  volume × 1,000` in ₹/kL, or ₹150/kL if tanker volume is zero.
- The JSON stores gross and usable area, selected yield source, rainfall
  reduction, tariff estimates, tank-sizer output if available, and financial
  and Monte Carlo summaries.
- If the tank sizer has not been run, JSON records the slider capacity as a
  default and notes that sizing was not run.
- In CSV, the "Annual Reliability Score" falls back to capped rounded
  `effective annual yield / annual non-potable demand × 100` when no tank
  sizing result exists. That fallback is self-sufficiency, not measured tank
  reliability; use the actual tank-sizer reliability when the sizer has run.
- The CSV's annual-rainfall field is inferred as
  `effective yield / (gross area × 0.80 × 0.90)` when both yield and area are
  positive, and otherwise defaults to 2,200 mm. Since it uses fixed 0.90
  runoff and active yield (which may be ML-selected or rainfall-reduced), it
  is an approximate report field, not a reliable record of the rainfall
  source.

The PDF control opens the browser's print dialog. It formats the displayed
dashboard and does not perform a separate calculation.

## 5. Shared assumptions and interpretation

1. **Demand eligibility:** ROI and tank-sizing calculations are intended to
   serve non-potable demand. Do not interpret yield as potable water without
   treatment and water-quality validation.
2. **Annual yield versus usable supply:** Annual roof yield is an upper bound.
   Seasonal rainfall, tank capacity, first flush, downtime, treatment, and
   demand timing may reduce actual utilization.
3. **Input quality:** Demonstration billing rows and default map/site values
   are not measured site data. Replace them with verified values.
4. **Rainfall provenance:** Check source/fallback metadata before relying on
   rainfall or ROI results. Regional fallback and synthetic history are not
   site-specific observations.
5. **Financial assumptions:** Maintenance, inflation, tariff, tanker rates,
   capex, and recharge costs are assumptions. Obtain current quotations and
   bills for a decision.
6. **Model outputs:** Classifier confidence and SHAP contributions describe
   the trained model's output, not engineering certainty or proof of safety.
   A triggered hard safety rule takes precedence.
7. **Not construction design:** Final storage, conveyance, treatment,
   structural, recharge, and regulatory design requires qualified local
   professionals.

## 6. Source files

### Frontend

- [Virtual Meter](./src/views/VirtualMeter.jsx)
- [Map Studio](./src/views/MapStudio.jsx)
- [ROI Dashboard](./src/views/ROIDashboard.jsx)
- [Shared constants and canonical demand](./src/utils/waterConstants.js)
- [Forecast-driven outlook calculation](./src/utils/forecastOutlook.js)
- [Cross-phase state](./src/context/WaterWalletContext.jsx)
- [API client](./src/api/waterwallet.js)

### Backend

- [Demand engine](./backend/services/demand_engine.py)
- [Rainfall retrieval and aggregation](./backend/services/rainfall_api.py)
- [Rainfall forecast](./backend/services/rainfall_forecast.py)
- [Yield engine](./backend/services/yield_engine.py)
- [ML yield and recommendation engine](./backend/services/ml_engine.py)
- [Recommendation safety gate](./backend/services/tier1_safety.py)
- [Deterministic ROI engine](./backend/services/roi_engine.py)
- [Monte Carlo ROI engine](./backend/services/monte_carlo.py)
- [Daily tank sizing engine](./backend/services/tank_sizer.py)
- [API request validation](./backend/models/schemas.py)
