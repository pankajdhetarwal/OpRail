"""
app/models/train_schedule.py
Train movement data from COA (Control Office Application).
Each row = one train passing through one section at a specific time.
Used by the optimizer to define train-free maintenance windows.
"""
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Time
from sqlalchemy.orm import relationship

from app.core.database import Base


class TrainType(str, PyEnum):
    EXPRESS = "express"
    MAIL = "mail"
    PASSENGER = "passenger"
    GOODS = "goods"
    RAJDHANI = "rajdhani"
    SHATABDI = "shatabdi"
    VANDE_BHARAT = "vande_bharat"
    LOCAL = "local"
    SPECIAL = "special"


class TrainPriority(str, PyEnum):
    HIGH = "high"      # Rajdhani, Vande Bharat, Mail Express
    MEDIUM = "medium"  # Regular Express, Passenger
    LOW = "low"        # Goods, Local


class TrainSchedule(Base):
    __tablename__ = "train_schedule"

    id = Column(Integer, primary_key=True, index=True)
    train_no = Column(String(10), nullable=False, index=True)
    train_name = Column(String(200), nullable=True)
    section_id = Column(Integer, ForeignKey("railway_sections.id"), nullable=False)

    train_type = Column(Enum(TrainType), nullable=False)
    train_priority = Column(Enum(TrainPriority), default=TrainPriority.MEDIUM)

    # Times on this section (use HH:MM format stored as time)
    entry_time = Column(String(5), nullable=False)   # "22:30"
    exit_time = Column(String(5), nullable=False)    # "22:45"
    schedule_date = Column(String(10), nullable=False)  # "2026-09-14"

    # Direction: UP or DOWN
    direction = Column(String(4), default="UP")

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    section = relationship("RailwaySection", back_populates="trains")
