from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from database import get_db
from models import db_models
# from dependencies import get_current_user
# from models import db_models
from models import schemas
from models.constants import IS_LPCD
from services.demand_engine import calculate_demand

router = APIRouter()

# In-memory store while DB is offline
_societies: dict = {}
_next_id: int = 1


@router.post("/baseline", response_model=schemas.SocietyBaselineResponse)
def society_baseline(payload: schemas.SocietyBaselineRequest) -> schemas.SocietyBaselineResponse:
    """
    Calculate daily water demand for a housing society using IS 1172.

    Delegates entirely to services.demand_engine.calculate_demand so that
    the demand formula lives in exactly one place.

    - Uses 135 LPCD as the baseline (overridable via lpcd_override)
    - Adds a 10 % peak-demand buffer (DEMAND_BUFFER_FACTOR in constants)
    """
    # Use explicit None check — a zero override is technically valid (edge-case)
    # and a truthiness check would silently fall back to IS_LPCD for it.
    lpcd = payload.lpcd_override if payload.lpcd_override is not None else IS_LPCD

    result = calculate_demand(
        num_flats=payload.num_flats,
        occupants_per_flat=payload.occupants_per_flat,
        lpcd=lpcd,
        include_losses=payload.include_losses,
    )
    return schemas.SocietyBaselineResponse(**result)


@router.post("/", response_model=schemas.SocietyResponse, status_code=status.HTTP_201_CREATED)
def create_society(payload: schemas.SocietyCreate):
    # AUTH + DB TEMPORARILY DISABLED — using in-memory store
    global _next_id
    society = {"id": _next_id, "name": payload.name, "pincode": payload.pincode,
                "num_flats": payload.num_flats, "occupants": payload.occupants,
                "roof_surface_type": payload.roof_surface_type, "user_id": 0,
                "created_at": datetime.now(timezone.utc)}
    _societies[_next_id] = society
    _next_id += 1
    return society

@router.get("/", response_model=list[schemas.SocietyResponse])
def list_societies():
    # AUTH + DB TEMPORARILY DISABLED
    return list(_societies.values())


@router.get("/database", response_model=list[schemas.SocietyResponse])
def list_societies_from_database(db: Session = Depends(get_db)):
    """Return societies persisted in PostgreSQL for the temporary Phase 1 loader."""
    return (
        db.query(db_models.Society)
        .order_by(db_models.Society.id.asc())
        .all()
    )


@router.get("/{id}", response_model=schemas.SocietyDetailResponse)
def get_society(id: int):
    # AUTH + DB TEMPORARILY DISABLED
    if id not in _societies:
        raise HTTPException(status_code=404, detail="Society not found")
    return {**_societies[id], "billing_entries": [], "analyses": []}


@router.get("/{id}/database", response_model=schemas.SocietyDetailResponse)
def get_society_from_database(id: int, db: Session = Depends(get_db)):
    """
    Temporary read-only Phase 1 loader for data already stored in PostgreSQL.

    The normal CRUD routes still use the temporary in-memory store. This
    endpoint deliberately reads the persisted society and its historical
    billing entries without changing that behavior.
    """
    society = (
        db.query(db_models.Society)
        .filter(db_models.Society.id == id)
        .first()
    )
    if society is None:
        raise HTTPException(status_code=404, detail="Society not found in database")
    return society


@router.get("/{id}/billing", response_model=list[schemas.BillingEntryResponse])
def get_billing_entries_from_database(id: int, db: Session = Depends(get_db)):
    """Return historical billing rows for a society from the database."""
    society_exists = (
        db.query(db_models.Society.id)
        .filter(db_models.Society.id == id)
        .first()
    )
    if society_exists is None:
        raise HTTPException(status_code=404, detail="Society not found in database")

    return (
        db.query(db_models.BillingEntry)
        .filter(db_models.BillingEntry.society_id == id)
        .order_by(
            db_models.BillingEntry.year.asc(),
            db_models.BillingEntry.month.asc(),
            db_models.BillingEntry.id.asc(),
        )
        .all()
    )


@router.put("/{id}", response_model=schemas.SocietyResponse)
def update_society(id: int, payload: schemas.SocietyUpdate):
    # AUTH + DB TEMPORARILY DISABLED
    if id not in _societies:
        raise HTTPException(status_code=404, detail="Society not found")
    update_data = payload.model_dump(exclude_unset=True)
    _societies[id].update(update_data)
    return _societies[id]

@router.post("/{id}/billing", response_model=list[schemas.BillingEntryResponse])
def save_billing_entries(id: int, payload: list[schemas.BillingEntryCreate]):
    # AUTH + DB TEMPORARILY DISABLED — return echo of submitted entries
    if id not in _societies:
        raise HTTPException(status_code=404, detail="Society not found")
    return [{"id": i+1, "society_id": id, **e.model_dump()} for i, e in enumerate(payload)]

@router.post("/{id}/analyses", response_model=schemas.SocietyAnalysisResponse, status_code=status.HTTP_201_CREATED)
def save_society_analysis(id: int, payload: schemas.SocietyAnalysisCreate):
    # AUTH + DB TEMPORARILY DISABLED — return echo
    if id not in _societies:
        raise HTTPException(status_code=404, detail="Society not found")
    return {"id": 1, "society_id": id, **payload.model_dump(),
            "created_at": datetime.now(timezone.utc)}
