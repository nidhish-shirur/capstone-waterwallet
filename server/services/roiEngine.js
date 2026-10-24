export function simulateROI({
  daily_demand_lpd,
  annual_yield_litres,

  water_tariff_per_kl = 15.0,
  installation_cost = 250000.0,
  years = 10,
  tariff_escalation_rate = 0.0,
  annual_tanker_spend = 200000.0,
  annual_tanker_volume_litres = 1333333.3,
  annual_municipal_spend = 46000.0,
}) {
  const annual_demand_litres = daily_demand_lpd * 365;
  const effective_annual_yield = Math.min(annual_yield_litres, annual_demand_litres);

  const offset_tanker = Math.min(effective_annual_yield, annual_tanker_volume_litres);
  const offset_municipal = Math.min(
    effective_annual_yield - offset_tanker,
    Math.max(0.0, annual_demand_litres - annual_tanker_volume_litres)
  );

  const offset_tanker_kl = offset_tanker / 1000.0;
  const offset_municipal_kl = offset_municipal / 1000.0;

  const tanker_rate_per_kl =
    annual_tanker_volume_litres > 0
      ? annual_tanker_spend / (annual_tanker_volume_litres / 1000.0)
      : 150.0;
  const annual_maintenance_cost = installation_cost * 0.03;

  const valid_tariff = Math.max(0, Number(water_tariff_per_kl) || 0);

  const yearly_breakdown = [];
  let cumulative_savings = 0.0;
  let payback_years = null;
  let ten_year_savings = 0.0;

  let cumulative_without_rwh = 0.0;
  let cumulative_with_rwh = installation_cost;

  let current_tanker_rate = tanker_rate_per_kl;
  let current_municipal_rate = valid_tariff;

  let curr_base_tanker = annual_tanker_spend;
  let curr_base_municipal = annual_municipal_spend;

  for (let year = 1; year <= years; year++) {
    const year_savings =
      offset_tanker_kl * current_tanker_rate +
      offset_municipal_kl * current_municipal_rate;
    const net_savings = year_savings - annual_maintenance_cost;

    const year_without_rwh = curr_base_tanker + curr_base_municipal;
    const year_with_rwh =
      year_without_rwh - year_savings + annual_maintenance_cost;

    cumulative_savings += net_savings;
    cumulative_without_rwh += year_without_rwh;
    cumulative_with_rwh += year_with_rwh;
    const net_benefit = cumulative_savings - installation_cost;

    if (
      payback_years === null &&
      net_savings > 0 &&
      cumulative_savings >= installation_cost
    ) {
      const excess = cumulative_savings - installation_cost;
      payback_years = net_savings > 0
        ? Math.round((year - excess / net_savings) * 100) / 100
        : year;
    }

    yearly_breakdown.push({
      year,
      savings: Math.round(net_savings * 100) / 100,
      cumulative_savings: Math.round(cumulative_savings * 100) / 100,
      net_benefit: Math.round(net_benefit * 100) / 100,
      cumulative_without_rwh: Math.round(cumulative_without_rwh * 100) / 100,
      cumulative_with_rwh: Math.round(cumulative_with_rwh * 100) / 100,
    });

    if (year <= 10) {
      ten_year_savings += net_savings;
    }

    current_tanker_rate *= 1 + tariff_escalation_rate;
    current_municipal_rate *= 1.05;
    curr_base_tanker *= 1 + tariff_escalation_rate;
    curr_base_municipal *= 1.05;
  }

  return {
    payback_years,
    total_period_savings: Math.round(cumulative_savings * 100) / 100,
    ten_year_savings: Math.round(ten_year_savings * 100) / 100,
    yearly_breakdown,
  };
}
