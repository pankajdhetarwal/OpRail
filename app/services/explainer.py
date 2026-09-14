"""
app/services/explainer.py — "Why This Block?" Explanation Generator
====================================================================
OpRail | SIH 2026 | PS-26027

Generates plain-English explanations for each scheduled block.
Two modes:
  1. Templated (always works, no API): builds explanation from task data
  2. Gemini API (when GEMINI_API_KEY is set): richer, more natural language

The explanation is shown in the "Why This Block?" panel in the dashboard —
a key differentiator that makes the AI's decisions transparent and auditable.
"""
from typing import Dict, List, Optional

from app.core.config import settings


def generate_why_explanation(
    section,
    task_ids: List[int],
    tasks: Dict,   # task_id → MaintenanceTask ORM object
    dept_codes: List[str],
    is_joint: bool,
    start_time: str,
    efficiency: float,
) -> str:
    """
    Generate a human-readable explanation for why this block was scheduled.
    Tries Gemini API first; falls back to template if API unavailable.
    """
    # Build structured context
    task_objects = [tasks[tid] for tid in task_ids if tid in tasks]
    if not task_objects:
        return "Block scheduled based on optimization."

    critical_count = sum(1 for t in task_objects if t.safety_critical)
    overdue_count = sum(1 for t in task_objects if t.days_overdue > 0)
    max_overdue = max((t.days_overdue for t in task_objects), default=0)
    avg_severity = sum(t.severity for t in task_objects) / max(len(task_objects), 1)

    context = {
        "section_name": section.name,
        "start_time": start_time,
        "num_tasks": len(task_ids),
        "dept_codes": dept_codes,
        "is_joint": is_joint,
        "critical_count": critical_count,
        "overdue_count": overdue_count,
        "max_overdue": max_overdue,
        "avg_severity": round(avg_severity, 1),
        "efficiency": efficiency,
        "train_density": section.train_density,
    }

    if settings.gemini_enabled:
        try:
            return _gemini_explanation(context)
        except Exception:
            pass  # fall through to template

    return _templated_explanation(context)


def _templated_explanation(ctx: dict) -> str:
    """Build a structured explanation from templates."""
    reasons = []

    # Primary reason: criticality
    if ctx["critical_count"] > 0:
        reasons.append(
            f"✓ {ctx['critical_count']} safety-critical task(s) require immediate attention "
            f"(avg severity {ctx['avg_severity']}/5)"
        )

    # Urgency: overdue tasks
    if ctx["overdue_count"] > 0:
        reasons.append(
            f"✓ {ctx['overdue_count']} overdue task(s) — "
            f"longest overdue by {ctx['max_overdue']} days (CAG audit threshold: >30 days = risk)"
        )

    # Joint block benefit
    if ctx["is_joint"]:
        dept_str = " + ".join(ctx["dept_codes"])
        reasons.append(
            f"✓ Joint block: {dept_str} departments coordinated in one window — "
            f"reduces total downtime vs. separate blocks"
        )

    # Train traffic
    density_pct = round(ctx["train_density"] * 100)
    if ctx["train_density"] < 0.6:
        reasons.append(
            f"✓ Low train density on this section ({density_pct}%) — "
            f"maintenance window has minimal impact on train operations"
        )
    else:
        reasons.append(
            f"✓ Window selected to avoid high-traffic hours "
            f"({density_pct}% density section — night block minimizes disruption)"
        )

    # Efficiency
    reasons.append(f"✓ Block efficiency: {ctx['efficiency']}% of window time used for productive maintenance")

    header = (
        f"Block: {ctx['section_name']} at {ctx['start_time']}\n"
        f"Tasks: {ctx['num_tasks']} | Departments: {', '.join(ctx['dept_codes'])}\n\n"
        f"AI Recommendation Reasons:\n"
    )

    return header + "\n".join(reasons)


def _gemini_explanation(ctx: dict) -> str:
    """Use Gemini API to generate a natural-language explanation."""
    from google import genai

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    prompt = f"""
You are an AI assistant for Indian Railways maintenance planning (OpRail system).
Explain in 3-4 concise bullet points WHY the following maintenance block was selected by the optimization engine.
Be specific, professional, and use railway domain terminology.

Block details:
- Section: {ctx['section_name']}
- Scheduled time: {ctx['start_time']}
- Departments: {', '.join(ctx['dept_codes'])}
- Joint block (multiple depts): {ctx['is_joint']}
- Number of tasks: {ctx['num_tasks']}
- Safety-critical tasks: {ctx['critical_count']}
- Overdue tasks: {ctx['overdue_count']} (max {ctx['max_overdue']} days overdue)
- Average severity: {ctx['avg_severity']}/5
- Section train density: {ctx['train_density']:.0%}
- Block efficiency: {ctx['efficiency']}%

Start each bullet with ✓. Be concise (max 80 words total).
"""
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    return f"Block: {ctx['section_name']} at {ctx['start_time']}\n\nAI Analysis:\n{response.text}"
