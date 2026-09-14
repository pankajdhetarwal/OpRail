"""
app/services/priority_engine_v2.py — XGBoost Priority Engine
=============================================================
OpRail | SIH 2026 | PS-26027

Drop-in replacement for priority_engine.py compute_priority_score().
Loads the pre-trained XGBoost model from models/priority_model.pkl.
Falls back to V1 formula if model file not found (safe default).
"""
import os
import pickle
from typing import Optional

# V1 fallback
from app.services.priority_engine import (
    compute_priority_score as v1_score,
    get_priority_label,
    get_score_breakdown,
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "models", "priority_model.pkl")

_model_artifact: Optional[dict] = None


def _load_model() -> Optional[dict]:
    global _model_artifact
    if _model_artifact is not None:
        return _model_artifact
    abs_path = os.path.abspath(MODEL_PATH)
    if os.path.exists(abs_path):
        with open(abs_path, "rb") as f:
            _model_artifact = pickle.load(f)
        print(f"✅ XGBoost priority model loaded from {abs_path}")
    else:
        print(f"⚠️  XGBoost model not found at {abs_path} — using V1 formula fallback")
    return _model_artifact


def compute_priority_score_v2(
    severity: int,
    days_overdue: int,
    train_density: float,
    asset_criticality: int = 3,
    is_safety_critical: bool = False,
    requires_ohe_disconnection: bool = False,
    duration_minutes: int = 60,
) -> float:
    """
    XGBoost-based priority score (V2).
    Falls back to V1 formula if model not trained yet.
    """
    artifact = _load_model()
    if artifact is None:
        return v1_score(severity, days_overdue, train_density, asset_criticality)

    model = artifact["model"]
    features = [[
        severity,
        days_overdue,
        train_density,
        asset_criticality,
        int(is_safety_critical or severity >= 4),
        int(requires_ohe_disconnection),
        duration_minutes / 180.0,
    ]]

    score = float(model.predict(features)[0])
    return round(max(0.0, min(score, 100.0)), 2)


def get_shap_explanation(
    severity: int,
    days_overdue: int,
    train_density: float,
    asset_criticality: int = 3,
    is_safety_critical: bool = False,
    requires_ohe_disconnection: bool = False,
    duration_minutes: int = 60,
) -> dict:
    """
    Return SHAP feature importances for a single task's prediction.
    Used by the 'Why this priority?' panel in the frontend.
    """
    artifact = _load_model()
    if artifact is None:
        return get_score_breakdown(severity, days_overdue, train_density, asset_criticality)

    try:
        import shap
        import pandas as pd
        model = artifact["model"]
        feature_names = artifact["feature_names"]

        X = pd.DataFrame([[
            severity, days_overdue, train_density, asset_criticality,
            int(is_safety_critical or severity >= 4),
            int(requires_ohe_disconnection),
            duration_minutes / 180.0,
        ]], columns=feature_names)

        # Use raw booster to avoid SHAP 0.46 / XGBoost 3.x base_score incompatibility
        explainer = shap.TreeExplainer(model.get_booster())
        shap_vals = explainer.shap_values(X)[0]

        return {
            "shap_values": dict(zip(feature_names, [round(float(v), 3) for v in shap_vals])),
            "global_importance": artifact.get("shap_importance", {}),
            "model_version": "v2_xgboost",
        }
    except Exception as e:
        # Fallback: return global importance from saved artifact metadata
        return {
            "error": str(e),
            "global_importance": artifact.get("shap_importance", {}),
            "fallback": get_score_breakdown(severity, days_overdue, train_density, asset_criticality),
        }
