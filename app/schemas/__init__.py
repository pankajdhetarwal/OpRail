"""
app/schemas/__init__.py
Re-export all schemas for convenient imports.
"""
from app.schemas.maintenance_task import (
    MaintenanceTaskCreate,
    MaintenanceTaskOut,
    MaintenanceTaskList,
)
from app.schemas.train_schedule import TrainScheduleOut
from app.schemas.block_window import BlockWindowOut
from app.schemas.generated_block import GeneratedBlockOut, PlanGenerateRequest, PlanGenerateResponse
from app.schemas.dashboard import DashboardKPIs

__all__ = [
    "MaintenanceTaskCreate", "MaintenanceTaskOut", "MaintenanceTaskList",
    "TrainScheduleOut",
    "BlockWindowOut",
    "GeneratedBlockOut", "PlanGenerateRequest", "PlanGenerateResponse",
    "DashboardKPIs",
]
