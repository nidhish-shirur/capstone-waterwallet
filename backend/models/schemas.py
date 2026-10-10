from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal, Optional


# ---------------------------------------------------------------------------
# Society / Demand
# ---------------------------------------------------------------------------
class SocietyBaselineRequest(BaseModel):
    num_flats: int = Field(..., gt=0, description="Total number of flats in the society")
    occupants_per_flat: float = Field(default=3.5, gt=0)
    lpcd_override: Optional[float] = Field(default=None, gt=0, le=1000, description="Override IS 1172 LPCD value")
    include_losses: bool = Field(default=True)

class SocietyBaselineResponse(BaseModel):
    total_occupants: int
    base_demand_lpd: float
    daily_demand_lpd: float
    daily_demand_with_buffer_lpd: float


# ---------------------------------------------------------------------------
# Geospatial / Catchment
# ---------------------------------------------------------------------------
class CatchmentRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    roof_area_sqm: float = Field(..., gt=0, description="Usable roof catchment area in m²")
    roof_surface_type: Optional[str] = Field(default="concrete", description="Type of roof surface")

class CatchmentResponse(BaseModel):
    annual_rainfall_mm: float
    monthly_rainfall_mm: list[float]
    annual_yield_litres: float
    monthly_yield_litres: list[float]

class RainfallForecastRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    roof_area_sqm: float = Field(..., gt=0)
    roof_surface_type: Optional[str] = Field(default="concrete")
    periods: int = Field(default=12, ge=1, le=24)

class RainfallForecastResponse(BaseModel):
    annual_rainfall_mm: float
    monthly_rainfall_mm: list[float]
    annual_yield_litres: float
    monthly_yield_litres: list[float]
    source: str
    model_order: dict
    training_months: int
    confidence_intervals: list[dict[str, float]]


# ---------------------------------------------------------------------------
# ROI
# ---------------------------------------------------------------------------
class ROIRequest(BaseModel):
    daily_demand_lpd: float = Field(..., gt=0, description="Daily water demand in litres")
    annual_yield_litres: float = Field(..., gt=0, description="Harvestable water per year in litres")
    tank_capacity_litres: float = Field(default=50000, gt=0, description="Tank capacity in litres; annual yield is demand-gated and may refill during the year")
    water_tariff_per_kl: float = Field(
        default=15.0,
        description="Municipal water cost ₹/kL — must be > 0 (zero tariff produces zero savings and a divide-by-zero in payback interpolation)",
    )
    tariff_escalation_rate: float = Field(default=0.0, ge=0.0, description="Annual municipal tariff escalation rate (e.g. 0.05 for 5%)")
    installation_cost: float = Field(default=250000, ge=0, description="One-time capex in ₹")
    years: Literal[10] = Field(default=10, description="Fixed 10-year ROI horizon")
    annual_tanker_spend: float = Field(default=200000.0, ge=0.0, description="Annual spend on tanker water in ₹")
    annual_tanker_volume_litres: float = Field(default=1333333.3, ge=0.0, description="Annual tanker volume in litres")
    annual_municipal_spend: float = Field(default=46000.0, ge=0.0, description="Annual municipal water bill in ₹")

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
    # Cumulative expenditure trajectories for the break-even chart
    cumulative_without_rwh: float   # total ₹ spent if RWH was never installed
    cumulative_with_rwh: float      # total ₹ spent (capex + opex + bills) with RWH

class ROIResponse(BaseModel):
    payback_years: Optional[float]
    total_period_savings: float
    ten_year_savings: float
    yearly_breakdown: list[YearlyROI]


# ---------------------------------------------------------------------------
# Monte Carlo ROI
# ---------------------------------------------------------------------------
class MonteCarloRequest(BaseModel):
    rooftop_area_m2: float = Field(..., gt=0, description="Usable rooftop area in m²")
    monthly_demand_kl: float = Field(..., gt=0, description="Monthly demand cap in KL")
    capex_inr: float = Field(..., gt=0, description="One-time installation cost in INR")
    tank_capacity_litres: float = Field(default=50000, gt=0, description="Tank capacity used to cap annual usable yield")
    rainfall_reduction_percent: float = Field(default=0, ge=0, le=50, description="Scenario reduction applied to sampled rainfall")
    tanker_rate_per_kl: float = Field(default=800.0, gt=0, description="Tanker water cost in INR/KL")
    annual_tanker_volume_litres: float = Field(default=0, ge=0, description="Annual tanker water volume used before municipal water")
    water_tariff_per_kl: float = Field(default=15.0, gt=0, description="Municipal water tariff in INR/KL")
    inflation_rate: float = Field(default=0.08, ge=0, le=0.5, description="Annual tanker price inflation")
    n_scenarios: int = Field(default=1000, ge=100, le=5000, description="Number of Monte Carlo samples")

