"""
app/api/routes/tdms.py — Mock TDMS (Traction Distribution Management System) API
Simulates the OHE/Traction department's data source.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.maintenance_task import MaintenanceTask
from app.models.department import Department
from app.schemas.maintenance_task import MaintenanceTaskList

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
