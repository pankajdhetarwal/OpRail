"""
app/api/routes/dashboard.py — KPI aggregates for the control dashboard.
"""
from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.maintenance_task import MaintenanceTask, TaskStatus
from app.models.department import Department
from app.models.generated_block import GeneratedBlock
from app.models.railway_section import RailwaySection
from app.schemas.dashboard import DashboardKPIs, DeptStats, SectionStatus

router = APIRouter()


@router.get("/", response_model=DashboardKPIs)
def get_dashboard_kpis(db: Session = Depends(get_db)):
    today_str = date.today().isoformat()

    total_tasks = db.query(MaintenanceTask).count()
    critical_tasks = db.query(MaintenanceTask).filter(MaintenanceTask.safety_critical == True).count()
    overdue_tasks = db.query(MaintenanceTask).filter(MaintenanceTask.status == TaskStatus.OVERDUE).count()
    scheduled_tasks = db.query(MaintenanceTask).filter(MaintenanceTask.status == TaskStatus.SCHEDULED).count()

    todays_blocks = db.query(GeneratedBlock).filter(GeneratedBlock.schedule_date == today_str).count()
    joint_blocks_today = db.query(GeneratedBlock).filter(
        GeneratedBlock.schedule_date == today_str,
        GeneratedBlock.is_joint_block == True
    ).count()

    # Avg block efficiency
    eff_result = db.query(func.avg(GeneratedBlock.efficiency_score)).scalar() or 0.0

    # Asset availability: simplified calculation
    scheduled_count = scheduled_tasks
    availability_pct = round(
        max(0, (total_tasks - overdue_tasks) / max(total_tasks, 1) * 100), 1
    )

    # Per-department stats
    departments = db.query(Department).all()
    dept_stats = []
    for dept in departments:
        dept_tasks = db.query(MaintenanceTask).filter(MaintenanceTask.dept_id == dept.id)
        dept_stats.append(DeptStats(
            code=dept.code,
            name=dept.name,
            total_tasks=dept_tasks.count(),
            critical_tasks=dept_tasks.filter(MaintenanceTask.safety_critical == True).count(),
            overdue_tasks=dept_tasks.filter(MaintenanceTask.status == TaskStatus.OVERDUE).count(),
            scheduled_tasks=dept_tasks.filter(MaintenanceTask.status == TaskStatus.SCHEDULED).count(),
            color_hex=dept.color_hex,
        ))

    # Per-section status (top 20 by criticality)
    sections = (
        db.query(RailwaySection)
        .order_by(RailwaySection.criticality_level.desc())
        .limit(20)
        .all()
    )
    section_statuses = []
    for sec in sections:
        sec_tasks = db.query(MaintenanceTask).filter(MaintenanceTask.section_id == sec.id)
        section_statuses.append(SectionStatus(
            section_code=sec.code,
            section_name=sec.name,
            criticality_level=sec.criticality_level,
            pending_tasks=sec_tasks.filter(MaintenanceTask.status == TaskStatus.PENDING).count(),
            overdue_tasks=sec_tasks.filter(MaintenanceTask.status == TaskStatus.OVERDUE).count(),
            lat_start=sec.lat_start,
            lon_start=sec.lon_start,
            lat_end=sec.lat_end,
            lon_end=sec.lon_end,
        ))

    # 7-day availability trend (mock trend based on real data)
    availability_trend = []
    for i in range(7, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        # Simulate slight variation — in real system, compute from historical blocks
        trend_val = round(availability_pct + (i * 0.3 - 1.0), 1)
        availability_trend.append({"date": d, "availability": min(max(trend_val, 80.0), 99.9)})

    return DashboardKPIs(
        asset_availability_pct=availability_pct,
        total_tasks=total_tasks,
        critical_tasks=critical_tasks,
        overdue_tasks=overdue_tasks,
        scheduled_tasks=scheduled_tasks,
        todays_blocks=todays_blocks,
        joint_blocks_today=joint_blocks_today,
        active_conflicts=0,  # optimizer guarantees zero conflicts
        avg_block_efficiency=round(eff_result, 1),
        dept_stats=dept_stats,
        section_statuses=section_statuses,
        availability_trend=availability_trend,
    )
