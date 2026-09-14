"""
app/models/railway_section.py
A railway section is the atomic unit of track that can be blocked for maintenance.
Example: "Delhi-Ghaziabad-S01", "Mumbai-Pune-S17"
"""
from sqlalchemy import Column, Float, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class RailwaySection(Base):
    __tablename__ = "railway_sections"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)      # e.g. "S23", "DLI-GZB-01"
    name = Column(String(200), nullable=False)
    zone = Column(String(10), nullable=False)                   # NR, WR, SR, etc.
    division = Column(String(50), nullable=False)
    from_station = Column(String(100), nullable=False)
    to_station = Column(String(100), nullable=False)
    length_km = Column(Float, nullable=False)
    # 1=low, 2=medium, 3=high, 4=very high, 5=critical
    criticality_level = Column(Integer, default=3)
    train_density = Column(Float, default=0.5)    # 0-1, avg from COA data

    # Coordinates for Leaflet map
    lat_start = Column(Float, nullable=True)
    lon_start = Column(Float, nullable=True)
    lat_end = Column(Float, nullable=True)
    lon_end = Column(Float, nullable=True)

    # Relationships
    tasks = relationship("MaintenanceTask", back_populates="section")
    trains = relationship("TrainSchedule", back_populates="section")
    block_windows = relationship("BlockWindow", back_populates="section")
    generated_blocks = relationship("GeneratedBlock", back_populates="section")
    resources = relationship("Resource", back_populates="section")
