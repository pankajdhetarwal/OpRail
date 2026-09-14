"""
app/models/block_window.py
Available maintenance windows — derived from COA train-free gaps.
The optimizer can ONLY schedule tasks inside available block windows.
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class BlockWindow(Base):
    __tablename__ = "block_windows"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("railway_sections.id"), nullable=False)

    schedule_date = Column(String(10), nullable=False)   # "2026-09-14"
    start_time = Column(String(5), nullable=False)       # "22:00"
    end_time = Column(String(5), nullable=False)         # "02:00"
    duration_minutes = Column(Integer, nullable=False)

    # Whether this window is still available (not already taken)
    is_available = Column(Boolean, default=True)

    # Which COA corridor this window belongs to
    corridor_id = Column(String(50), nullable=True)

    # Window type: "night_block", "day_block", "extended"
    window_type = Column(String(30), default="night_block")

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    section = relationship("RailwaySection", back_populates="block_windows")
