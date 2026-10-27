from models.constants import USABILITY_FACTOR
from models.schemas import CostEstimateRequest, CostEstimateResponse, CostLineItem


def estimate_project_cost(payload: CostEstimateRequest) -> CostEstimateResponse:
    assumptions = [
        "Catchment/installation rate is the existing Map Studio planning assumption (₹600 per usable m²), not a contractor quotation; it has no verified price date or geographic basis.",
        "Tank rate is the existing tank-sizer planning assumption (₹4 per litre), not a contractor quotation; it has no verified price date or geographic basis.",
        "Maintenance rate is the existing ROI planning assumption (3% of CAPEX per year), not a vendor-validated operating budget.",
        "The catchment/installation and tank estimates are additive in this model; confirm their scopes do not overlap before using a contractor budget.",
    ]
    usable_area = payload.gross_roof_area_sqm * USABILITY_FACTOR
    breakdown = [
        CostLineItem(
            component="catchment_and_installation",
            amount_inr=round(usable_area * payload.capex_rate_per_sqm, 2),
            quantity=round(usable_area, 2),
            unit="usable m²",
            unit_cost_inr=payload.capex_rate_per_sqm,
            assumption_source="Existing Map Studio planning rate; editable; no verified date or geographic basis",
        )
    ]

    if payload.configuration in ("storage_only", "hybrid"):
        breakdown.append(
            CostLineItem(
                component="storage_tank",
                amount_inr=round(payload.tank_capacity_litres * payload.tank_cost_per_litre, 2),
                quantity=payload.tank_capacity_litres,
                unit="litre",
                unit_cost_inr=payload.tank_cost_per_litre,
                assumption_source="Existing tank-sizer planning rate; editable; no verified date or geographic basis",
            )
        )

    missing_costs = []
    if payload.configuration in ("recharge_only", "hybrid"):
        if payload.recharge_connection_cost_inr is None:
            breakdown.append(
                CostLineItem(
                    component="recharge_connection",
                    amount_inr=None,
                    quantity=1,
                    unit="system",
                    unit_cost_inr=None,
                    assumption_source="Missing; provide a site-specific quotation",
                )
            )
            missing_costs.append("recharge connection quotation")
        else:
            breakdown.append(
                CostLineItem(
                    component="recharge_connection",
                    amount_inr=payload.recharge_connection_cost_inr,
                    quantity=1,
                    unit="system",
                    unit_cost_inr=payload.recharge_connection_cost_inr,
                    assumption_source="User-provided quotation",
                )
            )

    subtotal = round(sum(item.amount_inr or 0 for item in breakdown), 2)
    capex_complete = not missing_costs
    total_capex = subtotal if capex_complete else None
    opex_breakdown: list[CostLineItem] = []
    annual_opex = None
    if total_capex is not None:
        maintenance = total_capex * payload.annual_maintenance_rate
        annual_opex = round(maintenance + payload.fixed_annual_opex_inr, 2)
        opex_breakdown = [
            CostLineItem(
                component="annual_maintenance",
                amount_inr=round(maintenance, 2),
                quantity=round(total_capex, 2),
                unit="CAPEX/year",
                unit_cost_inr=payload.annual_maintenance_rate,
                assumption_source="Existing ROI planning rate; editable; no vendor validation",
            ),
            CostLineItem(
                component="fixed_annual_opex",
                amount_inr=payload.fixed_annual_opex_inr,
                quantity=1,
                unit="year",
                unit_cost_inr=payload.fixed_annual_opex_inr,
                assumption_source="User-provided annual estimate",
            ),
        ]
    if missing_costs:
        assumptions.append("Annual OPEX and payback are withheld until all required CAPEX quotations are supplied.")

    return CostEstimateResponse(
        configuration=payload.configuration,
        capex_breakdown=breakdown,
        capex_subtotal_inr=subtotal,
        total_capex_inr=total_capex,
        capex_complete=capex_complete,
        annual_opex_breakdown=opex_breakdown,
        annual_opex_inr=annual_opex,
        assumptions=assumptions,
        source="derived_from_assumption",
    )
