"""Daily historical water-balance tank sizing.

Overflow is deliberately not financial savings:
* useful water is rainwater consumed by modeled non-potable demand;
* recharge overflow is an environmental/regulatory metric;
* lost overflow is a design-efficiency metric.
"""

from calendar import monthrange
from dataclasses import dataclass

# Standard candidate capacities realistic for MMR residential installations (5k–70k L)
CANDIDATE_CAPACITIES_L = [5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 70000]

# ── Diminishing-returns threshold ─────────────────────────────────────────────
# Project-specific heuristic, NOT a physical constant.
# A tank litre can cycle many times during a monsoon (fill-draw-fill), so annual
# useful water per litre of capacity routinely exceeds 1.0.  We stop expanding
# when each extra litre of tank capacity yields less than MARGINAL_RETURN_FLOOR
# litres of additional useful water per year, because below this point civil
# construction cost dominates the benefit.  The value 1.5 was chosen for MMR
# residential economics where tank civil cost ≈ ₹4/L and tanker water ≈ ₹0.175/L,
# giving a payback-neutral ratio of about 22.9; 1.5 is a conservative floor that
# stops well before the knee becomes flat.
MARGINAL_RETURN_FLOOR = 1.5

# ── Default recharge pit capacity ─────────────────────────────────────────────
# A standard MMR recharge pit (1.2 m dia × 3 m deep, gravel-packed) can
# infiltrate roughly 8,000–12,000 L/day depending on soil permeability.
# 10,000 L/day is used as the default finite capacity.  Any tank overflow
# exceeding this daily rate spills to stormwater drain as lost_overflow.
DEFAULT_RECHARGE_CAPACITY_LITRES_PER_DAY = 10_000


@dataclass(frozen=True)
class TankYearResult:
    year: int
    useful_water_litres: float
    recharge_overflow_litres: float
    lost_overflow_litres: float
    unmet_demand_litres: float
    reliability_percent: float
    ending_storage_litres: float
    total_inflow_litres: float
    monthly_inflow_litres: list[float]
    monthly_useful_water_litres: list[float]
    monthly_unmet_demand_litres: list[float]
    monthly_recharge_overflow_litres: list[float]
    monthly_lost_overflow_litres: list[float]
    monthly_ending_storage_litres: list[float]


