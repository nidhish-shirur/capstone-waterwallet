from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload
from database import get_db
from models import db_models
from models import schemas
from models.constants import IS_LPCD
from services.demand_engine import calculate_demand
from dependencies import get_current_user

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
def create_society(
    payload: schemas.SocietyCreate,
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    society = db_models.Society(
        user_id=current_user.id,
        **payload.model_dump(),
    )
    try:
        db.add(society)
        db.commit()
        db.refresh(society)
        return society
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Society could not be saved.",
        ) from exc


@router.get("/", response_model=list[schemas.SocietyResponse])
def list_societies(
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    try:
        return (
            db.query(db_models.Society)
            .filter(db_models.Society.user_id == current_user.id)
            .order_by(db_models.Society.id.asc())
            .all()
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Societies could not be loaded.",
        ) from exc


@router.get("/database", response_model=list[schemas.SocietyResponse])
def list_societies_from_database(
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    """Compatibility endpoint for loading societies from the database."""
    try:
        return (
            db.query(db_models.Society)
            .filter(db_models.Society.user_id == current_user.id)
            .order_by(db_models.Society.id.asc())
            .all()
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database-backed society loading is unavailable.",
        ) from exc


@router.get("/{id}", response_model=schemas.SocietyDetailResponse)
def get_society(
    id: int,
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    return get_society_from_database(id, db, current_user)


@router.get("/{id}/database", response_model=schemas.SocietyDetailResponse)
def get_society_from_database(
    id: int,
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    """
    Compatibility endpoint for loading a society and its billing entries.
    """
    try:
        society = (
            db.query(db_models.Society)
            .options(selectinload(db_models.Society.billing_entries))
            .filter(
                db_models.Society.id == id,
                db_models.Society.user_id == current_user.id,
            )
            .first()
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Society could not be loaded.",
        ) from exc
    if society is None:
        raise HTTPException(status_code=404, detail="Society not found")
    return society


@router.get("/{id}/billing", response_model=list[schemas.BillingEntryResponse])
def get_billing_entries_from_database(
    id: int,
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    """Return historical billing rows for a society from the database."""
    try:
        society_exists = (
            db.query(db_models.Society.id)
            .filter(
                db_models.Society.id == id,
                db_models.Society.user_id == current_user.id,
            )
            .first()
        )
        if society_exists is None:
            raise HTTPException(status_code=404, detail="Society not found")

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
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing entries could not be loaded.",
        ) from exc


@router.get("/{id}/water-audit", response_model=schemas.WaterAuditResponse)
def get_water_audit(
    id: int,
    year: int | None = None,
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    try:
        society = (
            db.query(db_models.Society)
            .options(selectinload(db_models.Society.billing_entries))
            .filter(
                db_models.Society.id == id,
                db_models.Society.user_id == current_user.id,
            )
            .first()
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Water audit data could not be loaded.",
        ) from exc
    if society is None:
        raise HTTPException(status_code=404, detail="Society not found")

    from services.water_audit import build_water_audit

    return build_water_audit(society, year)


@router.put("/{id}", response_model=schemas.SocietyResponse)
def update_society(
    id: int,
    payload: schemas.SocietyUpdate,
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    try:
        society = (
            db.query(db_models.Society)
            .filter(
                db_models.Society.id == id,
                db_models.Society.user_id == current_user.id,
            )
            .first()
        )
        if society is None:
            raise HTTPException(status_code=404, detail="Society not found")

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(society, field, value)
        db.commit()
        db.refresh(society)
        return society
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Society could not be updated.",
        ) from exc


@router.post("/{id}/billing", response_model=list[schemas.BillingEntryResponse])
def save_billing_entries(
    id: int,
    payload: list[schemas.BillingEntryCreate],
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    try:
        society = (
            db.query(db_models.Society)
            .filter(
                db_models.Society.id == id,
                db_models.Society.user_id == current_user.id,
            )
            .first()
        )
        if society is None:
            raise HTTPException(status_code=404, detail="Society not found")

        db.query(db_models.BillingEntry).filter(
            db_models.BillingEntry.society_id == id
        ).delete(synchronize_session=False)
        entries = [
            db_models.BillingEntry(society_id=id, **entry.model_dump())
            for entry in payload
        ]
        db.add_all(entries)
        db.commit()
        for entry in entries:
            db.refresh(entry)
        return entries
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing entries could not be saved.",
        ) from exc


@router.post("/{id}/analyses", response_model=schemas.SocietyAnalysisResponse, status_code=status.HTTP_201_CREATED)
def save_society_analysis(
    id: int,
    payload: schemas.SocietyAnalysisCreate,
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    try:
        society = (
            db.query(db_models.Society)
            .filter(
                db_models.Society.id == id,
                db_models.Society.user_id == current_user.id,
            )
            .first()
        )
        if society is None:
            raise HTTPException(status_code=404, detail="Society not found")

        analysis = db_models.SocietyAnalysis(
            society_id=id,
            **payload.model_dump(),
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        return analysis
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Society analysis could not be saved.",
        ) from exc


@router.get("/{id}/analyses/latest", response_model=schemas.SocietyAnalysisResponse)
def get_latest_society_analysis(
    id: int,
    db: Session = Depends(get_db),
    current_user: db_models.User = Depends(get_current_user),
):
    try:
        society_exists = (
            db.query(db_models.Society.id)
            .filter(
                db_models.Society.id == id,
                db_models.Society.user_id == current_user.id,
            )
            .first()
        )
        if society_exists is None:
            raise HTTPException(status_code=404, detail="Society not found")

        analysis = (
            db.query(db_models.SocietyAnalysis)
            .filter(
                db_models.SocietyAnalysis.society_id == id,
            )
            .order_by(db_models.SocietyAnalysis.created_at.desc())
            .first()
        )
        if analysis is None:
            raise HTTPException(status_code=404, detail="Analysis not found")
        return analysis
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Society analysis could not be loaded.",
        ) from exc
