"""app/schemas/generated_block.py — Request/response schemas for block plan generation."""
from typing import List, Optional
from pydantic import BaseModel, Field


class PlanGenerateRequest(BaseModel):
    start_date: str = Field(..., description="ISO date string e.g. '2026-09-14'")
    end_date: str = Field(..., description="ISO date string e.g. '2026-09-20'")
    section_ids: Optional[List[int]] = Field(None, description="Limit to specific sections; None = all")
    dept_codes: Optional[List[str]] = Field(None, description="e.g. ['ENG','ST']; None = all departments")
    horizon: str = Field("weekly", description="'weekly' or 'monthly'")
    train_density_multiplier: float = Field(1.0, description="For what-if: 1.2 = +20% train traffic")


class GeneratedBlockOut(BaseModel):
    id: int
    section_id: int
    section_code: str
    section_name: str
    schedule_date: str
    start_time: str
    end_time: str
    duration_minutes: int
    task_ids: List[int]
    departments_involved: List[str]
    is_joint_block: bool
    efficiency_score: float
    total_priority_score: float
    why_explanation: Optional[str]
    horizon: str

    model_config = {"from_attributes": True}


class PlanGenerateResponse(BaseModel):
    run_id: str
    horizon: str
    total_blocks: int
    joint_blocks: int
    total_tasks_scheduled: int
    tasks_dropped: int
    avg_efficiency: float
    asset_availability_pct: float
    blocks: List[GeneratedBlockOut]
