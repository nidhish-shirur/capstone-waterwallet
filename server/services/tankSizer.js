import {
  CANDIDATE_CAPACITIES_L,
  MARGINAL_RETURN_FLOOR,
  DEFAULT_RECHARGE_CAPACITY_LITRES_PER_DAY,
} from "../constants.js";

export function simulateTankYear({
  rainfall_mm,
  tank_capacity_litres,
  daily_demand_litres,
  usable_roof_area_sqm,
  runoff_coefficient,
  first_flush_fraction,
  year,
  recharge_enabled,
  recharge_capacity_litres_per_day = DEFAULT_RECHARGE_CAPACITY_LITRES_PER_DAY,
}) {
  let tank_level = 0.0;
  let useful = 0.0;
  let recharge_overflow = 0.0;
  let lost_overflow = 0.0;
  let unmet = 0.0;
  let total_inflow = 0.0;

  for (const rain_mm of rainfall_mm) {
    let inflow = Math.max(0.0, rain_mm) * usable_roof_area_sqm * runoff_coefficient;
    inflow *= 1.0 - first_flush_fraction;
    total_inflow += inflow;

    if (tank_capacity_litres <= 0) {
      if (recharge_enabled) {
        const recharged = Math.min(inflow, recharge_capacity_litres_per_day);
        recharge_overflow += recharged;
        lost_overflow += inflow - recharged;
      } else {
        lost_overflow += inflow;
      }
      unmet += daily_demand_litres;
      continue;
    }

    const available = tank_level + inflow;
    const served = Math.min(available, daily_demand_litres);
    tank_level = available - served;
    const overflow = Math.max(0.0, tank_level - tank_capacity_litres);
    tank_level = Math.min(tank_level, tank_capacity_litres);

    useful += served;
    unmet += daily_demand_litres - served;

    if (recharge_enabled) {
      const recharged = Math.min(overflow, recharge_capacity_litres_per_day);
      recharge_overflow += recharged;
      lost_overflow += overflow - recharged;
    } else {
      lost_overflow += overflow;
    }
  }

  const total_demand = daily_demand_litres * rainfall_mm.length;
  const reliability = total_demand ? (useful / total_demand) * 100.0 : 100.0;

  return {
    year,
    useful_water_litres: Math.round(useful * 100) / 100,
    recharge_overflow_litres: Math.round(recharge_overflow * 100) / 100,
    lost_overflow_litres: Math.round(lost_overflow * 100) / 100,
    unmet_demand_litres: Math.round(unmet * 100) / 100,
    reliability_percent: Math.round(reliability * 100) / 100,
    ending_storage_litres: Math.round(tank_level * 100) / 100,
    total_inflow_litres: Math.round(total_inflow * 100) / 100,
  };
}

