import requests
import json
import time
import random
import csv
import sys
import os
import argparse
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# --- CONFIGURATION ---
INGEST_URL = os.getenv("INGEST_URL")

# How many specific users to simulate (default)
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

def parse_args():
    parser = argparse.ArgumentParser(description="CPMS Live Generator (v2) - simulate device tracking")
    parser.add_argument('--user-ids', nargs='+',
                        help="Specify one or more user IDs to simulate. If provided, these override CSV loading.")
    parser.add_argument('--k', type=int, default=K_USERS,
                        help="When not passing --user-ids, read first K users from CSV (default: %(default)s).")
    parser.add_argument('--file', type=str, default=os.path.join(DATA_DIR, 'users.csv'),
                        help="CSV file path to load users from when --user-ids is not given.")
    parser.add_argument('--delay', type=float, default=DELAY_SECONDS,
                        help="Delay in seconds between simulation loops (default: %(default)s).")
    parser.add_argument('--ingest-url', type=str, default=None,
                        help="Override INGEST_URL environment variable with this URL.")
    return parser.parse_args()

def main():
    args = parse_args()

    print(f"--- CPMS Live Generator (v2) ---")

    # allow overriding ingest url from CLI
    ingest_url = args.ingest_url if args.ingest_url else INGEST_URL

    if not ingest_url:
        print("ERROR: INGEST_URL not set. Set it in your .env or pass --ingest-url.")
        return

    if "REPLACE" in ingest_url:
        print("ERROR: Please update INGEST_URL in the script/.env (found placeholder 'REPLACE').")
        return

    # Determine target users: CLI provided user IDs take precedence
    if args.user_ids:
        # strip whitespace from provided ids
        target_users = [u.strip() for u in args.user_ids if u.strip()]
        if not target_users:
            print("ERROR: --user-ids provided but no valid IDs found.")
            return
        print(f"Using {len(target_users)} user IDs passed via command line: {target_users}")
    else:
        # load from CSV using --k and --file
        target_users = load_k_users(filename=args.file, k=args.k)
        print(f"Simulating devices for {len(target_users)} users loaded from {args.file}: {target_users}")

    print("Press CTRL+C to stop.\n")

    try:
        while True:
            for user in target_users:
                payload = generate_tracking_data(user)

                try:
                    # Send to Ingestion API (Hot Path)
                    resp = requests.post(ingest_url, json=payload)

                    if resp.status_code == 200:
                        print(f"[{user[:6]}...] HR: {payload['heart_rate']} | Sent to Ingestion")
                    else:
                        # print status and response text for debugging
                        print(f"Failed (status {resp.status_code}): {resp.text}")

                except Exception as e:
                    print(f"Network Error: {e}")

            time.sleep(args.delay)

    except KeyboardInterrupt:
        print("\nSimulation stopped.")

if __name__ == "__main__":
    main()
