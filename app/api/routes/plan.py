"""
app/api/routes/plan.py
Block plan generation endpoint — calls priority engine then OR-Tools optimizer.
"""
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.maintenance_task import MaintenanceTask, TaskStatus
from app.models.block_window import BlockWindow
from app.models.generated_block import GeneratedBlock
from app.models.railway_section import RailwaySection
from app.schemas.generated_block import (
    GeneratedBlockOut, PlanGenerateRequest, PlanGenerateResponse,
    PlanValidateRequest, PlanValidateResponse
)
from app.services.priority_engine_v2 import compute_priority_score_v2 as compute_priority_score
from app.services.optimizer import optimize_schedule, ScheduleRequestTask
from app.services.explainer import generate_why_explanation
from app.services.bundling import find_bundle_candidates, find_bundle_candidates_dbscan
from app.schemas.bundling import BundleCandidatesRequest, BundleCandidatesResponse

router = APIRouter()


@router.post("/generate", response_model=PlanGenerateResponse)
def generate_block_plan(request: PlanGenerateRequest, db: Session = Depends(get_db)):
    """
    Main endpoint: takes a date range + optional filters,
    runs priority scoring + OR-Tools optimizer,
    stores and returns the generated block plan.
    """
    run_id = str(uuid.uuid4())[:8].upper()
    start_date = date.fromisoformat(request.start_date)
    end_date = date.fromisoformat(request.end_date)

    # 1. Fetch pending/overdue maintenance tasks
    query = (
        db.query(MaintenanceTask)
        .options(joinedload(MaintenanceTask.department), joinedload(MaintenanceTask.section))
        .filter(MaintenanceTask.status.in_([TaskStatus.PENDING, TaskStatus.OVERDUE]))
    )
    if request.section_ids:
        query = query.filter(MaintenanceTask.section_id.in_(request.section_ids))
    if request.dept_codes:
        from app.models.department import Department
        query = query.join(Department).filter(Department.code.in_(request.dept_codes))

    tasks = query.all()
    if not tasks:
        raise HTTPException(status_code=404, detail="No pending tasks found for the given filters.")

    # 2. Compute priority scores (using section train_density * multiplier for what-if)
    for task in tasks:
        effective_density = min(task.section.train_density * request.train_density_multiplier, 1.0)
        task.priority_score = compute_priority_score(
            severity=task.severity,
            days_overdue=task.days_overdue,
            train_density=effective_density,
        )

    # 3. Fetch available block windows in the date range
    date_strs = [
        (start_date + timedelta(days=i)).isoformat()
        for i in range((end_date - start_date).days + 1)
    ]
    windows = (
        db.query(BlockWindow)
        .filter(BlockWindow.schedule_date.in_(date_strs), BlockWindow.is_available == True)
        .all()
    )
    # Build window lookup: section_id → list of windows
    windows_by_section: dict = {}
    for w in windows:
        windows_by_section.setdefault(w.section_id, []).append(w)

    # 4. Build optimizer input: group tasks by section
    horizon_minutes = 24 * 60
    scheduler_tasks = []
    section_tasks: dict = {}
    for task in tasks:
        section_tasks.setdefault(task.section_id, []).append(task)

    for section_id, sec_tasks in section_tasks.items():
        avail_windows = windows_by_section.get(section_id, [])
        if not avail_windows:
            continue  # skip sections with no available windows

        # Use the BEST (longest) window for this section across all dates
        # Handle overnight windows (e.g. 22:30 -> 02:30): use duration directly
        best_window = max(avail_windows, key=lambda w: w.duration_minutes)
        win_start = _time_to_minutes(best_window.start_time)
        # Project linearly — do NOT wrap at midnight to avoid negative ranges
        win_end = win_start + best_window.duration_minutes

        for task in sec_tasks:
            # Skip tasks that can't possibly fit in this window
            if task.duration_minutes > best_window.duration_minutes:
                continue
            scheduler_tasks.append(
                ScheduleRequestTask(
                    id=task.id,
                    section=str(section_id),
                    duration_minutes=task.duration_minutes,
                    priority_score=task.priority_score,
                    window_start_minute=win_start,
                    window_end_minute=win_end,
                )
            )

    # 5. Run optimizer — use largest window end as horizon
    horizon_minutes = max((t.window_end_minute for t in scheduler_tasks), default=24 * 60)
    schedule_results = optimize_schedule(scheduler_tasks, horizon_minutes=horizon_minutes)

    # 6. Persist generated blocks and build response
    task_id_to_task = {t.id: t for t in tasks}
    task_id_to_obj = {t.id: t for t in tasks}
    scheduled_task_ids = {r["task_id"] for r in schedule_results}
    dropped_count = len(tasks) - len(scheduled_task_ids)

    # Group scheduled tasks by section+window to create joint blocks
    blocks_by_section: dict = {}
    for result in schedule_results:
        sid = int(result["section"])
        blocks_by_section.setdefault(sid, []).append(result)

    generated_blocks = []
    for section_id, results in blocks_by_section.items():
        section = db.query(RailwaySection).get(section_id)
        if not section:
            continue

        task_ids_in_block = [r["task_id"] for r in results]
        dept_codes = list({
            task_id_to_task[tid].department.code
            for tid in task_ids_in_block
            if tid in task_id_to_task
        })
        is_joint = len(dept_codes) >= 2

        # Use the earliest start / latest end for the block window
        start_min = min(r["start_minute"] for r in results)
        end_min = max(r["end_minute"] for r in results)
        useful_minutes = sum(r["end_minute"] - r["start_minute"] for r in results)
        efficiency = round(useful_minutes / max(end_min - start_min, 1) * 100, 1)

        total_priority = sum(
            task_id_to_task[tid].priority_score
            for tid in task_ids_in_block
            if tid in task_id_to_task
        )

        why = generate_why_explanation(
            section=section,
            task_ids=task_ids_in_block,
            tasks=task_id_to_task,
            dept_codes=dept_codes,
            is_joint=is_joint,
            start_time=_minutes_to_time(start_min),
            efficiency=efficiency,
        )

        gb = GeneratedBlock(
            section_id=section_id,
            schedule_date=start_date.isoformat(),
            start_time=_minutes_to_time(start_min),
            end_time=_minutes_to_time(end_min),
            duration_minutes=end_min - start_min,
            task_ids=task_ids_in_block,
            departments_involved=dept_codes,
            is_joint_block=is_joint,
            efficiency_score=efficiency,
            total_priority_score=round(total_priority, 2),
            horizon=request.horizon,
            why_explanation=why,
            run_id=run_id,
        )
        db.add(gb)
        db.flush()

        generated_blocks.append(GeneratedBlockOut(
            id=gb.id,
            section_id=section_id,
            section_code=section.code,
            section_name=section.name,
            schedule_date=gb.schedule_date,
            start_time=gb.start_time,
            end_time=gb.end_time,
            duration_minutes=gb.duration_minutes,
            task_ids=task_ids_in_block,
            departments_involved=dept_codes,
            is_joint_block=is_joint,
            efficiency_score=efficiency,
            total_priority_score=gb.total_priority_score,
            why_explanation=why,
            horizon=request.horizon,
        ))

    db.commit()

    # Mark scheduled tasks as scheduled
    for tid in scheduled_task_ids:
        if tid in task_id_to_obj:
            task_id_to_obj[tid].status = TaskStatus.SCHEDULED
    db.commit()

    joint_count = sum(1 for b in generated_blocks if b.is_joint_block)
    avg_eff = round(sum(b.efficiency_score for b in generated_blocks) / max(len(generated_blocks), 1), 1)
    total_section_time = len(date_strs) * 24 * 60 * len(section_tasks)
    downtime = sum(b.duration_minutes for b in generated_blocks)
    availability_pct = round((1 - downtime / max(total_section_time, 1)) * 100, 2)

    return PlanGenerateResponse(
        run_id=run_id,
        horizon=request.horizon,
        total_blocks=len(generated_blocks),
        joint_blocks=joint_count,
        total_tasks_scheduled=len(scheduled_task_ids),
        tasks_dropped=dropped_count,
        avg_efficiency=avg_eff,
        asset_availability_pct=min(availability_pct, 99.9),
        blocks=generated_blocks,
    )


