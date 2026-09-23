"""
app/services/priority_engine_v2.py — XGBoost Priority Engine
=============================================================
OpRail | SIH 2026 | PS-26027

Drop-in replacement for priority_engine.py compute_priority_score().

Loads the pre-trained XGBoost model from models/priority_model.pkl.

SHAP explainability:
- Uses XGBoost's native pred_contribs=True TreeSHAP implementation.
- Avoids SHAP/XGBoost base_score compatibility issues.
- Returns per-task feature contributions.
- Falls back safely to the V1 score breakdown if explanation fails.
"""

import os
import pickle
from typing import Optional

import pandas as pd

# V1 fallback
from app.services.priority_engine import (
    compute_priority_score as v1_score,
    get_score_breakdown,
)


MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "models",
    "priority_model.pkl",
)

_model_artifact: Optional[dict] = None


def _load_model() -> Optional[dict]:
    """Load the trained XGBoost model artifact once."""

    global _model_artifact

    if _model_artifact is not None:
        return _model_artifact

    abs_path = os.path.abspath(MODEL_PATH)

    if os.path.exists(abs_path):
        with open(abs_path, "rb") as f:
            _model_artifact = pickle.load(f)

        print(
            f"[OK] XGBoost priority model loaded from {abs_path}"
        )

    else:
        print(
            f"[WARN] XGBoost model not found at {abs_path} "
            "-- using V1 formula fallback"
        )

    return _model_artifact


def _build_features(
    severity: int,
    days_overdue: int,
    train_density: float,
    asset_criticality: int,
    is_safety_critical: bool,
    requires_ohe_disconnection: bool,
    duration_minutes: int,
):
    """
    Build the exact feature vector used by the trained XGBoost model.

    IMPORTANT:
    Keep this feature order synchronized with
    artifact["feature_names"].
    """

    return [
        severity,
        days_overdue,
        train_density,
        asset_criticality,
        int(is_safety_critical or severity >= 4),
        int(requires_ohe_disconnection),
        duration_minutes / 180.0,
    ]


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

    Falls back to V1 formula if the model is not available.
    """

    artifact = _load_model()

    # -------------------------------------------------------------
    # V1 fallback
    # -------------------------------------------------------------

    if artifact is None:
        return v1_score(
            severity,
            days_overdue,
            train_density,
            asset_criticality,
        )

    # -------------------------------------------------------------
    # Build model input
    # -------------------------------------------------------------

    model = artifact["model"]
    feature_names = artifact["feature_names"]

    features = _build_features(
        severity=severity,
        days_overdue=days_overdue,
        train_density=train_density,
        asset_criticality=asset_criticality,
        is_safety_critical=is_safety_critical,
        requires_ohe_disconnection=requires_ohe_disconnection,
        duration_minutes=duration_minutes,
    )

    # Use the same named feature structure as the
    # explainability path.
    X = pd.DataFrame(
        [features],
        columns=feature_names,
    )

    score = float(model.predict(X)[0])

    # Keep score within the application's 0-100 range.
    return round(
        max(0.0, min(score, 100.0)),
        2,
    )


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
    Return per-task TreeSHAP feature contributions.

    Uses XGBoost's native pred_contribs=True implementation
    instead of shap.TreeExplainer.

    This avoids compatibility problems with newer XGBoost
    models whose base_score can be stored as a vector.

    The returned structure contains:

        shap_values
        global_importance
        model_version
        bias
        prediction
        contribution_sum

    The final XGBoost contribution is the bias/base value.

    Feature contributions + bias should reconstruct the
    model prediction.
    """

    artifact = _load_model()

    # -------------------------------------------------------------
    # V1 fallback if model is unavailable
    # -------------------------------------------------------------

    if artifact is None:
        return get_score_breakdown(
            severity,
            days_overdue,
            train_density,
            asset_criticality,
        )

    try:
        # Import inside the function so the main application can
        # still start cleanly if XGBoost is unavailable.
        import xgboost as xgb

        model = artifact["model"]
        feature_names = artifact["feature_names"]

        # ---------------------------------------------------------
        # Build the exact feature vector
        # ---------------------------------------------------------

        features = _build_features(
            severity=severity,
            days_overdue=days_overdue,
            train_density=train_density,
            asset_criticality=asset_criticality,
            is_safety_critical=is_safety_critical,
            requires_ohe_disconnection=requires_ohe_disconnection,
            duration_minutes=duration_minutes,
        )

        # ---------------------------------------------------------
        # Create XGBoost DMatrix
        # ---------------------------------------------------------
        #
        # IMPORTANT:
        # model.get_booster().predict() with pred_contribs=True
        # requires an xgboost.DMatrix.
        #
        # Passing a pandas DataFrame directly causes:
        #
        # "Expecting data to be a DMatrix object"
        #
        # ---------------------------------------------------------

        X = pd.DataFrame(
            [features],
            columns=feature_names,
        )

        X_dmatrix = xgb.DMatrix(
            X,
            feature_names=feature_names,
        )

        # ---------------------------------------------------------
        # Native XGBoost TreeSHAP
        # ---------------------------------------------------------

        booster = model.get_booster()

        shap_matrix = booster.predict(
            X_dmatrix,
            pred_contribs=True,
        )

        # One row because we are explaining one task.
        shap_row = shap_matrix[0]

        # XGBoost returns N feature contributions + 1 bias value.
        feature_values = shap_row[:-1]
        bias_value = shap_row[-1]

        # ---------------------------------------------------------
        # Convert SHAP contributions into a clean dictionary
        # ---------------------------------------------------------

        shap_values = {
            feature_name: round(float(value), 6)
            for feature_name, value in zip(
                feature_names,
                feature_values,
            )
        }

        # ---------------------------------------------------------
        # Calculate the model prediction independently
        # ---------------------------------------------------------

        prediction = float(
            model.predict(X)[0]
        )

        # ---------------------------------------------------------
        # Validate TreeSHAP decomposition
        # ---------------------------------------------------------
        #
        # For XGBoost:
        #
        # feature contributions + bias ≈ prediction
        #
        # This value is useful for debugging and UI validation.
        # ---------------------------------------------------------

        contribution_sum = float(
            feature_values.sum() + bias_value
        )

        # ---------------------------------------------------------
        # Return explainability payload
        # ---------------------------------------------------------

        return {
            "shap_values": shap_values,

            "global_importance": artifact.get(
                "shap_importance",
                {},
            ),

            "model_version": "v2_xgboost",

            "bias": round(
                float(bias_value),
                6,
            ),

            "prediction": round(
                prediction,
                6,
            ),

            "contribution_sum": round(
                contribution_sum,
                6,
            ),
        }

    except Exception as e:
        # ---------------------------------------------------------
        # Safe fallback
        # ---------------------------------------------------------
        #
        # Explainability failure must NOT break the task system.
        # The normal priority score remains available.
        # ---------------------------------------------------------

        return {
            "error": str(e),

            "global_importance": artifact.get(
                "shap_importance",
                {},
            ),

            "fallback": get_score_breakdown(
                severity,
                days_overdue,
                train_density,
                asset_criticality,
            ),
        }