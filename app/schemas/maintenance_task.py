"""
app/schemas/maintenance_task.py — Pydantic v2 schemas for maintenance tasks.
Note: ORM model (models/maintenance_task.py) and API schema are intentionally separate.
The ORM model has DB-internal columns we don't always expose.
"""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class DepartmentBrief(BaseModel):
    id: int
    code: str
    name: str
    color_hex: str

    model_config = {"from_attributes": True}


class SectionBrief(BaseModel):
    id: int
    code: str
    name: str
    criticality_level: int

    model_config = {"from_attributes": True}


class MaintenanceTaskCreate(BaseModel):
    task_code: str
    dept_id: int
    section_id: int
    task_type: str
    description: Optional[str] = None
    severity: int = Field(..., ge=1, le=5)
    days_overdue: int = Field(default=0, ge=0)
    duration_minutes: int = Field(..., gt=0)
    due_date: date
    safety_critical: bool = False
    requires_line_block: bool = True
    requires_ohe_disconnection: bool = False


class MaintenanceTaskOut(BaseModel):
    id: int
    task_code: str
    task_type: str
    description: Optional[str]
    severity: int
    days_overdue: int
    duration_minutes: int
    due_date: date
    safety_critical: bool
    requires_line_block: bool
    requires_ohe_disconnection: bool
    priority_score: float
    status: str
    created_at: datetime

    # Nested objects
    department: DepartmentBrief
    section: SectionBrief

    model_config = {"from_attributes": True}


class MaintenanceTaskList(BaseModel):
    total: int
    tasks: List[MaintenanceTaskOut]