def simulate_tank_year(
    rainfall_mm: list[float],
    tank_capacity_litres: float,
    daily_demand_litres: float,
    usable_roof_area_sqm: float,
    runoff_coefficient: float,
    first_flush_fraction: float,
    year: int,
    recharge_enabled: bool,
    recharge_capacity_litres_per_day: float = DEFAULT_RECHARGE_CAPACITY_LITRES_PER_DAY,
) -> TankYearResult:
    # daily_demand_litres is eligible non-potable demand only (for example,
    # flushing and gardening), never total society/IS 1172 demand.
    tank_level = 0.0
    useful = recharge_overflow = lost_overflow = unmet = 0.0
    total_inflow = 0.0
    monthly_inflow = [0.0] * 12
    monthly_useful = [0.0] * 12
    monthly_unmet = [0.0] * 12
    monthly_recharge_overflow = [0.0] * 12
    monthly_lost_overflow = [0.0] * 12
    monthly_ending_storage = [0.0] * 12
    month_index = 0
    day_in_month = 0

    for rain_mm in rainfall_mm:
        while month_index < 11 and day_in_month >= monthrange(year, month_index + 1)[1]:
            month_index += 1
            day_in_month = 0

        inflow = max(0.0, rain_mm) * usable_roof_area_sqm * runoff_coefficient
        inflow *= 1.0 - first_flush_fraction
        total_inflow += inflow
        monthly_inflow[month_index] += inflow
        served = 0.0
        unmet_today = daily_demand_litres
        recharged_today = 0.0
        lost_today = 0.0
        if tank_capacity_litres <= 0:
            if recharge_enabled:
                recharged = min(inflow, recharge_capacity_litres_per_day)
                recharge_overflow += recharged
                lost_overflow += inflow - recharged
                recharged_today = recharged
                lost_today = inflow - recharged
            else:
                lost_overflow += inflow
                lost_today = inflow
        else:
            available = tank_level + inflow
            served = min(available, daily_demand_litres)
            tank_level = available - served
            overflow = max(0.0, tank_level - tank_capacity_litres)
            tank_level = min(tank_level, tank_capacity_litres)

            if recharge_enabled:
                # Recharge pit has finite daily infiltration capacity.
                # Overflow beyond this rate spills to stormwater drain.
                recharged = min(overflow, recharge_capacity_litres_per_day)
                recharge_overflow += recharged
                lost_overflow += overflow - recharged
                recharged_today = recharged
                lost_today = overflow - recharged
            else:
                lost_overflow += overflow
                lost_today = overflow

            useful += served
            unmet_today = daily_demand_litres - served
        unmet += unmet_today
        monthly_useful[month_index] += served
        monthly_unmet[month_index] += unmet_today
        monthly_recharge_overflow[month_index] += recharged_today
        monthly_lost_overflow[month_index] += lost_today
        monthly_ending_storage[month_index] = tank_level
        day_in_month += 1

    total_demand = daily_demand_litres * len(rainfall_mm)
    reliability = (useful / total_demand * 100.0) if total_demand else 100.0
    return TankYearResult(
        year=year,
        useful_water_litres=round(useful, 2),
        recharge_overflow_litres=round(recharge_overflow, 2),
        lost_overflow_litres=round(lost_overflow, 2),
        unmet_demand_litres=round(unmet, 2),
        reliability_percent=round(reliability, 2),
        ending_storage_litres=round(tank_level, 2),
        total_inflow_litres=round(total_inflow, 2),
        monthly_inflow_litres=[round(value, 2) for value in monthly_inflow],
        monthly_useful_water_litres=[round(value, 2) for value in monthly_useful],
        monthly_unmet_demand_litres=[round(value, 2) for value in monthly_unmet],
        monthly_recharge_overflow_litres=[round(value, 2) for value in monthly_recharge_overflow],
        monthly_lost_overflow_litres=[round(value, 2) for value in monthly_lost_overflow],
        monthly_ending_storage_litres=[round(value, 2) for value in monthly_ending_storage],
    )


