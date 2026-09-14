from sqlalchemy import Column, Date, Float, Integer, String

from app.core.database import Base


class MaintenanceTask(Base):
    """One row = one defect/maintenance job reported by TMS, SMMS, or TDMS."""

    __tablename__ = "maintenance_tasks"

    id = Column(Integer, primary_key=True, index=True)
    source_system = Column(String, nullable=False)   # "TMS" | "SMMS" | "TDMS"
    department = Column(String, nullable=False)       # "Engineering" | "S&T" | "Traction"
    section_code = Column(String, nullable=False, index=True)  # e.g. "DLI-JP-S23"
    defect_type = Column(String, nullable=False)
    severity = Column(Integer, nullable=False)         # 1 (minor) – 5 (critical)
    days_overdue = Column(Integer, default=0)
    duration_minutes = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=True)
    priority_score = Column(Float, nullable=True)       # filled in by priority_engine.py
