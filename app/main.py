"""
app/main.py — OpRail FastAPI application entry point
SIH 2026 | PS-26027 | Ministry of Railways
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.database import create_all_tables
from app.api.routes import tasks, plan, dashboard, tms, smms, tdms, coa, visualization


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup (idempotent — safe to call every time)."""
    import app.models  # noqa — registers all ORM models with Base
    create_all_tables()
    yield


app = FastAPI(
    title="OpRail — AI-Powered Automatic Block Planning System",
    description=(
        "SIH 2026 · Problem Statement 26027 · Ministry of Railways\n\n"
        "Integrates TMS / SMMS / TDMS maintenance data with COA train timetable "
        "to generate optimized, multi-department maintenance block schedules using "
        "ML priority scoring (XGBoost) and constraint optimization (OR-Tools CP-SAT)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React frontend (any origin in dev; tighten in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Source system mock APIs ────────────────────────────────────────────────
app.include_router(tms.router,   prefix="/api/tms",   tags=["TMS — Engineering"])
app.include_router(smms.router,  prefix="/api/smms",  tags=["SMMS — S&T"])
app.include_router(tdms.router,  prefix="/api/tdms",  tags=["TDMS — Traction/OHE"])
app.include_router(coa.router,   prefix="/api/coa",   tags=["COA — Train Schedule"])

# ── Core planning APIs ─────────────────────────────────────────────────────
app.include_router(tasks.router,     prefix="/api/tasks",     tags=["Maintenance Tasks"])
app.include_router(plan.router,      prefix="/api/plan",      tags=["Block Planning"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(visualization.router, prefix="/api/visualization", tags=["Visualization"])


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "OpRail", "version": "1.0.0"}


# Mount static directory for JS/CSS assets
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", tags=["Dashboard"])
def serve_dashboard():
    """Serve the main frontend dashboard."""
    return FileResponse("static/index.html")
