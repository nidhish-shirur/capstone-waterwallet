from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import society, geospatial, roi, report

app = FastAPI(
    title="WaterWallet API",
    description="Backend engine for rainwater harvesting demand, yield, ROI, and report generation.",
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
app.include_router(society.router,    prefix="/api/society",    tags=["Society"])
app.include_router(geospatial.router, prefix="/api/catchment",  tags=["Geospatial"])
app.include_router(roi.router,        prefix="/api/roi",         tags=["ROI"])
app.include_router(report.router,     prefix="/api/report",      tags=["Report"])


@app.get("/")
def health_check():
    return {"status": "ok", "service": "WaterWallet API"}
