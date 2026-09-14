"""
tests/test_optimizer.py — OR-Tools Optimizer Tests
===================================================
OpRail | SIH 2026 | PS-26027

Tests the core scheduling logic:
1. Basic no-overlap constraint
2. Tasks are constrained within their window
3. High-priority tasks are preferred over low-priority when space is tight
4. Joint-block bonus causes multi-dept tasks to be selected together
5. Empty input handled gracefully
"""
import pytest
from app.services.optimizer import ScheduleRequestTask, optimize_schedule


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_task(id, section, duration, priority, window_start=0, window_end=480):
    return ScheduleRequestTask(
        id=id, section=section, duration_minutes=duration,
        priority_score=priority, window_start_minute=window_start,
        window_end_minute=window_end
    )


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_empty_input():
    result = optimize_schedule([])
    assert result == []


def test_single_task_is_scheduled():
    tasks = [make_task(1, "S1", 60, 80.0)]
    result = optimize_schedule(tasks)
    assert len(result) == 1
    assert result[0]["task_id"] == 1


def test_no_overlap_same_section():
    """Two tasks on the same section must not overlap in time."""
    tasks = [
        make_task(1, "S1", 120, 90.0, 0, 480),
        make_task(2, "S1", 120, 85.0, 0, 480),
    ]
    result = optimize_schedule(tasks)
    assert len(result) == 2, "Both tasks should fit in 480-minute window"

    t1 = next(r for r in result if r["task_id"] == 1)
    t2 = next(r for r in result if r["task_id"] == 2)

    # No overlap: one must end before the other starts
    no_overlap = (t1["end_minute"] <= t2["start_minute"]) or (t2["end_minute"] <= t1["start_minute"])
    assert no_overlap, f"Tasks overlap: {t1} | {t2}"


def test_window_constraint_respected():
    """Task must start and end within its window."""
    window_start = 60   # 01:00
    window_end = 180    # 03:00
    tasks = [make_task(1, "S1", 60, 75.0, window_start, window_end)]
    result = optimize_schedule(tasks)
    assert len(result) == 1
    r = result[0]
    assert r["start_minute"] >= window_start, "Task started before window"
    assert r["end_minute"] <= window_end, "Task ended after window"


def test_task_dropped_if_too_long_for_window():
    """Task longer than the available window must be dropped (not scheduled)."""
    tasks = [make_task(1, "S1", 300, 90.0, window_start=0, window_end=120)]
    result = optimize_schedule(tasks)
    assert len(result) == 0, "Task longer than window should be dropped"


def test_higher_priority_preferred_when_window_is_tight():
    """When only one task fits, the higher-priority one should win."""
    tasks = [
        make_task(1, "S1", 90, 95.0, 0, 120),   # high priority
        make_task(2, "S1", 90, 20.0, 0, 120),   # low priority
    ]
    result = optimize_schedule(tasks)
    assert len(result) == 1, "Only one task should fit in 120-min window with 90-min tasks"
    assert result[0]["task_id"] == 1, "High-priority task should be chosen"


def test_tasks_on_different_sections_can_run_simultaneously():
    """Tasks on different sections are independent — both should be scheduled."""
    tasks = [
        make_task(1, "S1", 120, 80.0, 0, 240),
        make_task(2, "S2", 120, 80.0, 0, 240),
    ]
    result = optimize_schedule(tasks)
    assert len(result) == 2

    t1 = next(r for r in result if r["task_id"] == 1)
    t2 = next(r for r in result if r["task_id"] == 2)
    # They can overlap in time because they're on different sections
    assert t1["section"] != t2["section"]


def test_all_tasks_fit_when_window_is_large():
    """5 tasks on the same section — all should fit in a large window."""
    tasks = [make_task(i, "S1", 60, float(90 - i * 5), 0, 600) for i in range(1, 6)]
    result = optimize_schedule(tasks)
    assert len(result) == 5, f"All 5 tasks should fit, got {len(result)}"


def test_result_sorted_by_section_then_start():
    """Output must be sorted by section then start_minute."""
    tasks = [
        make_task(1, "S2", 60, 80.0, 0, 300),
        make_task(2, "S1", 60, 80.0, 0, 300),
        make_task(3, "S1", 60, 75.0, 0, 300),
    ]
    result = optimize_schedule(tasks)
    for i in range(len(result) - 1):
        a, b = result[i], result[i + 1]
        assert (a["section"], a["start_minute"]) <= (b["section"], b["start_minute"])


def test_joint_block_both_tasks_scheduled():
    """
    Two tasks from the same section (simulating different departments)
    should both be scheduled when there's enough window time.
    The joint-block bonus encourages this.
    """
    tasks = [
        make_task(1, "S1", 90, 70.0, 0, 300),   # ENG task
        make_task(2, "S1", 60, 65.0, 0, 300),   # ST task
    ]
    result = optimize_schedule(tasks)
    scheduled_ids = {r["task_id"] for r in result}
    assert 1 in scheduled_ids and 2 in scheduled_ids, (
        "Both dept tasks should be scheduled (joint block bonus)"
    )


def test_priority_score_boundary():
    """Priority scores at boundaries (0 and 100) should still work."""
    tasks = [
        make_task(1, "S1", 30, 0.0, 0, 480),
        make_task(2, "S1", 30, 100.0, 0, 480),
    ]
    result = optimize_schedule(tasks)
    assert len(result) == 2
