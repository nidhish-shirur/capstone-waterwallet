from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import db_models, schemas
from models.constants import IS_LPCD
from services.demand_engine import calculate_demand

router = APIRouter()


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
def create_society(payload: schemas.SocietyCreate, db: Session = Depends(get_db)):
    db_society = db_models.Society(
        name=payload.name,
        pincode=payload.pincode,
        num_flats=payload.num_flats,
        occupants=payload.occupants,
        roof_surface_type=payload.roof_surface_type
    )
    db.add(db_society)
    db.commit()
    db.refresh(db_society)
    return db_society

@router.get("/{id}", response_model=schemas.SocietyDetailResponse)
def get_society(id: int, db: Session = Depends(get_db)):
    db_society = db.query(db_models.Society).filter(db_models.Society.id == id).first()
    if not db_society:
        raise HTTPException(status_code=404, detail="Society not found")
    return db_society

@router.put("/{id}", response_model=schemas.SocietyResponse)
def update_society(id: int, payload: schemas.SocietyUpdate, db: Session = Depends(get_db)):
    db_society = db.query(db_models.Society).filter(db_models.Society.id == id).first()
    if not db_society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_society, key, value)
        
    db.commit()
    db.refresh(db_society)
    return db_society

@router.post("/{id}/billing", response_model=list[schemas.BillingEntryResponse])
def save_billing_entries(id: int, payload: list[schemas.BillingEntryCreate], db: Session = Depends(get_db)):
    db_society = db.query(db_models.Society).filter(db_models.Society.id == id).first()
    if not db_society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    # Replace existing entries for clean save/overwrite
    db.query(db_models.BillingEntry).filter(db_models.BillingEntry.society_id == id).delete()
    
    db_entries = []
    for entry in payload:
        db_entry = db_models.BillingEntry(
            society_id=id,
            month=entry.month,
            year=entry.year,
            municipal_bill=entry.municipal_bill,
            tankers=entry.tankers,
            cost_per_tanker=entry.cost_per_tanker,
            tanker_capacity_l=entry.tanker_capacity_l
        )
        db.add(db_entry)
        db_entries.append(db_entry)
        
    db.commit()
    for entry in db_entries:
        db.refresh(entry)
    return db_entries

@router.post("/{id}/analyses", response_model=schemas.SocietyAnalysisResponse, status_code=status.HTTP_201_CREATED)
def save_society_analysis(id: int, payload: schemas.SocietyAnalysisCreate, db: Session = Depends(get_db)):
    db_society = db.query(db_models.Society).filter(db_models.Society.id == id).first()
    if not db_society:
        raise HTTPException(status_code=404, detail="Society not found")
        
    db_analysis = db_models.SocietyAnalysis(
        society_id=id,
        estimated_capex=payload.estimated_capex,
        annual_yield_l=payload.annual_yield_l,
        annual_demand_l=payload.annual_demand_l,
        computed_data=payload.computed_data
    )
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)
    return db_analysis
