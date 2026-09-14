"""
app/models/department.py
Departments: Engineering (TMS), S&T / Signalling (SMMS), Traction/OHE (TDMS)
"""
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False)   # ENG, ST, OHE
    name = Column(String(100), nullable=False)                # Engineering, S&T, Traction
    source_system = Column(String(20), nullable=False)        # TMS, SMMS, TDMS
    color_hex = Column(String(7), default="#6366f1")          # For Gantt coloring

    # Relationships
    tasks = relationship("MaintenanceTask", back_populates="department")
    resources = relationship("Resource", back_populates="department")
