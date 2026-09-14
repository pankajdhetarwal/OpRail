from pydantic import BaseModel
from typing import List

class TrainPoint(BaseModel):
    station: str
    minute: int

class TrainPath(BaseModel):
    train_number: str
    points: List[TrainPoint]

class MaintenanceBlockViz(BaseModel):
    start_station: str
    end_station: str
    start_minute: int
    end_minute: int

class TimeSpaceDiagramResponse(BaseModel):
    trains: List[TrainPath]
    blocks: List[MaintenanceBlockViz]
