"""
data/generate_synthetic_data.py
=================================
OpRail — Synthetic Data Generator
SIH 2026 | PS-26027

Generates realistic railway maintenance data grounded in:
- CAG 2022 audit: ~1/3 of 1024 derailments (2018-21) traced to track defects
- CAG compliance audit: some ballast/maintenance backlogs 1-22 years overdue
- Real Indian Railways Northern/Western/Central Zones

Run from project root:
    python data/generate_synthetic_data.py

This seeds the database directly (SQLAlchemy ORM).
"""

import os
import random
import sys
from datetime import date, datetime, timedelta

# ── make sure project root is on sys.path ──────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.orm import Session
from data.seed_real_timetable import load_real_timetable, get_real_trains

from app.core.database import SessionLocal, create_all_tables
from app.models import (
    BlockWindow, Department, GeneratedBlock, MaintenanceTask,
    RailwaySection, Resource, TrainSchedule,
)
from app.models.maintenance_task import TaskStatus, TaskType
from app.models.train_schedule import TrainPriority, TrainType

# ─────────────────────────────────────────────────────────────────────────────
# Seed constants
# ─────────────────────────────────────────────────────────────────────────────
random.seed(42)   # reproducible

NUM_SECTIONS = 30       # railway sections
NUM_TASKS_ENG = 150     # Engineering tasks (TMS)
NUM_TASKS_ST = 120      # S&T tasks (SMMS)
NUM_TASKS_OHE = 80      # Traction/OHE tasks (TDMS)
NUM_TRAINS_PER_SECTION_PER_DAY = 20
SCHEDULE_DAYS = 14      # generate 2 weeks of train schedule


# ─────────────────────────────────────────────────────────────────────────────
# Static reference data
# ─────────────────────────────────────────────────────────────────────────────

DEPARTMENTS = [
    {"code": "ENG", "name": "Engineering", "source_system": "TMS", "color_hex": "#f59e0b"},
    {"code": "ST",  "name": "Signal & Telecommunication", "source_system": "SMMS", "color_hex": "#3b82f6"},
    {"code": "OHE", "name": "Traction / OHE", "source_system": "TDMS", "color_hex": "#10b981"},
]

