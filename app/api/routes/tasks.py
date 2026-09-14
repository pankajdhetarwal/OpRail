"""
app/api/routes/tasks.py
Combined maintenance tasks endpoint — aggregates TMS + SMMS + TDMS data.
Supports filtering by dept, section, severity, status.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.maintenance_task import MaintenanceTask, TaskStatus
from app.schemas.maintenance_task import MaintenanceTaskList, MaintenanceTaskOut
from app.services.priority_engine_v2 import compute_priority_score_v2, get_shap_explanation

router = APIRouter()


@router.get("/", response_model=MaintenanceTaskList)
def get_all_tasks(
    dept_code: Optional[str] = Query(None, description="ENG, ST, or OHE"),
    section_id: Optional[int] = Query(None),
    min_severity: int = Query(1, ge=1, le=5),
    status: Optional[str] = Query(None),
    critical_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    query = (
        db.query(MaintenanceTask)
        .options(joinedload(MaintenanceTask.department), joinedload(MaintenanceTask.section))
    )

    if dept_code:
        from app.models.department import Department
        query = query.join(Department).filter(Department.code == dept_code.upper())

    if section_id:
        query = query.filter(MaintenanceTask.section_id == section_id)

    if min_severity > 1:
        query = query.filter(MaintenanceTask.severity >= min_severity)

    if status:
        query = query.filter(MaintenanceTask.status == status)

    if critical_only:
        query = query.filter(MaintenanceTask.safety_critical == True)

    total = query.count()
    tasks = query.order_by(MaintenanceTask.priority_score.desc()).offset(skip).limit(limit).all()

    return MaintenanceTaskList(total=total, tasks=tasks)


@router.get("/{task_id}", response_model=MaintenanceTaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    task = (
        db.query(MaintenanceTask)
        .options(joinedload(MaintenanceTask.department), joinedload(MaintenanceTask.section))
        .filter(MaintenanceTask.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/score-all")
def score_all_tasks(db: Session = Depends(get_db)):
    """Recompute priority scores for all tasks using the V2 XGBoost priority engine."""
    tasks = db.query(MaintenanceTask).options(joinedload(MaintenanceTask.section)).all()
    updated = 0
    for task in tasks:
        score = compute_priority_score_v2(
            severity=task.severity,
            days_overdue=task.days_overdue,
            train_density=task.section.train_density if task.section else 0.5,
            asset_criticality=task.section.criticality_level if task.section else 3,
            is_safety_critical=task.safety_critical,
            requires_ohe_disconnection=task.requires_ohe_disconnection,
            duration_minutes=task.duration_minutes,
        )
        task.priority_score = score
        updated += 1
    db.commit()
    return {"updated": updated, "message": "Priority scores recomputed using XGBoost V2 engine"}


@router.get("/explain/{task_id}")
def explain_task_priority(task_id: int, db: Session = Depends(get_db)):
    """
    Return a SHAP-based explanation of why a task has its priority score.
    Used by the 'Why this priority?' panel in the frontend.
    """
    from fastapi import HTTPException
    task = (
        db.query(MaintenanceTask)
        .options(joinedload(MaintenanceTask.section), joinedload(MaintenanceTask.department))
        .filter(MaintenanceTask.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    shap_data = get_shap_explanation(
        severity=task.severity,
        days_overdue=task.days_overdue,
        train_density=task.section.train_density if task.section else 0.5,
        asset_criticality=task.section.criticality_level if task.section else 3,
        is_safety_critical=task.safety_critical,
        requires_ohe_disconnection=task.requires_ohe_disconnection,
        duration_minutes=task.duration_minutes,
    )

    return {
        "task_id": task_id,
        "task_code": task.task_code,
        "priority_score": task.priority_score,
        "section": task.section.name if task.section else None,
        "department": task.department.name if task.department else None,
        "shap_explanation": shap_data,
    }
