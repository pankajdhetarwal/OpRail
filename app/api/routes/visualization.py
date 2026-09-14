from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.schemas.visualization import TimeSpaceDiagramResponse, TrainPath, TrainPoint, MaintenanceBlockViz
from data.seed_real_timetable import load_real_timetable, _time_to_minutes
import pandas as pd
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Cache the dataframe so we don't load 8MB repeatedly
_TIMETABLE_CACHE = None

def get_timetable() -> pd.DataFrame:
    global _TIMETABLE_CACHE
    if _TIMETABLE_CACHE is None:
        try:
            _TIMETABLE_CACHE = load_real_timetable()
        except FileNotFoundError as e:
            logger.error(str(e))
            raise HTTPException(status_code=500, detail=str(e))
    return _TIMETABLE_CACHE

@router.get("/time-space", response_model=TimeSpaceDiagramResponse)
def get_time_space_data(
    section: str = Query(..., description="The section name or stations involved, e.g., 'Gaya-Patna' or 'BBS'"),
    date: Optional[str] = Query(None, description="Optional date filter")
):
    """
    Returns data needed by frontend to draw a time-space diagram.
    """
    df = get_timetable()
    
    # We define "touching this section" loosely: 
    # If the section contains a dash, split it and check both stations.
    # Otherwise, check if section is present in station code.
    if "-" in section:
        st1, st2 = section.split("-", 1)
        st1 = st1.strip().upper()
        st2 = st2.strip().upper()
        # Find trains that pass through either of these stations
        matching_trains = df[(df['station Code'].str.contains(st1, na=False)) | (df['station Code'].str.contains(st2, na=False))]['Train No.'].unique()
    else:
        sec = section.strip().upper()
        matching_trains = df[df['station Code'].str.contains(sec, na=False)]['Train No.'].unique()
        
    trains_list = []
    
    for train_no in matching_trains:
        train_df = df[df['Train No.'] == train_no].sort_values('islno')
        
        points = []
        for _, row in train_df.iterrows():
            st_code = row['station Code']
            
            # Arrival or departure time
            arr_time = row.get('Arrival time', '00:00:00')
            dep_time = row.get('Departure time', '00:00:00')
            
            # Prefer departure, fallback to arrival
            time_to_use = dep_time if dep_time != '00:00:00' else arr_time
            if pd.isna(time_to_use):
                time_to_use = '00:00:00'
                
            mins = _time_to_minutes(time_to_use)
            
            # A train can't move backward in time in a day, if it wraps past midnight 
            # we need to add 1440. A simple heuristic:
            if points and mins < points[-1].minute:
                mins += 1440
                
            points.append(TrainPoint(station=st_code, minute=mins))
            
        trains_list.append(TrainPath(train_number=str(train_no), points=points))
        
    # Mocking block schedule from optimizer output for this section
    # In a real scenario, this would query the DB for Scheduled Blocks on this section
    blocks = []
    if "BBS" in section.upper() or "BNC" in section.upper():
         blocks.append(MaintenanceBlockViz(
             start_station="BBS",
             end_station="BNC",
             start_minute=60,
             end_minute=120
         ))
    elif "-" in section:
        st1, st2 = section.split("-", 1)
        blocks.append(MaintenanceBlockViz(
             start_station=st1.strip().upper(),
             end_station=st2.strip().upper(),
             start_minute=100,
             end_minute=200
         ))
    else:
         blocks.append(MaintenanceBlockViz(
             start_station=section.strip().upper(),
             end_station=section.strip().upper() + "_END",
             start_minute=120,
             end_minute=180
         ))

    return TimeSpaceDiagramResponse(trains=trains_list, blocks=blocks)
