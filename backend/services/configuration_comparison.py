from models.constants import DEFAULT_FIRST_FLUSH_FRACTION, USABILITY_FACTOR
from models.schemas import (
    ConfigurationComparisonRequest,
    ConfigurationScenarioResult,
    CostEstimateRequest,
)
from services.cost_engine import estimate_project_cost
from services.tank_sizer import (
    DEFAULT_RECHARGE_CAPACITY_LITRES_PER_DAY,
    simulate_tank_year,
)
from services.tier1_safety import tier1_safety_gate


def compare_configurations(
    payload: ConfigurationComparisonRequest,
    rainfall_by_year: dict[int, list[float]],
    runoff_coefficient: float,
) -> dict:
    safety_result = tier1_safety_gate(
        coastal_km=payload.coastal_distance_km,
        soil_perm=payload.soil_permeability_class,
        borewell=payload.borewell_present,
        borewell_depth=payload.borewell_depth_m,
    )
    recharge_allowed = safety_result is None
    scenarios = []
    configurations = (
        ("storage_only", payload.tank_capacity_litres, False),
        ("recharge_only", 0.0, True),
        ("hybrid", payload.tank_capacity_litres, True),
    )

    for configuration, capacity, recharge_enabled in configurations:
        is_safe = configuration == "storage_only" or recharge_allowed
        cost = estimate_project_cost(
            CostEstimateRequest(
                configuration=configuration,
                gross_roof_area_sqm=payload.gross_roof_area_sqm,
                capex_rate_per_sqm=payload.capex_rate_per_sqm,
                tank_capacity_litres=capacity,
                tank_cost_per_litre=payload.tank_cost_per_litre,
                recharge_connection_cost_inr=payload.recharge_connection_cost_inr,
                annual_maintenance_rate=payload.annual_maintenance_rate,
                fixed_annual_opex_inr=payload.fixed_annual_opex_inr,
            )
        )
        if not is_safe:
            scenarios.append(
                ConfigurationScenarioResult(
                    configuration=configuration,
                    eligible=False,
                    safety_reason=safety_result["reason"],
                    average_useful_water_litres=None,
                    average_recharge_overflow_litres=None,
                    average_lost_overflow_litres=None,
                    average_unmet_demand_litres=None,
                    average_reliability_percent=None,
                    capex_breakdown=cost.capex_breakdown,
                    capex_subtotal_inr=cost.capex_subtotal_inr,
                    total_capex_inr=cost.total_capex_inr,
                    capex_complete=cost.capex_complete,
                    annual_opex_inr=cost.annual_opex_inr,
                    annual_tanker_offset_litres=None,
                    annual_gross_savings_inr=None,
                    annual_net_savings_inr=None,
                    simple_payback_years=None,
                    missing_financial_inputs=["Recharge option failed the Tier 1 safety gate."],
                )
            )
            continue

        yearly = [
            simulate_tank_year(
                rainfall_mm=rainfall,
                tank_capacity_litres=capacity,
                daily_demand_litres=payload.daily_non_potable_demand_litres,
                usable_roof_area_sqm=payload.gross_roof_area_sqm * USABILITY_FACTOR,
                runoff_coefficient=runoff_coefficient,
                first_flush_fraction=DEFAULT_FIRST_FLUSH_FRACTION,
                year=year,
                recharge_enabled=recharge_enabled,
                recharge_capacity_litres_per_day=DEFAULT_RECHARGE_CAPACITY_LITRES_PER_DAY,
            )
            for year, rainfall in sorted(rainfall_by_year.items())
        ]
        year_count = len(yearly)
        useful = sum(row.useful_water_litres for row in yearly) / year_count
        recharged = sum(row.recharge_overflow_litres for row in yearly) / year_count
        lost = sum(row.lost_overflow_litres for row in yearly) / year_count
        unmet = sum(row.unmet_demand_litres for row in yearly) / year_count
        reliability = sum(row.reliability_percent for row in yearly) / year_count

        missing_financial_inputs = []
        tanker_offset = None
        gross_savings = None
        net_savings = None
        payback = None
        if payload.annual_tanker_volume_litres is None:
            missing_financial_inputs.append("annual measured tanker volume")
        if payload.annual_tanker_spend_inr is None:
            missing_financial_inputs.append("annual measured tanker expenditure")
        if not cost.capex_complete:
            missing_financial_inputs.append("recharge connection quotation")
        elif (
            payload.annual_tanker_volume_litres is not None
            and payload.annual_tanker_spend_inr is not None
        ):
            tanker_offset = min(useful, payload.annual_tanker_volume_litres)
            tanker_rate = (
                payload.annual_tanker_spend_inr / payload.annual_tanker_volume_litres
                if payload.annual_tanker_volume_litres > 0
                else 0.0
            )
            gross_savings = round(tanker_offset * tanker_rate, 2)
            net_savings = round(gross_savings - (cost.annual_opex_inr or 0), 2)
            if cost.total_capex_inr is not None and net_savings > 0:
                payback = round(cost.total_capex_inr / net_savings, 2)

        scenarios.append(
            ConfigurationScenarioResult(
                configuration=configuration,
                eligible=True,
                safety_reason=None,
                average_useful_water_litres=round(useful, 2),
                average_recharge_overflow_litres=round(recharged, 2),
                average_lost_overflow_litres=round(lost, 2),
                average_unmet_demand_litres=round(unmet, 2),
                average_reliability_percent=round(reliability, 2),
                capex_breakdown=cost.capex_breakdown,
                capex_subtotal_inr=cost.capex_subtotal_inr,
                total_capex_inr=cost.total_capex_inr,
                capex_complete=cost.capex_complete,
                annual_opex_inr=cost.annual_opex_inr,
                annual_tanker_offset_litres=(
                    round(tanker_offset, 2) if tanker_offset is not None else None
                ),
                annual_gross_savings_inr=gross_savings,
                annual_net_savings_inr=net_savings,
                simple_payback_years=payback,
                missing_financial_inputs=missing_financial_inputs,
            )
        )

    return {
        "rainfall_source": "open_meteo_daily",
        "fallback_used": False,
        "years_used": sorted(rainfall_by_year),
        "scenarios": scenarios,
        "source": "derived_from_real",
    }