class MonteCarloResponse(BaseModel):
    median_breakeven_year: Optional[int]
    mean_breakeven_year: Optional[float]
    prob_breakeven_by_year: dict  # {"1": 0.02, "2": 0.45, ...}
    percentiles: dict             # {"p10": int, "p50": int, "p90": int}
    n_scenarios: int
    never_break_even_pct: float
    scenarios_used: str
    is_site_specific: bool


class TankSizerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    gross_roof_area_sqm: float = Field(..., gt=0)
    roof_surface_type: str = Field(default="concrete")
    daily_demand_litres: float = Field(
        ...,
        gt=0,
        description=(
            "Eligible daily non-potable demand in litres (such as flushing "
            "and gardening), not total society or IS 1172 demand."
        ),
    )
    candidate_capacities_litres: list[float] = Field(
        default=[0, 10000, 20000, 30000, 50000, 75000, 100000, 150000],
        min_length=1,
    )
    tanker_rate_per_litre: float = Field(default=0.8, ge=0)
    tank_cost_per_litre: float = Field(
        default=4.0,
        gt=0,
        description="Storage vessel material cost per litre; scales with candidate capacity.",
    )
    fixed_system_cost: float = Field(
        default=7200,
        ge=0,
        description="Shared collection chamber, first-flush, filter, piping, and installation cost.",
    )
    first_flush_fraction: float = Field(default=0.05, ge=0, lt=1)
    reliability_target_percent: float = Field(default=80, gt=0, le=100)
    recharge_enabled: bool = False

    @field_validator("candidate_capacities_litres")
    @classmethod
    def validate_candidate_capacities(cls, values: list[float]) -> list[float]:
        if any(capacity < 0 for capacity in values):
            raise ValueError("Tank capacities cannot be negative.")
        return sorted(set(values))


class TankSizerResponse(BaseModel):
    selected_candidate: dict
    reliability_target_met: bool
    selection_reason: str
    selection_status: str
    reliability_target_percent: float
    candidates: list[dict]
    years_used: list[int]
    source: str
    fallback_used: bool


# ---------------------------------------------------------------------------
# ML Recommend
# ---------------------------------------------------------------------------
class MLRecommendRequest(BaseModel):
    rooftop_area: float = Field(..., gt=0, description="Rooftop area in m²")
    borewell: int = Field(..., ge=0, le=1, description="1 if borewell exists, 0 otherwise")
    borewell_depth: float = Field(default=0.0, ge=0, description="Borewell depth in metres")
    soil_perm: int = Field(..., ge=1, le=5, description="Soil permeability class (1=very low, 5=very high)")
    coastal_km: float = Field(..., gt=0, description="Distance from coast in km")
    annual_rain_mm: float = Field(..., gt=0, description="Annual rainfall in mm")
    peak_day_mm: float = Field(..., gt=0, description="Peak single-day rainfall in mm")

class SHAPValue(BaseModel):
    feature: str
    value: float
    shap: float

class MLRecommendResponse(BaseModel):
    config: str                     # "Storage-Only" | "Borewell-Recharge" | "Hybrid"
    confidence: float               # 0–1 probability
    source: str                     # "rf_classifier" | "tier1_safety_gate"
    safety_triggered: bool
    safety_reason: Optional[str]
    shap_values: list[SHAPValue]
    plain_language: str
    shap_available: bool = True
    explanation_warning: Optional[str] = None


