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
PREDICT_URL = os.getenv("PREDICT_URL")

def load_random_user(filename=os.path.join(DATA_DIR, 'users.csv')):
    users = []
    try:
        with open(filename, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                users.append(row['userId'])
    except:
        return "test_user_generic"
    
    if not users:
        return "test_user_generic"
    return random.choice(users)

def generate_manual_data(user_id):
    """
    Generates 'Case 2' data: Manual inputs + Request Flag
    """
    return {
        "user_id": user_id,
        "device_id": f"phone_{user_id[:8]}",
        "schema": "manual_entry_v1",
        "cognitive_predict": True, # Flag that this is a prediction context
        
        # Manual Inputs (from Report)
        "sleep_duration": round(random.uniform(4.0, 9.0), 1),
        "stress_level": random.randint(1, 10),
        "caffeine_intake": random.choice([0, 100, 200]),
        "screen_time": round(random.uniform(1.0, 12.0), 1),
        "timestamp": str(time.time())
    }

def run_simulation():
    print("--- CPMS Prediction Flow Simulator ---")
    
    if "REPLACE" in PREDICT_URL or "REPLACE" in INGEST_URL:
        print("ERROR: Please update URLs in the script.")
        return

    # 1. Pick a user
    user = load_random_user()
    print(f"\nUser selected: {user}")

    # 2. Simulate User filling out the 'Health Condition Form'
    # This goes to INGESTION (to be stored in DB/Aggregates)
    form_data = generate_manual_data(user)
    print(f"Step 1: User filling form (Sleep: {form_data['sleep_duration']}h, Stress: {form_data['stress_level']})...")
    
    try:
        ingest_resp = requests.post(INGEST_URL, json=form_data)
        if ingest_resp.status_code == 200:
            print(" -> Form data saved to System (Ingestion API).")
        else:
            print(f" -> Error saving form: {ingest_resp.text}")
            return
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # Small delay to simulate system processing time (Lambda -> Kinesis -> DB)
    print(" -> Processing...", end="", flush=True)
    time.sleep(2) 
    print(" Done.")

    # 3. Simulate User clicking 'Get Readiness Score'
    # This goes to PREDICTION BACKEND
    print(f"Step 2: Requesting Cognitive Score...")
    predict_payload = {"user_id": user}
    
    try:
        # Note: In a real system, the Backend would query the DB for the form data we just sent.
        # In our simulation, the Backend receives this ID and asks the Dummy Model.
        pred_resp = requests.post(PREDICT_URL, json=predict_payload)
        
        if pred_resp.status_code == 200:
            result = pred_resp.json()
            score = result.get('readiness_score', 'N/A')
            status = result.get('status', 'Unknown')
            
            print(f"\n[RESULT] User: {user[:8]}...")
            print(f"  Cognitive Score: {score}/100")
            print(f"  Status: {status}")
            
            if status == "Critical":
                print("  [!] ALERT: WORKER NOT READY FOR HIGH-RISK TASKS")
            else:
                print("  [OK] Worker approved for duty.")
        else:
            print(f"Error from Backend: {pred_resp.text}")

    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    while True:
        run_simulation()
        input("\nPress Enter to simulate another user (or Ctrl+C to exit)...")