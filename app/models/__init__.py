"""
app/models/__init__.py
Import all models here so SQLAlchemy discovers them when create_all_tables() is called.
"""
from app.models.department import Department
from app.models.railway_section import RailwaySection
from app.models.maintenance_task import MaintenanceTask
from app.models.train_schedule import TrainSchedule
from app.models.block_window import BlockWindow
from app.models.generated_block import GeneratedBlock
from app.models.resource import Resource

__all__ = [
    "Department",
    "RailwaySection",
    "MaintenanceTask",
    "TrainSchedule",
    "BlockWindow",
    "GeneratedBlock",
    "Resource",
]