export function sizeTanks({
  rainfall_by_year,
  candidate_capacities_litres = CANDIDATE_CAPACITIES_L,
  daily_demand_litres,
  usable_roof_area_sqm,
  runoff_coefficient = 0.90,
  first_flush_fraction = 0.05,
  tanker_rate_per_litre = 0.175,
  tank_cost_per_litre = 4.0,
  fixed_system_cost = 7200.0,
  reliability_target_percent = 40.0,
  recharge_enabled = true,
  recharge_capacity_litres_per_day = DEFAULT_RECHARGE_CAPACITY_LITRES_PER_DAY,
}) {
  const candidates = [];
  const years = Object.keys(rainfall_by_year).map(Number).sort((a, b) => a - b);

  for (const capacity of candidate_capacities_litres) {
    const yearly = years.map((yr) =>
      simulateTankYear({
        rainfall_mm: rainfall_by_year[yr],
        tank_capacity_litres: capacity,
        daily_demand_litres,
        usable_roof_area_sqm,
        runoff_coefficient,
        first_flush_fraction,
        year: yr,
        recharge_enabled,
        recharge_capacity_litres_per_day,
      })
    );

    const n = yearly.length;
    const useful = yearly.reduce((acc, row) => acc + row.useful_water_litres, 0) / n;
    const recharge = yearly.reduce((acc, row) => acc + row.recharge_overflow_litres, 0) / n;
    const lost = yearly.reduce((acc, row) => acc + row.lost_overflow_litres, 0) / n;
    const unmet = yearly.reduce((acc, row) => acc + row.unmet_demand_litres, 0) / n;
    const reliability = yearly.reduce((acc, row) => acc + row.reliability_percent, 0) / n;

    const capex = fixed_system_cost + capacity * tank_cost_per_litre;
    const annual_savings = useful * tanker_rate_per_litre;

    candidates.push({
      capacity_litres: capacity,
      useful_water_litres: Math.round(useful * 100) / 100,
      recharge_overflow_litres: Math.round(recharge * 100) / 100,
      lost_overflow_litres: Math.round(lost * 100) / 100,
      unmet_demand_litres: Math.round(unmet * 100) / 100,
      reliability_percent: Math.round(reliability * 100) / 100,
      estimated_capex_inr: Math.round(capex * 100) / 100,
      annual_savings_inr: Math.round(annual_savings * 100) / 100,
      payback_years: annual_savings ? Math.round((capex / annual_savings) * 100) / 100 : null,
      years: yearly,
    });
  }

  const qualifying = candidates.filter(
    (row) => row.reliability_percent >= reliability_target_percent
  );

  let selected;
  let reliability_target_met = false;
  let selection_status;
  let selection_reason;

  if (qualifying.length > 0) {
    selected = [...qualifying].sort((a, b) => a.capacity_litres - b.capacity_litres)[0];
    selection_status = "meets_reliability_target";
    selection_reason = `Smallest tested tank meeting the ${reliability_target_percent}% average reliability target.`;
    reliability_target_met = true;
  } else {
    const fallbackTarget = 40.0;
    const qualifyingFallback =
      reliability_target_percent > fallbackTarget
        ? candidates.filter((row) => row.reliability_percent >= fallbackTarget)
        : [];

    if (qualifyingFallback.length > 0) {
      selected = [...qualifyingFallback].sort((a, b) => a.capacity_litres - b.capacity_litres)[0];
      selection_status = "meets_realistic_mmr_target";
      selection_reason = `Requested ${reliability_target_percent}% target is unachievable under MMR seasonal monsoon rainfall. Selected smallest tank meeting the realistic MMR seasonal target of ${fallbackTarget}%.`;
      reliability_target_met = false;
    } else {
      const nonZero = [...candidates]
        .filter((row) => row.capacity_litres > 0)
        .sort((a, b) => a.capacity_litres - b.capacity_litres);

      if (nonZero.length > 0) {
        selected = nonZero[0];
        for (let i = 1; i < nonZero.length; i++) {
          const prev = nonZero[i - 1];
          const curr = nonZero[i];
          const dWater = curr.useful_water_litres - prev.useful_water_litres;
          const dCap = curr.capacity_litres - prev.capacity_litres;
          if (dCap > 0 && dWater / dCap >= MARGINAL_RETURN_FLOOR) {
            selected = curr;
          } else {
            break;
          }
        }
      } else {
        selected = candidates[0];
      }

      selection_status = "optimal_diminishing_returns_knee";
      selection_reason = `Full-year reliability target of ${reliability_target_percent}% is constrained by Mumbai's 8 dry months. Selected ${selected.capacity_litres.toLocaleString()} L as the optimal economic capacity (marginal return threshold: ${MARGINAL_RETURN_FLOOR} L useful water per additional L of tank capacity per year).`;
      reliability_target_met = false;
    }
  }

  return {
    selected_candidate: selected,
    reliability_target_met,
    selection_reason,
    selection_status,
    reliability_target_percent,
    candidates,
    years_used: years,
    source: "open_meteo_daily",
    fallback_used: false,
  };
}
