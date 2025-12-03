import requests
import json
import time
import random
import csv
import sys
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# --- CONFIGURATION ---
INGEST_URL = os.getenv("INGEST_URL")

# How many specific users to simulate?
K_USERS = 5 
DELAY_SECONDS = 2

def load_k_users(filename=os.path.join(DATA_DIR, 'users.csv'), k=5):
    """Reads the first K user IDs from the CSV."""
    user_ids = []
    try:
        with open(filename, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if 'userId' in row:
                    user_ids.append(row['userId'])
                if len(user_ids) >= k:
                    break
    except FileNotFoundError:
        print(f"Error: {filename} not found. Please verify the file path.")
        sys.exit(1)
    return user_ids

def generate_tracking_data(user_id):
    """
    Generates 'Case 1' data: Live tracking (Automatic)
    """
    return {
        "user_id": user_id,
        "device_id": f"dev_{user_id[:8]}",
        "schema": "tracking_v1",
        "cognitive_predict": False, # Just logging data, not asking for score
        "steps": random.randint(0, 15),
        "distance": round(random.uniform(0.0, 0.05), 3),
        "heart_rate": random.randint(65, 130),
        "calories": random.randint(1, 8),
        "timestamp": str(time.time())
    }

def main():
    print(f"--- CPMS Live Generator (v2) ---")
    
    if "REPLACE" in INGEST_URL:
        print("ERROR: Please update INGEST_URL in the script.")
        return

    # 1. Load Real Users
    target_users = load_k_users(k=K_USERS)
    print(f"Simulating devices for {len(target_users)} users: {target_users}")
    print("Press CTRL+C to stop.\n")

    try:
        while True:
            for user in target_users:
                payload = generate_tracking_data(user)
                
                try:
                    # Send to Ingestion API (Hot Path)
                    resp = requests.post(INGEST_URL, json=payload)
                    
                    if resp.status_code == 200:
                        print(f"[{user[:6]}...] HR: {payload['heart_rate']} | Sent to Ingestion")
                    else:
                        print(f"Failed: {resp.text}")
                        
                except Exception as e:
                    print(f"Network Error: {e}")
            
            time.sleep(DELAY_SECONDS)

    except KeyboardInterrupt:
        print("\nSimulation stopped.")

if __name__ == "__main__":
    main()