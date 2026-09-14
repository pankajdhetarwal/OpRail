"""
app/api/routes/tms.py — Mock TMS (Track Management System) API
Simulates the Engineering department's data source.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.core.database import get_db
from app.models.maintenance_task import MaintenanceTask
from app.models.department import Department
from app.schemas.maintenance_task import MaintenanceTaskList

router = APIRouter()


@router.get("/tasks", response_model=MaintenanceTaskList, summary="TMS: Engineering maintenance tasks")
def get_tms_tasks(
    min_severity: int = Query(1, ge=1, le=5),
    critical_only: bool = Query(False),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    """Fetch Engineering department tasks — simulates TMS API response."""
    query = (
        db.query(MaintenanceTask)
        .options(joinedload(MaintenanceTask.department), joinedload(MaintenanceTask.section))
        .join(Department)
        .filter(Department.code == "ENG", MaintenanceTask.severity >= min_severity)
    )
    if critical_only:
        query = query.filter(MaintenanceTask.safety_critical == True)
    total = query.count()
    tasks = query.order_by(MaintenanceTask.priority_score.desc()).limit(limit).all()
    return MaintenanceTaskList(total=total, tasks=tasks)
