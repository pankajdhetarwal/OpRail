from datetime import date
from typing import Optional

from pydantic import BaseModel


class MaintenanceTaskCreate(BaseModel):
    source_system: str
    department: str
    section_code: str
    defect_type: str
    severity: int
    days_overdue: int = 0
    duration_minutes: int
    due_date: Optional[date] = None


class MaintenanceTaskOut(MaintenanceTaskCreate):
    id: int
    priority_score: Optional[float] = None

    class Config:
        from_attributes = True  # lets this be built directly from a SQLAlchemy row
