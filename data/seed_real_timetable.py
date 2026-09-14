import pandas as pd
import random
from typing import List, Dict

import os

def load_real_timetable(csv_path: str = "data/raw/train_schedule.csv") -> pd.DataFrame:
    """
    Loads the real Indian Railways timetable.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Real timetable data not found at {csv_path}. "
            "Please download it according to the instructions in data/README.md "
            "and place it in data/raw/ before running this."
        )

    # Using quotechar="'" to handle values like '00851'
    df = pd.read_csv(csv_path, quotechar="'", dtype=str)
    # Clean up column names by stripping whitespace
    df.columns = [c.strip() for c in df.columns]
    
    # Clean string columns
    for col in ['Train No.', 'train Name', 'Departure time', 'Arrival time', 'station Code', 'Station Name']:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.replace("'", "")
            
    return df


def get_real_trains(df: pd.DataFrame) -> List[Dict]:
    """
    Extracts unique trains and their first departure time from the dataset.
    Returns a list of dicts with 'train_no', 'train_name', and 'departure_time'.
    """
    # Sort by islno (stop number) to get the first departure
    df_sorted = df.sort_values('islno')
    
    # Get the first stop for each train
    first_stops = df_sorted.drop_duplicates(subset=['Train No.'])
    
    trains = []
    for _, row in first_stops.iterrows():
        train_no = str(row['Train No.'])
        # Pad train no to 5 digits if it's numeric and less than 5
        if train_no.isdigit() and len(train_no) < 5:
            train_no = train_no.zfill(5)
            
        # Time format in CSV is usually HH:MM:SS, we want HH:MM
        dep_time = row['Departure time']
        if len(dep_time) >= 5:
            dep_time = dep_time[:5]
        else:
            dep_time = "00:00"
            
        trains.append({
            "train_no": train_no,
            "train_name": str(row['train Name']),
            "departure_time": dep_time
        })
        
    return trains


def _time_to_minutes(time_str: str) -> int:
    """Convert 'HH:MM:SS' or 'HH:MM' to minutes from midnight."""
    if not time_str or time_str.lower() in ["nan", "none", ""]:
        return 0
    parts = time_str.split(":")
    if len(parts) >= 2:
        return int(parts[0]) * 60 + int(parts[1])
    return 0

def compute_section_train_density(df: pd.DataFrame, station_code: str, start_time_str: str, end_time_str: str) -> Dict:
    """
    Given the loaded timetable, a station code, and a time window, 
    return real train count/timing for that window.
    """
    # Filter for the specific station
    station_df = df[df['station Code'] == station_code]
    
    start_mins = _time_to_minutes(start_time_str)
    end_mins = _time_to_minutes(end_time_str)
    
    trains_in_window = []
    
    for _, row in station_df.iterrows():
        arr_time = row.get('Arrival time', '')
        dep_time = row.get('Departure time', '')
        
        # If it's a source station, it may only have departure time
        # If destination, only arrival. Use whichever is valid, or both.
        arr_mins = _time_to_minutes(arr_time) if arr_time != "00:00:00" else None
        dep_mins = _time_to_minutes(dep_time) if dep_time != "00:00:00" else None
        
        # Determine if train falls in window
        in_window = False
        if arr_mins is not None and (start_mins <= arr_mins <= end_mins):
            in_window = True
        if dep_mins is not None and (start_mins <= dep_mins <= end_mins):
            in_window = True
            
        if in_window:
            trains_in_window.append({
                "train_no": row['Train No.'],
                "arrival_time": arr_time,
                "departure_time": dep_time
            })
            
    return {
        "station": station_code,
        "window": f"{start_time_str} - {end_time_str}",
        "train_count": len(trains_in_window),
        "trains": trains_in_window
    }
