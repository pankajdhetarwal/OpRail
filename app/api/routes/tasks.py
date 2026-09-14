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
from app.services.priority_engine import compute_priority_score

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
    """Recompute priority scores for all tasks using the priority engine."""
    tasks = db.query(MaintenanceTask).options(joinedload(MaintenanceTask.section)).all()
    updated = 0
    for task in tasks:
        score = compute_priority_score(
            severity=task.severity,
            days_overdue=task.days_overdue,
            train_density=task.section.train_density if task.section else 0.5,
        )
        task.priority_score = score
        updated += 1
    db.commit()
    return {"updated": updated, "message": "Priority scores recomputed successfully"}