# Real Indian Railway sections (approximate geo-coordinates included)
SECTION_TEMPLATES = [
    {"code":"NR-DLI-GZB-01","name":"Delhi–Ghaziabad","zone":"NR","division":"Delhi",
     "from_station":"Delhi","to_station":"Ghaziabad","length_km":22.5,
     "criticality_level":5,"train_density":0.92,
     "lat_start":28.6139,"lon_start":77.2090,"lat_end":28.6692,"lon_end":77.4538},
    {"code":"NR-GZB-MBZ-02","name":"Ghaziabad–Moradabad","zone":"NR","division":"Moradabad",
     "from_station":"Ghaziabad","to_station":"Moradabad","length_km":90.0,
     "criticality_level":4,"train_density":0.75,
     "lat_start":28.6692,"lon_start":77.4538,"lat_end":28.8386,"lon_end":78.7733},
    {"code":"NR-CNB-ALD-03","name":"Kanpur–Prayagraj","zone":"NR","division":"Prayagraj",
     "from_station":"Kanpur Central","to_station":"Prayagraj Junction","length_km":196.0,
     "criticality_level":5,"train_density":0.88,
     "lat_start":26.4499,"lon_start":80.3319,"lat_end":25.4358,"lon_end":81.8463},
    {"code":"WR-BCT-BRC-04","name":"Mumbai–Vadodara","zone":"WR","division":"Mumbai",
     "from_station":"Mumbai Central","to_station":"Vadodara","length_km":392.0,
     "criticality_level":5,"train_density":0.95,
     "lat_start":18.9388,"lon_start":72.8354,"lat_end":22.3072,"lon_end":73.1812},
    {"code":"WR-BRC-RTM-05","name":"Vadodara–Ratlam","zone":"WR","division":"Vadodara",
     "from_station":"Vadodara","to_station":"Ratlam","length_km":135.0,
     "criticality_level":3,"train_density":0.60,
     "lat_start":22.3072,"lon_start":73.1812,"lat_end":23.3315,"lon_end":75.0367},
    {"code":"CR-CSTM-PUNE-06","name":"Mumbai CST–Pune","zone":"CR","division":"Mumbai",
     "from_station":"Mumbai CST","to_station":"Pune","length_km":192.0,
     "criticality_level":5,"train_density":0.90,
     "lat_start":18.9402,"lon_start":72.8358,"lat_end":18.5204,"lon_end":73.8567},
    {"code":"SR-MAS-SBC-07","name":"Chennai–Bengaluru","zone":"SR","division":"Chennai",
     "from_station":"Chennai Central","to_station":"KSR Bengaluru","length_km":362.0,
     "criticality_level":5,"train_density":0.85,
     "lat_start":13.0827,"lon_start":80.2707,"lat_end":12.9762,"lon_end":77.5929},
    {"code":"ER-HWH-ASN-08","name":"Howrah–Asansol","zone":"ER","division":"Howrah",
     "from_station":"Howrah","to_station":"Asansol","length_km":200.0,
     "criticality_level":4,"train_density":0.78,
     "lat_start":22.5958,"lon_start":88.2636,"lat_end":23.6889,"lon_end":86.9661},
    {"code":"NR-AGC-MTJ-09","name":"Agra–Mathura","zone":"NR","division":"Agra",
     "from_station":"Agra Cantt","to_station":"Mathura","length_km":55.0,
     "criticality_level":3,"train_density":0.65,
     "lat_start":27.1767,"lon_start":78.0081,"lat_end":27.4924,"lon_end":77.6737},
    {"code":"NR-NDLS-AGC-10","name":"New Delhi–Agra","zone":"NR","division":"Delhi",
     "from_station":"New Delhi","to_station":"Agra Cantt","length_km":195.0,
     "criticality_level":5,"train_density":0.93,
     "lat_start":28.6432,"lon_start":77.2197,"lat_end":27.1767,"lon_end":78.0081},
    {"code":"SCR-HYB-SC-11","name":"Hyderabad–Secunderabad","zone":"SCR","division":"Hyderabad",
     "from_station":"Hyderabad","to_station":"Secunderabad","length_km":12.0,
     "criticality_level":4,"train_density":0.80,
     "lat_start":17.3850,"lon_start":78.4867,"lat_end":17.4399,"lon_end":78.4983},
    {"code":"NR-LKO-CNB-12","name":"Lucknow–Kanpur","zone":"NR","division":"Lucknow",
     "from_station":"Lucknow","to_station":"Kanpur Central","length_km":75.0,
     "criticality_level":4,"train_density":0.72,
     "lat_start":26.8467,"lon_start":80.9462,"lat_end":26.4499,"lon_end":80.3319},
    {"code":"WR-JP-AII-13","name":"Jaipur–Ajmer","zone":"NWR","division":"Jaipur",
     "from_station":"Jaipur","to_station":"Ajmer","length_km":132.0,
     "criticality_level":3,"train_density":0.55,
     "lat_start":26.9124,"lon_start":75.7873,"lat_end":26.4499,"lon_end":74.6399},
    {"code":"ECR-PNBE-MGS-14","name":"Patna–Mughal Sarai","zone":"ECR","division":"Patna",
     "from_station":"Patna","to_station":"Pt. DD Upadhyaya Jn","length_km":250.0,
     "criticality_level":5,"train_density":0.86,
     "lat_start":25.5941,"lon_start":85.1376,"lat_end":25.2700,"lon_end":83.1053},
    {"code":"NFR-GHY-RNY-15","name":"Guwahati–Rangiya","zone":"NFR","division":"Rangiya",
     "from_station":"Guwahati","to_station":"Rangiya","length_km":72.0,
     "criticality_level":3,"train_density":0.45,
     "lat_start":26.1445,"lon_start":91.7362,"lat_end":26.4558,"lon_end":91.1638},
    {"code":"NR-AMB-LDH-16","name":"Ambala–Ludhiana","zone":"NR","division":"Ambala",
     "from_station":"Ambala Cantt","to_station":"Ludhiana","length_km":82.0,
     "criticality_level":4,"train_density":0.70,
     "lat_start":30.3765,"lon_start":76.8284,"lat_end":30.9010,"lon_end":75.8573},
    {"code":"WCR-BPL-ET-17","name":"Bhopal–Itarsi","zone":"WCR","division":"Bhopal",
     "from_station":"Bhopal","to_station":"Itarsi","length_km":90.0,
     "criticality_level":3,"train_density":0.58,
     "lat_start":23.2599,"lon_start":77.4126,"lat_end":22.6156,"lon_end":77.7614},
    {"code":"SR-CBE-TVC-18","name":"Coimbatore–Thiruvananthapuram","zone":"SR","division":"Palakkad",
     "from_station":"Coimbatore","to_station":"Thiruvananthapuram","length_km":490.0,
     "criticality_level":4,"train_density":0.68,
     "lat_start":11.0168,"lon_start":76.9558,"lat_end":8.5241,"lon_end":76.9366},
    {"code":"CR-NGP-BPQ-19","name":"Nagpur–Balharshah","zone":"CR","division":"Nagpur",
     "from_station":"Nagpur","to_station":"Balharshah","length_km":202.0,
     "criticality_level":4,"train_density":0.62,
     "lat_start":21.1458,"lon_start":79.0882,"lat_end":19.8562,"lon_end":79.3568},
    {"code":"WR-ADI-BVC-20","name":"Ahmedabad–Bhavnagar","zone":"WR","division":"Ahmedabad",
     "from_station":"Ahmedabad","to_station":"Bhavnagar","length_km":258.0,
     "criticality_level":3,"train_density":0.50,
     "lat_start":23.0225,"lon_start":72.5714,"lat_end":21.7645,"lon_end":72.1519},
    {"code":"NR-DLI-ROK-21","name":"Delhi–Rohtak","zone":"NR","division":"Delhi",
     "from_station":"Delhi","to_station":"Rohtak","length_km":72.0,
     "criticality_level":4,"train_density":0.68,
     "lat_start":28.6139,"lon_start":77.2090,"lat_end":28.8955,"lon_end":76.5789},
    {"code":"NR-MBZ-BE-22","name":"Moradabad–Bareilly","zone":"NR","division":"Moradabad",
     "from_station":"Moradabad","to_station":"Bareilly","length_km":65.0,
     "criticality_level":3,"train_density":0.55,
     "lat_start":28.8386,"lon_start":78.7733,"lat_end":28.3670,"lon_end":79.4304},
    {"code":"ECoR-BBS-VZA-23","name":"Bhubaneswar–Vijayawada","zone":"ECoR","division":"Khurda Road",
     "from_station":"Bhubaneswar","to_station":"Vijayawada","length_km":650.0,
     "criticality_level":4,"train_density":0.73,
     "lat_start":20.2961,"lon_start":85.8245,"lat_end":16.5062,"lon_end":80.6480},
    {"code":"NCR-JHS-BINA-24","name":"Jhansi–Bina","zone":"NCR","division":"Jhansi",
     "from_station":"Jhansi","to_station":"Bina","length_km":190.0,
     "criticality_level":3,"train_density":0.57,
     "lat_start":25.4484,"lon_start":78.5685,"lat_end":23.6353,"lon_end":77.8068},
    {"code":"WR-RTM-KOTA-25","name":"Ratlam–Kota","zone":"WR","division":"Ratlam",
     "from_station":"Ratlam","to_station":"Kota","length_km":190.0,
     "criticality_level":3,"train_density":0.53,
     "lat_start":23.3315,"lon_start":75.0367,"lat_end":25.1802,"lon_end":75.8380},
    {"code":"NR-SRE-LKO-26","name":"Saharanpur–Lucknow","zone":"NR","division":"Lucknow",
     "from_station":"Saharanpur","to_station":"Lucknow","length_km":430.0,
     "criticality_level":4,"train_density":0.65,
     "lat_start":29.9675,"lon_start":77.5460,"lat_end":26.8467,"lon_end":80.9462},
    {"code":"CR-BSL-PUNE-27","name":"Bhusaval–Pune","zone":"CR","division":"Bhusaval",
     "from_station":"Bhusaval","to_station":"Pune","length_km":442.0,
     "criticality_level":4,"train_density":0.67,
     "lat_start":21.0447,"lon_start":75.7998,"lat_end":18.5204,"lon_end":73.8567},
    {"code":"SR-MAS-MS-28","name":"Chennai–Mysuru","zone":"SR","division":"Salem",
     "from_station":"Chennai Central","to_station":"Mysuru","length_km":497.0,
     "criticality_level":4,"train_density":0.70,
     "lat_start":13.0827,"lon_start":80.2707,"lat_end":12.2958,"lon_end":76.6394},
    {"code":"ECR-GYA-PNBE-29","name":"Gaya–Patna","zone":"ECR","division":"Danapur",
     "from_station":"Gaya","to_station":"Patna","length_km":100.0,
     "criticality_level":4,"train_density":0.72,
     "lat_start":24.7969,"lon_start":85.0002,"lat_end":25.5941,"lon_end":85.1376},
    {"code":"NR-ASR-DLI-30","name":"Amritsar–Delhi","zone":"NR","division":"Ferozepur",
     "from_station":"Amritsar","to_station":"Delhi","length_km":447.0,
     "criticality_level":5,"train_density":0.88,
     "lat_start":31.6340,"lon_start":74.8723,"lat_end":28.6139,"lon_end":77.2090},
][:NUM_SECTIONS]

