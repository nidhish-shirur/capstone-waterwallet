import calendar

from models.constants import IS_LPCD
from models.db_models import Society
from models.schemas import WaterAuditMonth, WaterAuditResponse
from services.demand_engine import calculate_demand


def build_water_audit(society: Society, requested_year: int | None = None) -> WaterAuditResponse:
    records_by_year_month = {
        (entry.year, entry.month): entry for entry in society.billing_entries
    }
    available_years = sorted({year for year, _ in records_by_year_month})
    selected_year = requested_year
    if selected_year is None and available_years:
        selected_year = available_years[-1]
    if selected_year is not None and selected_year not in available_years:
        selected_year = None

    demand = calculate_demand(
        num_flats=society.num_flats,
        occupants_per_flat=society.occupants,
        lpcd=IS_LPCD,
        include_losses=True,
    )
    daily_demand = demand["daily_demand_lpd"]
    daily_non_potable_demand = demand["non_potable_demand_lpd"]
    months: list[WaterAuditMonth] = []

    if selected_year is not None:
        for month in range(1, 13):
            record = records_by_year_month.get((selected_year, month))
            days = calendar.monthrange(selected_year, month)[1]
            demand_kl = daily_demand * days / 1000
            non_potable_demand_kl = daily_non_potable_demand * days / 1000
            missing_inputs: list[str] = []
            municipal_volume = record.municipal_volume_kl if record else None
            borewell_volume = record.borewell_volume_kl if record else None

            if municipal_volume is None:
                missing_inputs.append("municipal volume")
            if record is None or record.tankers is None:
                tanker_volume = None
                missing_inputs.append("tanker deliveries")
            elif record.tankers == 0:
                tanker_volume = 0.0
            elif record.tanker_capacity_l is None:
                tanker_volume = None
                missing_inputs.append("tanker capacity")
            else:
                tanker_volume = record.tankers * record.tanker_capacity_l / 1000
            if borewell_volume is None:
                missing_inputs.append("borewell volume or confirmed zero")

            measured_volumes = [
                value
                for value in (municipal_volume, tanker_volume, borewell_volume)
                if value is not None
            ]
            known_supply = sum(measured_volumes)
            complete = not missing_inputs
            months.append(
                WaterAuditMonth(
                    month=month,
                    demand_kl=round(demand_kl, 2),
                    non_potable_demand_kl=round(non_potable_demand_kl, 2),
                    municipal_volume_kl=municipal_volume,
                    tanker_volume_kl=tanker_volume,
                    borewell_volume_kl=borewell_volume,
                    known_supply_kl=round(known_supply, 2),
                    shortage_kl=round(max(0.0, demand_kl - known_supply), 2)
                    if complete
                    else None,
                    tanker_dependency_percent=round(tanker_volume / demand_kl * 100, 2)
                    if tanker_volume is not None and demand_kl > 0
                    else None,
                    missing_inputs=missing_inputs,
                    supply_source="recorded_unverified" if record else "unavailable",
                )
            )

    complete_year = bool(months) and all(not month.missing_inputs for month in months)
    observed_period_demand = sum(month.demand_kl for month in months)
    observed_period_tanker_volume = (
        sum(month.tanker_volume_kl or 0 for month in months)
        if months and all(month.tanker_volume_kl is not None for month in months)
        else None
    )
    dependency = (
        round(observed_period_tanker_volume / observed_period_demand * 100, 2)
        if observed_period_tanker_volume is not None and observed_period_demand > 0
        else None
    )

    return WaterAuditResponse(
        year=selected_year,
        available_years=available_years,
        complete_year=complete_year,
        months=months,
        observed_period_demand_kl=round(observed_period_demand, 2),
        observed_period_tanker_volume_kl=(
            round(observed_period_tanker_volume, 2)
            if observed_period_tanker_volume is not None
            else None
        ),
        observed_period_tanker_dependency_percent=dependency,
        source="derived_from_recorded_inputs" if selected_year is not None else "missing",
    )
