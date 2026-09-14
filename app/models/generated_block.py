"""
app/models/generated_block.py
Output of the OR-Tools optimizer — an optimized maintenance block.
A block may contain tasks from multiple departments (joint block).
"""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class GeneratedBlock(Base):
    __tablename__ = "generated_blocks"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("railway_sections.id"), nullable=False)

    schedule_date = Column(String(10), nullable=False)   # "2026-09-14"
    start_time = Column(String(5), nullable=False)       # "22:00"
    end_time = Column(String(5), nullable=False)         # "02:00"
    duration_minutes = Column(Integer, nullable=False)

    # IDs of maintenance tasks bundled in this block (stored as JSON array)
    task_ids = Column(JSON, nullable=False, default=list)

    # Departments involved: ["ENG", "ST", "OHE"]
    departments_involved = Column(JSON, nullable=False, default=list)

    # True if tasks from ≥2 departments are bundled = the key differentiator
    is_joint_block = Column(Boolean, default=False)

    # Block efficiency = useful_maintenance_time / block_duration
    efficiency_score = Column(Float, default=0.0)

    # Total priority weight of tasks in this block
    total_priority_score = Column(Float, default=0.0)

    # Planning horizon this was generated for: "daily", "weekly", "monthly"
    horizon = Column(String(10), default="weekly")

    # Plain-English explanation (from template or Gemini API)
    why_explanation = Column(Text, nullable=True)

    # Which optimizer run generated this
    run_id = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    section = relationship("RailwaySection", back_populates="generated_blocks")
