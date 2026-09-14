import pandas as pd
import random
from typing import List, Dict

def load_real_timetable(csv_path: str = "data/raw/train_schedule.csv") -> pd.DataFrame:
    """
    Loads the real Indian Railways timetable.
    """
    # Using quotechar="'" to handle values like '00851'
    df = pd.read_csv(csv_path, quotechar="'")
    # Clean up column names by stripping whitespace
    df.columns = [c.strip() for c in df.columns]
    
    # Clean string columns
    for col in ['Train No.', 'train Name', 'Departure time', 'Arrival time']:
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
