"""app/schemas/train_schedule.py"""
from pydantic import BaseModel


class TrainScheduleOut(BaseModel):
    id: int
    train_no: str
    train_name: str | None
    section_id: int
    train_type: str
    train_priority: str
    entry_time: str
    exit_time: str
    schedule_date: str
    direction: str

    model_config = {"from_attributes": True}