# ---------------------------------------------------------------------------
# LLM Advisory
# ---------------------------------------------------------------------------
class WaterAdvisoryRequest(BaseModel):
    focus: str = Field(default="overall decision", max_length=80)
    society_name: str = Field(default="Society", max_length=120)
    flats: int = Field(..., gt=0, le=100000)
    occupants_per_flat: float = Field(..., gt=0, le=100)
    annual_demand_litres: float = Field(..., gt=0)
    annual_yield_litres: float = Field(..., ge=0)
    estimated_capex_inr: float = Field(..., ge=0)
    current_annual_water_cost_inr: float = Field(..., ge=0)
    payback_years: str = Field(..., max_length=40)
    self_sufficiency_percent: float = Field(..., ge=0, le=100)
    recommended_configuration: str = Field(default="Pending", max_length=80)
    monte_carlo_median_breakeven_year: float | None = Field(default=None, ge=0)
    monte_carlo_never_break_even_percent: float | None = Field(default=None, ge=0, le=100)


class WaterAdvisoryResponse(BaseModel):
    summary: str
    recommendations: list[str]
    risks: list[str]
    assumptions: list[str]
# ---------------------------------------------------------------------------
# ML Yield
# ---------------------------------------------------------------------------
class MLYieldRequest(BaseModel):
    rooftop_area_m2: float = Field(..., gt=0, description="Rooftop area in m²")
    monthly_rainfall_mm: list[float] = Field(
        ..., min_length=12, max_length=12,
        description="List of 12 monthly rainfall values in mm"
    )

class MLYieldResponse(BaseModel):
    monthly_yield_kl: list[float]   # 12 values
    annual_yield_kl: float
    source: str                     # "rf_regressor" | "physics_formula"
    physics_annual_yield_kl: float
    ml_deviation_percent: Optional[float] = None


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
class ReportRequest(BaseModel):
    society_data: SocietyBaselineResponse
    catchment_data: CatchmentResponse
    roi_data: ROIResponse
    society_name: Optional[str] = "Society"


# ---------------------------------------------------------------------------
# Database CRUD Schemas
# ---------------------------------------------------------------------------
from datetime import datetime

class SocietyCreate(BaseModel):
    name: str = Field(..., description="Name of the society")
    pincode: str = Field(..., description="Pincode of the society")
    num_flats: int = Field(..., gt=0, description="Total number of flats")
    occupants: float = Field(default=3.5, gt=0)
    roof_surface_type: Optional[str] = Field(default=None, description="Type of roof surface")

class SocietyResponse(BaseModel):
    id: int
    name: str
    pincode: str
    num_flats: int
    occupants: float
    roof_surface_type: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}

class BillingEntryCreate(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=1900, le=2100)
    municipal_bill: Optional[float] = Field(default=None, ge=0)
    tankers: Optional[int] = Field(default=None, ge=0)
    cost_per_tanker: Optional[float] = Field(default=None, ge=0)
    tanker_capacity_l: Optional[float] = Field(default=None, gt=0)

class BillingEntryResponse(BaseModel):
    id: int
    society_id: int
    month: int
    year: int
    municipal_bill: Optional[float]
    tankers: Optional[int]
    cost_per_tanker: Optional[float]
    tanker_capacity_l: Optional[float]

    model_config = {"from_attributes": True}

class SocietyDetailResponse(BaseModel):
    id: int
    name: str
    pincode: str
    num_flats: int
    occupants: float
    roof_surface_type: Optional[str]
    created_at: datetime
    billing_entries: list[BillingEntryResponse]

    model_config = {"from_attributes": True}

class SocietyUpdate(BaseModel):
    name: Optional[str] = None
    pincode: Optional[str] = None
    num_flats: Optional[int] = Field(default=None, gt=0)
    occupants: Optional[float] = Field(default=None, gt=0)
    roof_surface_type: Optional[str] = None

class SocietyAnalysisCreate(BaseModel):
    estimated_capex: Optional[float] = None
    annual_yield_l: Optional[float] = None
    annual_demand_l: Optional[float] = None
    computed_data: Optional[dict] = None

class SocietyAnalysisResponse(BaseModel):
    id: int
    society_id: int
    estimated_capex: Optional[float]
    annual_yield_l: Optional[float]
    annual_demand_l: Optional[float]
    computed_data: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Authentication Schemas
# ---------------------------------------------------------------------------

class UserRegister(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password — minimum 6 characters")

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
