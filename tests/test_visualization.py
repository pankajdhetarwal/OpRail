import pytest
from fastapi.testclient import TestClient
import pandas as pd
import tempfile
import os

from app.main import app
from data.seed_real_timetable import load_real_timetable

client = TestClient(app)

@pytest.fixture
def mock_csv(monkeypatch):
    # Create a small fake CSV 
    csv_content = (
        "Train No.,train Name,islno,station Code,Station Name,Arrival time,Departure time,Distance,Source Station Code,source Station Name,Destination station Code,Destination Station Name\n"
        "'00851',BNC SUVIDHA SPL,1,BBS,BHUBANESWAR,'00:00:00','22:50:00',0,BBS,BHUBANESWAR,BNC,BANGALORE CANT\n"
        "'00851',BNC SUVIDHA SPL,2,BAM,BRAHMAPUR,'01:10:00','01:12:00',166,BBS,BHUBANESWAR,BNC,BANGALORE CANT\n"
        "'19037',AVADH EXPRESS,1,BAM,BRAHMAPUR,'10:00:00','10:10:00',0,BAM,BRAHMAPUR,GAYA,GAYA JN\n"
    )
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as tmp:
        tmp.write(csv_content)
        tmp_path = tmp.name
        
    # Monkeypatch the get_timetable function in visualization.py to load this CSV
    from app.api.routes import visualization
    
    # Pre-load it into cache
    visualization._TIMETABLE_CACHE = load_real_timetable(tmp_path)
    
    yield tmp_path
    
    os.unlink(tmp_path)
    visualization._TIMETABLE_CACHE = None

def test_time_space_endpoint(mock_csv):
    response = client.get("/api/visualization/time-space?section=BAM")
    assert response.status_code == 200
    data = response.json()
    
    assert "trains" in data
    assert "blocks" in data
    
    trains = data["trains"]
    # BAM should match both trains
    assert len(trains) == 2
    
    train_00851 = next(t for t in trains if t["train_number"] == "00851")
    points_00851 = train_00851["points"]
    assert len(points_00851) == 2
    
    # Assert sorted chronologically by time
    assert points_00851[0]["station"] == "BBS"
    assert points_00851[0]["minute"] == 1370 # 22:50 * 60 = 1370
    
    assert points_00851[1]["station"] == "BAM"
    # 01:12 is next day, so 1 * 60 + 12 = 72. 
    # But because of our chronological logic (72 < 1370), it adds 1440
    assert points_00851[1]["minute"] == 1512 

    # Check block
    blocks = data["blocks"]
    assert len(blocks) == 1
    assert blocks[0]["start_station"] == "BAM"
    assert blocks[0]["end_station"] == "BAM_END"
    
