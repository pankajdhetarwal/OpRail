"""app/schemas/block_window.py"""
from pydantic import BaseModel


class BlockWindowOut(BaseModel):
    id: int
    section_id: int
    schedule_date: str
    start_time: str
    end_time: str
    duration_minutes: int
    is_available: bool
    corridor_id: str | None
    window_type: str

    model_config = {"from_attributes": True}
