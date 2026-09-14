"""
OpRail IoT Sensor Simulator
=============================
This script mimics a live hardware sensor reporting a critical failure to the TDMS system.
It hits the `/api/tdms/simulate-fault` endpoint which injects a task into the database.
"""
import time
import requests
import random
from colorama import Fore, Style, init

init(autoreset=True)

API_URL = "http://127.0.0.1:8000/api/tdms/simulate-fault"

print(f"{Fore.CYAN}OpRail IoT Sensor Simulator Active{Style.RESET_ALL}")
print("Monitoring OHE telemetry...\n")

def simulate():
    try:
        # Wait a random time between 5 and 15 seconds to simulate a live event
        wait_time = random.randint(5, 15)
        print(f"[{time.strftime('%H:%M:%S')}] Telemetry nominal. Next scan in {wait_time}s...")
        time.sleep(wait_time)
        
        print(f"{Fore.RED}[{time.strftime('%H:%M:%S')}] ANOMALY DETECTED: Voltage drop on OHE line!{Style.RESET_ALL}")
        print("Transmitting fault data to TDMS API...")
        
        response = requests.post(API_URL)
        if response.status_code == 200:
            data = response.json()
            print(f"{Fore.GREEN}Fault registered successfully.{Style.RESET_ALL}")
            print(f"  Task Code: {data.get('task_code')}")
            print(f"  Section: {data.get('section')}")
            print(f"  AI Priority Score: {data.get('ai_priority_score')}\n")
        else:
            print(f"{Fore.YELLOW}API Error: {response.status_code}{Style.RESET_ALL}\n")
            
    except requests.exceptions.ConnectionError:
        print(f"{Fore.RED}Cannot connect to server. Is FastAPI running on port 8000?{Style.RESET_ALL}\n")
        time.sleep(5)

if __name__ == "__main__":
    try:
        while True:
            simulate()
    except KeyboardInterrupt:
        print("\nSimulator shut down.")
