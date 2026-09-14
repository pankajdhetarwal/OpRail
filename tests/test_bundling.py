import pytest
from app.services.bundling import find_bundle_candidates_dbscan

def test_dbscan_bundling():
    # Scenario:
    # 3 tasks on S23 at 60, 75, 90 (duration 30 each)
    # 1 task on S23 at 300 (duration 30 each)
    tasks = [
        {"task_id": 1, "section": "S23", "start_minute": 60, "end_minute": 90},
        {"task_id": 2, "section": "S23", "start_minute": 75, "end_minute": 105},
        {"task_id": 3, "section": "S23", "start_minute": 90, "end_minute": 120},
        {"task_id": 4, "section": "S23", "start_minute": 300, "end_minute": 330},
    ]

    bundles = find_bundle_candidates_dbscan(tasks, eps=30, min_samples=2)

    # Assert that there is exactly 1 bundle formed
    assert len(bundles) == 1
    bundle = bundles[0]

    # Assert that the first three land in one cluster together
    assert set(bundle["task_ids"]) == {1, 2, 3}

    # Assert that the fourth is excluded (it's not in the bundle)
    assert 4 not in bundle["task_ids"]

    # Assert downtime saved
    # Bundle duration is max(30, 30, 30) = 30
    # Downtime saved = sum(30+30+30) - 30 = 60
    assert bundle["bundle_duration_minutes"] == 30
    assert bundle["downtime_saved_minutes"] == 60
