"""
app/api/routes/smms.py — Mock SMMS (Signalling Maintenance & Management System) API
Simulates the S&T department's data source.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.maintenance_task import MaintenanceTask
from app.models.department import Department
from app.schemas.maintenance_task import MaintenanceTaskList

router = APIRouter()


@router.get("/tasks", response_model=MaintenanceTaskList, summary="SMMS: S&T maintenance tasks")
def get_smms_tasks(
    min_severity: int = Query(1, ge=1, le=5),
    critical_only: bool = Query(False),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    """Fetch S&T department tasks — simulates SMMS API response."""
    query = (
        db.query(MaintenanceTask)
        .options(joinedload(MaintenanceTask.department), joinedload(MaintenanceTask.section))
        .join(Department)
        .filter(Department.code == "ST", MaintenanceTask.severity >= min_severity)
    )
    if critical_only:
        query = query.filter(MaintenanceTask.safety_critical == True)
    total = query.count()
    tasks = query.order_by(MaintenanceTask.priority_score.desc()).limit(limit).all()
    return MaintenanceTaskList(total=total, tasks=tasks)
