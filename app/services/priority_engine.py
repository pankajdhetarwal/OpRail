"""
app/services/priority_engine.py — V1: Weighted Formula Priority Engine
=======================================================================
OpRail | SIH 2026 | PS-26027

V1 (this file): transparent, explainable weighted formula.
V2 (priority_engine_v2.py): XGBoost model trained on V1-labeled data.

Why V1 first?
  - Ships immediately — no training data needed
  - Fully explainable — judges can see the weights
  - V2 is additive, not a replacement
  - As Claude noted: if your labels come from this formula,
    XGBoost learns a smoothed version of it, NOT independent ground truth.
    Say so in your PPT — that's the honest, defensible position.

Feature weights (configurable via .env):
  SEVERITY_WEIGHT        = 0.40  (safety first)
  OVERDUE_WEIGHT         = 0.30  (urgency from CAG audit findings)
  TRAIN_DENSITY_WEIGHT   = 0.15  (impact on operations)
  ASSET_CRITICALITY_WEIGHT = 0.15 (strategic importance of section)
"""
from app.core.config import settings


def compute_priority_score(
    severity: int,
    days_overdue: int,
    train_density: float,
    asset_criticality: int = 3,
) -> float:
    """
    Compute a 0-100 priority score for a maintenance task.

    Args:
        severity: 1-5 (5 = most critical / safety-critical)
        days_overdue: days past the scheduled maintenance date
        train_density: 0.0-1.0, busy-ness of this section (from COA)
        asset_criticality: 1-5, strategic importance of the railway section

    Returns:
        float: 0-100 priority score (higher = more urgent)
    """
    # Normalize inputs to 0-1 range
    norm_severity = min(max(severity, 0), 5) / 5

    # Overdue: caps at 60 days for normalization
    # Grounded in CAG audit: tasks overdue > 30 days are high-risk
    norm_overdue = min(days_overdue / 60, 1.0)

    norm_density = min(max(train_density, 0.0), 1.0)

    norm_criticality = min(max(asset_criticality, 1), 5) / 5

    score = (
        settings.SEVERITY_WEIGHT * norm_severity
        + settings.OVERDUE_WEIGHT * norm_overdue
        + settings.TRAIN_DENSITY_WEIGHT * norm_density
        + settings.ASSET_CRITICALITY_WEIGHT * norm_criticality
    )

    return round(score * 100, 2)


def get_priority_label(score: float) -> str:
    """Human-readable priority label for UI display."""
    if score >= 75:
        return "CRITICAL"
    elif score >= 55:
        return "HIGH"
    elif score >= 35:
        return "MEDIUM"
    else:
        return "LOW"


def get_score_breakdown(
    severity: int,
    days_overdue: int,
    train_density: float,
    asset_criticality: int = 3,
) -> dict:
    """
    Return a detailed breakdown of how the score was computed.
    Used by the explainability panel in the frontend.
    """
    norm_severity = min(max(severity, 0), 5) / 5
    norm_overdue = min(days_overdue / 60, 1.0)
    norm_density = min(max(train_density, 0.0), 1.0)
    norm_criticality = min(max(asset_criticality, 1), 5) / 5

    severity_contribution = settings.SEVERITY_WEIGHT * norm_severity * 100
    overdue_contribution = settings.OVERDUE_WEIGHT * norm_overdue * 100
    density_contribution = settings.TRAIN_DENSITY_WEIGHT * norm_density * 100
    criticality_contribution = settings.ASSET_CRITICALITY_WEIGHT * norm_criticality * 100
    total = severity_contribution + overdue_contribution + density_contribution + criticality_contribution

    return {
        "total_score": round(total, 2),
        "label": get_priority_label(total),
        "breakdown": {
            "severity": {
                "raw": severity,
                "normalized": round(norm_severity, 3),
                "weight": settings.SEVERITY_WEIGHT,
                "contribution": round(severity_contribution, 2),
            },
            "overdue": {
                "raw_days": days_overdue,
                "normalized": round(norm_overdue, 3),
                "weight": settings.OVERDUE_WEIGHT,
                "contribution": round(overdue_contribution, 2),
            },
            "train_density": {
                "raw": train_density,
                "normalized": round(norm_density, 3),
                "weight": settings.TRAIN_DENSITY_WEIGHT,
                "contribution": round(density_contribution, 2),
            },
            "asset_criticality": {
                "raw": asset_criticality,
                "normalized": round(norm_criticality, 3),
                "weight": settings.ASSET_CRITICALITY_WEIGHT,
                "contribution": round(criticality_contribution, 2),
            },
        },
    }