ENG_TASK_TYPES = [t for t in TaskType if t.value in {
    "rail_replacement","sleeper_maintenance","track_inspection","ballast_cleaning","rail_crack_repair"
}]
ST_TASK_TYPES = [t for t in TaskType if t.value in {
    "signal_fault","cable_maintenance","interlocking_maintenance","signal_inspection"
}]
OHE_TASK_TYPES = [t for t in TaskType if t.value in {
    "ohe_inspection","overhead_wire_maintenance","transformer_maintenance","traction_substation"
}]

TRAIN_NAMES = [
    "Rajdhani Express","Shatabdi Express","Vande Bharat Express","Duronto Express",
    "Garib Rath","Humsafar Express","Jan Shatabdi","Intercity Express",
    "Mail Express","Passenger Special","Goods Train","Coal Express",
    "Superfast Express","Double Decker","AC Express","Freight Express",
]

TRAIN_TYPE_MAP = {
    "rajdhani": TrainType.RAJDHANI,
    "shatabdi": TrainType.SHATABDI,
    "vande_bharat": TrainType.VANDE_BHARAT,
    "express": TrainType.EXPRESS,
    "goods": TrainType.GOODS,
    "passenger": TrainType.PASSENGER,
    "mail": TrainType.MAIL,
    "local": TrainType.LOCAL,
}

