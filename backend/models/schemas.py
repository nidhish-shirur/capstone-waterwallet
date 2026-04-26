from pydantic import BaseModel, Field, field_validator
from typing import Optional


# ---------------------------------------------------------------------------
# Society / Demand
# ---------------------------------------------------------------------------
class SocietyBaselineRequest(BaseModel):
    num_flats: int = Field(..., gt=0, description="Total number of flats in the society")
    occupants_per_flat: float = Field(default=3.5, gt=0)
    lpcd_override: Optional[float] = Field(default=None, gt=0, le=1000, description="Override IS 1172 LPCD value")

class SocietyBaselineResponse(BaseModel):
    total_occupants: int
    daily_demand_lpd: float
    daily_demand_with_buffer_lpd: float


# ---------------------------------------------------------------------------
# Geospatial / Catchment
# ---------------------------------------------------------------------------
class CatchmentRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    roof_area_sqm: float = Field(..., gt=0, description="Usable roof catchment area in m²")

class CatchmentResponse(BaseModel):
    annual_rainfall_mm: float
    monthly_rainfall_mm: list[float]
    annual_yield_litres: float
    monthly_yield_litres: list[float]


# ---------------------------------------------------------------------------
# ROI
# ---------------------------------------------------------------------------
class ROIRequest(BaseModel):
    daily_demand_lpd: float = Field(..., gt=0, description="Daily water demand in litres")
    annual_yield_litres: float = Field(..., gt=0, description="Harvestable water per year in litres")
    tank_capacity_litres: float = Field(default=50000, gt=0, description="Tank capacity in litres to cap monthly yield utilization")
    water_tariff_per_kl: float = Field(
        default=15.0,
        description="Municipal water cost ₹/kL — must be > 0 (zero tariff produces zero savings and a divide-by-zero in payback interpolation)",
    )
    tariff_escalation_rate: float = Field(default=0.0, ge=0.0, description="Annual municipal tariff escalation rate (e.g. 0.05 for 5%)")
    installation_cost: float = Field(default=250000, ge=0, description="One-time capex in ₹")
    years: int = Field(default=10, ge=1, le=30)

    @field_validator("water_tariff_per_kl")
    @classmethod
    def tariff_must_be_positive(cls, v: float) -> float:
        """Reject zero or negative tariff — zero savings ⟹ annual_savings == 0
        ⟹ division-by-zero when interpolating the payback break-even point."""
        if v <= 0:
            raise ValueError(
                "water_tariff_per_kl must be greater than 0. "
                "A zero tariff produces zero annual savings, which causes a "
                "division-by-zero when computing the payback break-even year."
            )
        return v

class YearlyROI(BaseModel):
    year: int
    savings: float
    cumulative_savings: float
    net_benefit: float

class ROIResponse(BaseModel):
    payback_years: Optional[float]
    total_period_savings: float
    ten_year_savings: float
    yearly_breakdown: list[YearlyROI]


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
class ReportRequest(BaseModel):
    society_data: SocietyBaselineResponse
    catchment_data: CatchmentResponse
    roi_data: ROIResponse
    society_name: Optional[str] = "Society"
