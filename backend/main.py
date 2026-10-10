from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import advisory, geospatial, roi, societies, ml_recommend, ml_yield
# AUTH TEMPORARILY DISABLED — uncomment when DB is fixed:
# from routers import auth

app = FastAPI(
    title="WaterWallet API",
    description="Backend engine for rainwater harvesting demand, yield, and ROI calculations.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow the Vite dev server (port 5173) and production origin
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
# AUTH TEMPORARILY DISABLED
# app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(societies.router,    prefix="/api/societies",  tags=["Societies"])
app.include_router(geospatial.router,   prefix="/api/catchment",  tags=["Geospatial"])
app.include_router(roi.router,          prefix="/api/roi",         tags=["ROI"])
app.include_router(ml_recommend.router, prefix="/api/ml",          tags=["ML — Recommend"])
app.include_router(ml_yield.router,     prefix="/api/ml",          tags=["ML — Yield"])
app.include_router(advisory.router,     prefix="/api/advisory",     tags=["AI Advisory"])


@app.get("/")
def health_check():
    return {"status": "ok", "service": "WaterWallet API"}