TRAIN_CONFIGS = [
    # (type_key, priority, weight)  — weight controls frequency
    ("rajdhani", TrainPriority.HIGH, 5),
    ("shatabdi", TrainPriority.HIGH, 5),
    ("vande_bharat", TrainPriority.HIGH, 3),
    ("express", TrainPriority.MEDIUM, 25),
    ("mail", TrainPriority.MEDIUM, 20),
    ("goods", TrainPriority.LOW, 30),
    ("passenger", TrainPriority.LOW, 12),
]


def weighted_choice(options_with_weights):
    options, weights = zip(*[(o[:-1], o[-1]) for o in options_with_weights])
    return random.choices(options, weights=weights, k=1)[0]


def random_time_str():
    """Return HH:MM string."""
    h = random.randint(0, 23)
    m = random.choice([0, 15, 30, 45])
    return f"{h:02d}:{m:02d}"


def add_minutes_to_time(time_str: str, minutes: int) -> str:
    h, m = map(int, time_str.split(":"))
    total = h * 60 + m + minutes
    total %= 1440  # wrap at midnight
    return f"{total // 60:02d}:{total % 60:02d}"


def severity_for_task_type(task_type: TaskType, section_criticality: int) -> int:
    """
    Ground severity in realistic distributions.
    Rail cracks / signal faults are higher severity.
    Grounded in CAG audit: safety-critical defects treated as severity 4-5.
    """
    high_severity_types = {TaskType.RAIL_CRACK_REPAIR, TaskType.SIGNAL_FAULT, TaskType.INTERLOCKING_MAINTENANCE}
    medium_high_types = {TaskType.RAIL_REPLACEMENT, TaskType.OVERHEAD_WIRE_MAINTENANCE, TaskType.TRANSFORMER_MAINTENANCE}
    if task_type in high_severity_types:
        return random.choices([3, 4, 5], weights=[20, 40, 40])[0]
    elif task_type in medium_high_types:
        return random.choices([2, 3, 4, 5], weights=[15, 35, 35, 15])[0]
    else:
        base = random.choices([1, 2, 3, 4, 5], weights=[20, 30, 30, 15, 5])[0]
        # Higher criticality section → higher floor
        return max(base, max(1, section_criticality - 2))


def days_overdue_for_severity(severity: int) -> int:
    """
    CAG compliance audit found backlogs 1-22 years in some sections.
    Higher severity should not be very overdue (usually caught quickly),
    but routine tasks can accumulate. Grounded in audit findings.
    """
    if severity >= 4:
        return random.choices(range(0, 15), k=1)[0]  # critical caught quickly
    elif severity == 3:
        return random.choices(range(0, 60), k=1)[0]
    else:
        # Routine tasks — may be very overdue (CAG finding)
        return random.choices(range(0, 180), weights=[1]*30 + [2]*60 + [3]*60 + [1]*30, k=1)[0]


