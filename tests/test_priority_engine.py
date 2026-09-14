"""tests/test_priority_engine.py — Priority Engine Tests"""
import pytest
from app.services.priority_engine import compute_priority_score, get_priority_label, get_score_breakdown


def test_max_score():
    score = compute_priority_score(severity=5, days_overdue=60, train_density=1.0, asset_criticality=5)
    assert score == 100.0


def test_min_score():
    score = compute_priority_score(severity=1, days_overdue=0, train_density=0.0, asset_criticality=1)
    assert score < 15.0, "Minimum inputs should give low score"


def test_severity_dominates():
    high = compute_priority_score(severity=5, days_overdue=0, train_density=0.0)
    low = compute_priority_score(severity=1, days_overdue=0, train_density=0.0)
    assert high > low


def test_overdue_increases_score():
    base = compute_priority_score(severity=3, days_overdue=0, train_density=0.5)
    overdue = compute_priority_score(severity=3, days_overdue=30, train_density=0.5)
    assert overdue > base


def test_score_clamped_to_range():
    score = compute_priority_score(severity=10, days_overdue=999, train_density=2.0)
    assert 0.0 <= score <= 100.0


def test_priority_labels():
    assert get_priority_label(80) == "CRITICAL"
    assert get_priority_label(60) == "HIGH"
    assert get_priority_label(40) == "MEDIUM"
    assert get_priority_label(20) == "LOW"


def test_score_breakdown_sums_correctly():
    breakdown = get_score_breakdown(severity=4, days_overdue=15, train_density=0.7)
    components = breakdown["breakdown"]
    total_from_parts = sum(v["contribution"] for v in components.values())
    assert abs(total_from_parts - breakdown["total_score"]) < 0.01
