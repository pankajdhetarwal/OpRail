"""
app/api/routes/tdms.py — Mock TDMS (Traction Distribution Management System) API
Simulates the OHE/Traction department's data source.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.maintenance_task import MaintenanceTask, TaskStatus, TaskType
from app.models.department import Department
from app.models.railway_section import RailwaySection
from app.schemas.maintenance_task import MaintenanceTaskList
from app.services.priority_engine_v2 import compute_priority_score_v2
import random
from datetime import date

router = APIRouter()


@router.get("/tasks", response_model=MaintenanceTaskList, summary="TDMS: Traction/OHE maintenance tasks")
def get_tdms_tasks(
    min_severity: int = Query(1, ge=1, le=5),
    ohe_disconnection_only: bool = Query(False),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    """Fetch Traction/OHE department tasks — simulates TDMS API response."""
    query = (
        db.query(MaintenanceTask)
        .options(joinedload(MaintenanceTask.department), joinedload(MaintenanceTask.section))
        .join(Department)
        .filter(Department.code == "OHE", MaintenanceTask.severity >= min_severity)
    )
    if ohe_disconnection_only:
        query = query.filter(MaintenanceTask.requires_ohe_disconnection == True)
    total = query.count()
    tasks = query.order_by(MaintenanceTask.priority_score.desc()).limit(limit).all()
    return MaintenanceTaskList(total=total, tasks=tasks)


@router.post("/simulate-fault", summary="TDMS: Simulate an incoming OHE live fault")
def simulate_fault(db: Session = Depends(get_db)):
    """
    Simulates an IoT sensor detecting an emergency OHE failure.
    Creates a CRITICAL task and automatically scores it via XGBoost.
    """
    # 1. Get OHE department and a random section
    ohe_dept = db.query(Department).filter(Department.code == "OHE").first()
    sections = db.query(RailwaySection).all()
    if not ohe_dept or not sections:
        return {"error": "Database not seeded properly."}
    
    section = random.choice(sections)
    
    # 2. Construct critical task
    task = MaintenanceTask(
        task_code=f"IOT_{random.randint(1000, 9999)}",
        dept_id=ohe_dept.id,
        section_id=section.id,
        task_type=TaskType.OVERHEAD_WIRE_MAINTENANCE,
        description="LIVE SENSOR: OHE Cantilever snapped, urgent repair needed.",
        severity=5,
        days_overdue=0, # It's a fresh emergency, but severity is 5
        duration_minutes=90,
        due_date=date.today(),
        safety_critical=True,
        requires_line_block=True,
        requires_ohe_disconnection=True,
        status=TaskStatus.PENDING,
    )
    
    # 3. Score via AI
    task.priority_score = compute_priority_score_v2(
        severity=task.severity,
        days_overdue=task.days_overdue,
        train_density=section.train_density,
        asset_criticality=section.criticality_level,
        is_safety_critical=True,
        requires_ohe_disconnection=True,
        duration_minutes=task.duration_minutes
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    return {
        "message": "Live sensor anomaly detected!",
        "task_code": task.task_code,
        "section": section.name,
        "ai_priority_score": task.priority_score
    }
