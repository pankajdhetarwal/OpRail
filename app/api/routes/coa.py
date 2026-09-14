"""
app/api/routes/coa.py — Mock COA (Control Office Application) API
Returns train schedule data and available block windows.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.train_schedule import TrainSchedule
from app.models.block_window import BlockWindow
from app.schemas.train_schedule import TrainScheduleOut
from app.schemas.block_window import BlockWindowOut

router = APIRouter()


@router.get("/trains", response_model=List[TrainScheduleOut], summary="COA: Train timetable")
def get_train_schedule(
    section_id: Optional[int] = Query(None),
    schedule_date: Optional[str] = Query(None, description="ISO date e.g. '2026-09-14'"),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db),
):
    """Return train movement data for the specified section/date."""
    query = db.query(TrainSchedule)
    if section_id:
        query = query.filter(TrainSchedule.section_id == section_id)
    if schedule_date:
        query = query.filter(TrainSchedule.schedule_date == schedule_date)
    return query.order_by(TrainSchedule.entry_time).limit(limit).all()


@router.get("/windows", response_model=List[BlockWindowOut], summary="COA: Available block windows")
def get_block_windows(
    section_id: Optional[int] = Query(None),
    schedule_date: Optional[str] = Query(None),
    available_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Return COA-approved maintenance windows."""
    query = db.query(BlockWindow)
    if section_id:
        query = query.filter(BlockWindow.section_id == section_id)
    if schedule_date:
        query = query.filter(BlockWindow.schedule_date == schedule_date)
    if available_only:
        query = query.filter(BlockWindow.is_available == True)
    return query.order_by(BlockWindow.start_time).all()