def seed_departments(db: Session) -> dict:
    dept_map = {}
    for d in DEPARTMENTS:
        dept = db.query(Department).filter_by(code=d["code"]).first()
        if not dept:
            dept = Department(**d)
            db.add(dept)
    db.flush()
    for d in DEPARTMENTS:
        dept_map[d["code"]] = db.query(Department).filter_by(code=d["code"]).first()
    return dept_map


def seed_sections(db: Session) -> list:
    sections = []
    for tmpl in SECTION_TEMPLATES:
        sec = db.query(RailwaySection).filter_by(code=tmpl["code"]).first()
        if not sec:
            sec = RailwaySection(**tmpl)
            db.add(sec)
    db.flush()
    for tmpl in SECTION_TEMPLATES:
        sections.append(db.query(RailwaySection).filter_by(code=tmpl["code"]).first())
    return sections


def seed_tasks(db: Session, dept_map: dict, sections: list):
    task_counter = 1

    def create_tasks(dept_code, task_types, count):
        nonlocal task_counter
        dept = dept_map[dept_code]
        for _ in range(count):
            section = random.choice(sections)
            task_type = random.choice(task_types)
            severity = severity_for_task_type(task_type, section.criticality_level)
            days_od = days_overdue_for_severity(severity)
            duration = random.choice([30, 45, 60, 90, 120, 150, 180])
            due = date.today() - timedelta(days=days_od) + timedelta(days=random.randint(-7, 14))
            status = TaskStatus.OVERDUE if days_od > 0 else TaskStatus.PENDING

            task = MaintenanceTask(
                task_code=f"{dept_code}_{task_counter:04d}",
                dept_id=dept.id,
                section_id=section.id,
                task_type=task_type,
                description=f"{task_type.value.replace('_',' ').title()} on {section.name}",
                severity=severity,
                days_overdue=days_od,
                duration_minutes=duration,
                due_date=due,
                safety_critical=(severity >= 4),
                requires_line_block=True,
                requires_ohe_disconnection=(dept_code == "OHE" and random.random() < 0.7),
                priority_score=0.0,  # computed later by priority engine
                status=status,
            )
            db.add(task)
            task_counter += 1

    create_tasks("ENG", ENG_TASK_TYPES, NUM_TASKS_ENG)
    create_tasks("ST",  ST_TASK_TYPES,  NUM_TASKS_ST)
    create_tasks("OHE", OHE_TASK_TYPES, NUM_TASKS_OHE)
    db.flush()


def seed_train_schedule(db: Session, sections: list):
    try:
        df = load_real_timetable()
        real_trains = get_real_trains(df)
        print(f"   Loaded {len(real_trains)} real trains from dataset.")
    except Exception as e:
        print(f"   Failed to load real timetable: {e}")
        real_trains = []

    today = date.today()
    for day_offset in range(SCHEDULE_DAYS):
        schedule_date = today + timedelta(days=day_offset)
        date_str = schedule_date.isoformat()

        for section in sections:
            # Number of trains proportional to train_density
            n_trains = int(NUM_TRAINS_PER_SECTION_PER_DAY * section.train_density)
            for i in range(n_trains):
                type_key, priority = weighted_choice(TRAIN_CONFIGS)
                
                if real_trains:
                    rt = random.choice(real_trains)
                    train_no = rt["train_no"]
                    train_name = rt["train_name"]
                    entry = rt["departure_time"]
                else:
                    entry = random_time_str()
                    train_no = f"{random.randint(10000, 99999)}"
                    name_pool = [n for n in TRAIN_NAMES if type_key.replace("_", " ") in n.lower() or random.random() < 0.3]
                    train_name = random.choice(name_pool) if name_pool else random.choice(TRAIN_NAMES)

                transit_minutes = int(section.length_km / random.uniform(60, 130) * 60)
                transit_minutes = max(5, min(transit_minutes, 240))
                exit_t = add_minutes_to_time(entry, transit_minutes)

                t = TrainSchedule(
                    train_no=train_no,
                    train_name=train_name,
                    section_id=section.id,
                    train_type=TRAIN_TYPE_MAP[type_key],
                    train_priority=priority,
                    entry_time=entry,
                    exit_time=exit_t,
                    schedule_date=date_str,
                    direction=random.choice(["UP", "DOWN"]),
                )
                db.add(t)
    db.flush()