def size_tanks(
    rainfall_by_year: dict[int, list[float]],
    candidate_capacities_litres: list[float],
    daily_demand_litres: float,
    usable_roof_area_sqm: float,
    runoff_coefficient: float,
    first_flush_fraction: float,
    tanker_rate_per_litre: float,
    tank_cost_per_litre: float,
    fixed_system_cost: float,
    reliability_target_percent: float,
    recharge_enabled: bool,
    recharge_capacity_litres_per_day: float = DEFAULT_RECHARGE_CAPACITY_LITRES_PER_DAY,
) -> dict:
    """Size RWH tanks against daily historical rainfall.

    Financial parameters are caller-supplied, not hard-coded:
      * ``tank_cost_per_litre`` — storage vessel material/civil cost per litre
        of capacity (default 4.0 INR/L in the API schema).
      * ``fixed_system_cost`` — shared first-flush, filter, piping, and
        installation cost (default 7,200 INR in the API schema).
      * ``tanker_rate_per_litre`` — effective tanker water cost for savings
        calculation (default 0.175 INR/L, equivalent to 175 INR/KL).

    Capex for a candidate = fixed_system_cost + (capacity × tank_cost_per_litre).
    These defaults are illustrative for MMR housing-society scale; callers
    should override them with site-specific quotations when available.
    """
    candidates = []
    for capacity in candidate_capacities_litres:
        yearly = [
            simulate_tank_year(
                rainfall, capacity, daily_demand_litres, usable_roof_area_sqm,
                runoff_coefficient, first_flush_fraction, year, recharge_enabled,
                recharge_capacity_litres_per_day,
            )
            for year, rainfall in sorted(rainfall_by_year.items())
        ]
        useful = sum(row.useful_water_litres for row in yearly) / len(yearly)
        recharge = sum(row.recharge_overflow_litres for row in yearly) / len(yearly)
        lost = sum(row.lost_overflow_litres for row in yearly) / len(yearly)
        unmet = sum(row.unmet_demand_litres for row in yearly) / len(yearly)
        reliability = sum(row.reliability_percent for row in yearly) / len(yearly)
        # Fixed collection components are shared by all candidates; only the
        # storage vessel cost scales with capacity.
        capex = fixed_system_cost + (capacity * tank_cost_per_litre)
        annual_savings = useful * tanker_rate_per_litre
        candidates.append({
            "capacity_litres": capacity,
            "useful_water_litres": round(useful, 2),
            "recharge_overflow_litres": round(recharge, 2),
            "lost_overflow_litres": round(lost, 2),
            "unmet_demand_litres": round(unmet, 2),
            "reliability_percent": round(reliability, 2),
            "estimated_capex_inr": round(capex, 2),
            "annual_savings_inr": round(annual_savings, 2),
            "payback_years": round(capex / annual_savings, 2) if annual_savings else None,
            "years": [row.__dict__ for row in yearly],
        })

    qualifying = [row for row in candidates if row["reliability_percent"] >= reliability_target_percent]
    if qualifying:
        selected = min(qualifying, key=lambda row: row["capacity_litres"])
        selection_status = "meets_reliability_target"
        selection_reason = (
            f"Smallest tested tank meeting the {reliability_target_percent:g}% "
            "average reliability target."
        )
        reliability_target_met = True
    else:
        # In MMR, rainfall is concentrated in 3-4 monsoon months; 80% is physically unachievable.
        # If no candidate hits the requested target, check against realistic MMR threshold (40%).
        fallback_target = 40.0
        qualifying_fallback = [row for row in candidates if row["reliability_percent"] >= fallback_target] if reliability_target_percent > fallback_target else []

        if qualifying_fallback:
            selected = min(qualifying_fallback, key=lambda row: row["capacity_litres"])
            selection_status = "meets_realistic_mmr_target"
            selection_reason = (
                f"Requested {reliability_target_percent:g}% target is unachievable under MMR seasonal monsoon rainfall. "
                f"Selected smallest tank meeting the realistic MMR seasonal target of {fallback_target:g}%."
            )
            reliability_target_met = False
        else:
            # When the target cannot be met (due to dry months outside monsoon),
            # do NOT blindly select the largest tank via max(). That leads to oversized
            # 70k-150k L tanks with steep diminishing returns.
            # Instead, select the economic knee point: the capacity where marginal
            # useful-water gain per additional litre of tank storage drops below the
            # project-specific diminishing-returns threshold (MARGINAL_RETURN_FLOOR).
            # This threshold is a heuristic, not a physical constant — see the
            # module-level comment on MARGINAL_RETURN_FLOOR for rationale.
            non_zero = sorted(
                [row for row in candidates if row["capacity_litres"] > 0],
                key=lambda row: row["capacity_litres"],
            )
            if non_zero:
                selected = non_zero[0]
                for i in range(1, len(non_zero)):
                    prev = non_zero[i - 1]
                    curr = non_zero[i]
                    d_water = curr["useful_water_litres"] - prev["useful_water_litres"]
                    d_cap = curr["capacity_litres"] - prev["capacity_litres"]
                    if d_cap > 0 and (d_water / d_cap) >= MARGINAL_RETURN_FLOOR:
                        selected = curr
                    else:
                        break
            else:
                selected = candidates[0]

            selection_status = "optimal_diminishing_returns_knee"
            selection_reason = (
                f"Full-year reliability target of {reliability_target_percent:g}% is constrained by Mumbai's 8 dry months. "
                f"Selected {int(selected['capacity_litres']):,} L as the optimal economic capacity "
                f"(marginal return threshold: {MARGINAL_RETURN_FLOOR} L useful water per additional L of tank capacity per year)."
            )
            reliability_target_met = False
    return {
        "selected_candidate": selected,
        "reliability_target_met": reliability_target_met,
        "selection_reason": selection_reason,
        "selection_status": selection_status,
        "reliability_target_percent": reliability_target_percent,
        "candidates": candidates,
        "years_used": sorted(rainfall_by_year),
        "source": "open_meteo_daily",
        "fallback_used": False,
    }
