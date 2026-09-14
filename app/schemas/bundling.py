from pydantic import BaseModel
from typing import List, Optional

class TaskScheduleInput(BaseModel):
    task_id: int
    section: str
    start_minute: int
    end_minute: int

class BundleCandidatesRequest(BaseModel):
    tasks: List[TaskScheduleInput]

class BundleCandidate(BaseModel):
    section: str
    task_ids: List[int]
    bundle_duration_minutes: int
    downtime_saved_minutes: int

class BundleCandidatesResponse(BaseModel):
    method_used: str
    bundles: List[BundleCandidate]
