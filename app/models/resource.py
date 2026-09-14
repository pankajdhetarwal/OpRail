"""
app/models/resource.py
Maintenance teams / equipment available per department per section.
Optimizer uses this to avoid over-scheduling when resources are limited.
"""
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    dept_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("railway_sections.id"), nullable=True)  # None = mobile/roving team

    name = Column(String(100), nullable=False)   # "Gang-14", "OHE-Team-3"
    resource_type = Column(String(50), nullable=False)  # "maintenance_gang", "ohe_team", "signal_squad"
    # How many concurrent tasks this resource can handle (usually 1)
    capacity = Column(Integer, default=1)

    # Relationships
    department = relationship("Department", back_populates="resources")
    section = relationship("RailwaySection", back_populates="resources")
