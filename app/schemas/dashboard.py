"""app/schemas/dashboard.py — Dashboard KPI aggregate schema."""
from typing import Dict, List
from pydantic import BaseModel


class DeptStats(BaseModel):
    code: str
    name: str
    total_tasks: int
    critical_tasks: int
    overdue_tasks: int
    scheduled_tasks: int
    color_hex: str


class SectionStatus(BaseModel):
    section_code: str
    section_name: str
    criticality_level: int
    pending_tasks: int
    overdue_tasks: int
    lat_start: float | None
    lon_start: float | None
    lat_end: float | None
    lon_end: float | None


class DashboardKPIs(BaseModel):
    asset_availability_pct: float
    total_tasks: int
    critical_tasks: int
    overdue_tasks: int
    scheduled_tasks: int
    todays_blocks: int
    joint_blocks_today: int
    active_conflicts: int
    avg_block_efficiency: float
    dept_stats: List[DeptStats]
    section_statuses: List[SectionStatus]
    # For sparkline trend chart (last 7 days)
    availability_trend: List[Dict]   # [{"date": "2026-09-08", "availability": 91.2}, ...]
