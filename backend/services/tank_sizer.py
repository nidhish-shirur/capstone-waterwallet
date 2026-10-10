"""Daily historical water-balance tank sizing.

Overflow is deliberately not financial savings:
* useful water is rainwater consumed by modeled non-potable demand;
* recharge overflow is an environmental/regulatory metric;
* lost overflow is a design-efficiency metric.
"""

from dataclasses import dataclass


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


def simulate_tank_year(
    rainfall_mm: list[float],
    tank_capacity_litres: float,
    daily_demand_litres: float,
    usable_roof_area_sqm: float,
    runoff_coefficient: float,
    first_flush_fraction: float,
    year: int,
    recharge_enabled: bool,
) -> TankYearResult:
    # daily_demand_litres is eligible non-potable demand only (for example,
    # flushing and gardening), never total society/IS 1172 demand.
    tank_level = 0.0
    useful = recharge_overflow = lost_overflow = unmet = 0.0
    total_inflow = 0.0

    for rain_mm in rainfall_mm:
        inflow = max(0.0, rain_mm) * usable_roof_area_sqm * runoff_coefficient
        inflow *= 1.0 - first_flush_fraction
        total_inflow += inflow
        if tank_capacity_litres <= 0:
            lost_overflow += inflow
            unmet += daily_demand_litres
            continue
        available = tank_level + inflow
        served = min(available, daily_demand_litres)
        tank_level = available - served
        overflow = max(0.0, tank_level - tank_capacity_litres)
        tank_level = min(tank_level, tank_capacity_litres)

        useful += served
        unmet += daily_demand_litres - served
        if recharge_enabled:
            recharge_overflow += overflow
        else:
            lost_overflow += overflow

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
) -> dict:
    candidates = []
    for capacity in candidate_capacities_litres:
        yearly = [
            simulate_tank_year(
                rainfall, capacity, daily_demand_litres, usable_roof_area_sqm,
                runoff_coefficient, first_flush_fraction, year, recharge_enabled,
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
        # Do not select the zero-capacity baseline just because no candidate
        # reaches the target; that makes a working system appear to produce
        # zero water. Prefer the highest-reliability non-zero option and
        # report that the target was not reached.
        non_zero = [row for row in candidates if row["capacity_litres"] > 0]
        selected = max(
            non_zero or candidates,
            key=lambda row: (row["reliability_percent"], row["useful_water_litres"], -row["capacity_litres"]),
        )
        selection_status = "best_available_below_reliability_target"
        selection_reason = (
            f"No tested tank reaches the {reliability_target_percent:g}% "
            "average reliability target; selected the highest-reliability "
            "non-zero capacity."
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