@router.get("/history")
def get_plan_history(limit: int = 20, db: Session = Depends(get_db)):
    """Return previously generated block plans."""
    blocks = (
        db.query(GeneratedBlock)
        .order_by(GeneratedBlock.created_at.desc())
        .limit(limit)
        .all()
    )
    return {"total": len(blocks), "blocks": blocks}


@router.post("/validate", response_model=PlanValidateResponse)
def validate_manual_block(req: PlanValidateRequest, db: Session = Depends(get_db)):
    """
    Validates if a manually dragged block on the Gantt chart clashes with any real trains.
    """
    from app.models.train_schedule import TrainSchedule

    req_start = _time_to_minutes(req.start_time)
    req_end = _time_to_minutes(req.end_time)

    # Handle overnight blocks (e.g. 23:00 to 02:00)
    # We will treat this as a wrap-around check.
    def overlaps(t_start, t_end, r_start, r_end):
        if r_start <= r_end:
            # Normal block
            if t_start <= t_end:
                return not (t_end <= r_start or t_start >= r_end)
            else:
                # Train crosses midnight
                return not (t_end <= r_start and t_start >= r_end)
        else:
            # Block crosses midnight
            if t_start <= t_end:
                return not (t_end <= r_start and t_start >= r_end)
            else:
                # Both cross midnight, guaranteed overlap
                return True

    trains = db.query(TrainSchedule).filter(
        TrainSchedule.section_id == req.section_id,
        TrainSchedule.schedule_date == req.date
    ).all()

    for train in trains:
        t_start = _time_to_minutes(train.entry_time)
        t_end = _time_to_minutes(train.exit_time)
        
        if overlaps(t_start, t_end, req_start, req_end):
            return PlanValidateResponse(
                valid=False,
                conflict_train=f"{train.train_no} {train.train_name}",
                conflict_time=f"{train.entry_time} - {train.exit_time}",
                message=f"WARNING: Clashes with {train.train_name}"
            )

    return PlanValidateResponse(valid=True, message="Clear for manual block")


@router.post("/bundle-candidates", response_model=BundleCandidatesResponse)
def get_bundle_candidates(req: BundleCandidatesRequest, method: str = "pairwise"):
    """
    Finds candidates for bundling maintenance tasks based on proximity in time.
    """
    # Convert request models to list of dicts
    tasks_dicts = [t.model_dump() for t in req.tasks]
    
    if method == "dbscan":
        bundles = find_bundle_candidates_dbscan(tasks_dicts)
    else:
        bundles = find_bundle_candidates(tasks_dicts)
        
    return BundleCandidatesResponse(method_used=method, bundles=bundles)


def _time_to_minutes(time_str: str) -> int:
    """Convert 'HH:MM' to minutes from midnight."""
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


def _minutes_to_time(minutes: int) -> str:
    """Convert minutes from midnight to 'HH:MM'."""
    minutes = minutes % 1440
    return f"{minutes // 60:02d}:{minutes % 60:02d}"
