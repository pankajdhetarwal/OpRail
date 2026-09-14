"""
app/models/maintenance_task.py
Core entity — a single maintenance job from TMS / SMMS / TDMS.
Each task belongs to one department and is located on one railway section.
"""
from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, Float,
    ForeignKey, Integer, String, Text
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class TaskStatus(str, PyEnum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"


class TaskType(str, PyEnum):
    # Engineering (TMS)
    RAIL_REPLACEMENT = "rail_replacement"
    SLEEPER_MAINTENANCE = "sleeper_maintenance"
    TRACK_INSPECTION = "track_inspection"
    BALLAST_CLEANING = "ballast_cleaning"
    RAIL_CRACK_REPAIR = "rail_crack_repair"
    # S&T (SMMS)
    SIGNAL_FAULT = "signal_fault"
    CABLE_MAINTENANCE = "cable_maintenance"
    INTERLOCKING_MAINTENANCE = "interlocking_maintenance"
    SIGNAL_INSPECTION = "signal_inspection"
    # Traction/OHE (TDMS)
    OHE_INSPECTION = "ohe_inspection"
    OVERHEAD_WIRE_MAINTENANCE = "overhead_wire_maintenance"
    TRANSFORMER_MAINTENANCE = "transformer_maintenance"
    TRACTION_SUBSTATION = "traction_substation"


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_code = Column(String(30), unique=True, nullable=False)  # e.g. "ENG_102", "SIG_51"
    dept_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("railway_sections.id"), nullable=False)

    task_type = Column(Enum(TaskType), nullable=False)
    description = Column(Text, nullable=True)

    # Severity: 1 (routine) → 5 (critical/safety)
    severity = Column(Integer, nullable=False)
    days_overdue = Column(Integer, default=0)
    duration_minutes = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)

    # Flags
    safety_critical = Column(Boolean, default=False)
    requires_line_block = Column(Boolean, default=True)
    requires_ohe_disconnection = Column(Boolean, default=False)

    # Computed by priority engine (updated on each scoring run)
    priority_score = Column(Float, default=0.0)

    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department = relationship("Department", back_populates="tasks")
    section = relationship("RailwaySection", back_populates="tasks")