def seed_block_windows(db: Session, sections: list):
    """
    Generate train-free maintenance windows.
    Night blocks: typically 22:00–05:00 split into windows.
    Some sections have shorter available windows (high density).
    """
    today = date.today()
    for day_offset in range(SCHEDULE_DAYS):
        schedule_date = (today + timedelta(days=day_offset)).isoformat()
        for section in sections:
            # Lower train density = longer window available
            if section.train_density > 0.85:
                windows = [("23:30", "01:30", 120)]
            elif section.train_density > 0.70:
                windows = [("22:30", "02:30", 240), ("03:00", "04:30", 90)]
            elif section.train_density > 0.55:
                windows = [("22:00", "04:00", 360)]
            else:
                windows = [("21:30", "05:00", 450), ("10:00", "12:00", 120)]

            for start, end, dur in windows:
                bw = BlockWindow(
                    section_id=section.id,
                    schedule_date=schedule_date,
                    start_time=start,
                    end_time=end,
                    duration_minutes=dur,
                    is_available=True,
                    corridor_id=f"CORRIDOR-{section.zone}-{section.division[:3].upper()}",
                    window_type="night_block" if int(start.split(":")[0]) >= 20 else "day_block",
                )
                db.add(bw)
    db.flush()


def seed_resources(db: Session, dept_map: dict, sections: list):
    for section in sections:
        # Engineering gangs
        n_gangs = random.randint(1, 3)
        for i in range(n_gangs):
            r = Resource(
                dept_id=dept_map["ENG"].id,
                section_id=section.id,
                name=f"Gang-{section.id:02d}{i+1}",
                resource_type="maintenance_gang",
                capacity=1,
            )
            db.add(r)
        # S&T signal squads
        sq = Resource(
            dept_id=dept_map["ST"].id,
            section_id=section.id,
            name=f"SignalSquad-{section.id:02d}",
            resource_type="signal_squad",
            capacity=1,
        )
        db.add(sq)
        # OHE teams
        if random.random() < 0.7:
            ot = Resource(
                dept_id=dept_map["OHE"].id,
                section_id=section.id,
                name=f"OHE-Team-{section.id:02d}",
                resource_type="ohe_team",
                capacity=1,
            )
            db.add(ot)
    db.flush()


def main():
    print("[OpRail] Synthetic Data Generator - SIH 2026 PS-26027")
    print("=" * 60)

    print("Creating database tables...")
    # Import all models so Base knows about them
    import app.models  # noqa — ensures all models are registered
    create_all_tables()

    db: Session = SessionLocal()
    try:
        print("Seeding departments (Engineering / S&T / OHE)...")
        dept_map = seed_departments(db)

        print(f"Seeding {NUM_SECTIONS} railway sections...")
        sections = seed_sections(db)

        total_tasks = NUM_TASKS_ENG + NUM_TASKS_ST + NUM_TASKS_OHE
        print(f"Seeding {total_tasks} maintenance tasks (ENG:{NUM_TASKS_ENG}, ST:{NUM_TASKS_ST}, OHE:{NUM_TASKS_OHE})...")
        seed_tasks(db, dept_map, sections)

        total_trains = NUM_SECTIONS * NUM_TRAINS_PER_SECTION_PER_DAY * SCHEDULE_DAYS
        print(f"Seeding ~{total_trains} train schedule entries ({SCHEDULE_DAYS} days)...")
        seed_train_schedule(db, sections)

        print(f"Seeding block windows for {SCHEDULE_DAYS} days...")
        seed_block_windows(db, sections)

        print("Seeding maintenance resources...")
        seed_resources(db, dept_map, sections)

        db.commit()

        # Print summary
        from sqlalchemy import text
        task_count = db.execute(text("SELECT COUNT(*) FROM maintenance_tasks")).scalar()
        train_count = db.execute(text("SELECT COUNT(*) FROM train_schedule")).scalar()
        window_count = db.execute(text("SELECT COUNT(*) FROM block_windows")).scalar()
        print()
        print("[OK] Database seeded successfully!")
        print(f"   Maintenance tasks : {task_count}")
        print(f"   Train movements   : {train_count}")
        print(f"   Block windows     : {window_count}")
        print()
        print("[NOTE] Data credibility note:")
        print("   Severity/overdue distributions grounded in CAG 2022 audit findings.")
        print("   CAG Report No. 22/2022: ~1/3 of 1,024 derailments (2018-21) = track defects.")
        print("   CAG compliance audit: maintenance backlogs 1–22 years in audited sections.")
        print()
        print(">> Next step: python -m uvicorn app.main:app --reload")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
