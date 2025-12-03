import csv
import ast
import psycopg2
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# --- CONFIGURATION ---

DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
# Security: Enforce SSL Mode
SSL_MODE = os.getenv("SSL_MODE", "require")

def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            sslmode=SSL_MODE
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def create_schema(cursor):
    """Creates the relational schema with Foreign Keys."""
    print("Creating tables...")
    
    # 1. Users Table
    cursor.execute("""
        DROP TABLE IF EXISTS tracking_risks;
        DROP TABLE IF EXISTS cognitive_scores;
        DROP TABLE IF EXISTS users;

        CREATE TABLE users (
            user_id VARCHAR(50) PRIMARY KEY,
            date_of_birth DATE,
            diet_type VARCHAR(50)
        );
    """)

    # 2. Cognitive Scores Table (One-to-Many relationship)
    cursor.execute("""
        CREATE TABLE cognitive_scores (
            cs_id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(50) REFERENCES users(user_id),
            event_id VARCHAR(50),
            timestamp TIMESTAMP,
            cognitive_score INT
        );
    """)

    # 3. Tracking Risks Table (One-to-Many relationship)
    # Note: Fixing typo 'hearth_rate' -> 'heart_rate' for clean DB schema
    cursor.execute("""
        CREATE TABLE tracking_risks (
            tr_id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(50) REFERENCES users(user_id),
            event_id VARCHAR(50),
            timestamp TIMESTAMP,
            steps INT,
            distance FLOAT,
            heart_rate INT,
            calories INT,
            risk_metric VARCHAR(20)
        );
    """)

def load_data(conn):
    cur = conn.cursor()
    
    # --- STEP 1: LOAD USERS & BUILD MAPS ---
    print("Loading Users and mapping relationships...")
    
    # Maps to store which User owns which Score/Risk
    # Format: { 'cs_id_1': 'user_A', ... }
    cs_owner_map = {}
    tr_owner_map = {}

    with open(os.path.join(DATA_DIR, 'users.csv'), 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Insert User
            cur.execute(
                "INSERT INTO users (user_id, date_of_birth, diet_type) VALUES (%s, %s, %s)",
                (row['userId'], row['date_of_birth'], row['diet_type'])
            )

            # Parse the array strings (e.g., "['id1', 'id2']") into actual lists
            # We use ast.literal_eval for safe parsing
            try:
                c_scores = ast.literal_eval(row['cognitive_scores'])
                for cs_id in c_scores:
                    cs_owner_map[cs_id] = row['userId']
                
                t_risks = ast.literal_eval(row['risk_trackings'])
                for tr_id in t_risks:
                    tr_owner_map[tr_id] = row['userId']
            except ValueError as e:
                print(f"Warning: Could not parse arrays for user {row['userId']}: {e}")

    print(f"Mapped {len(cs_owner_map)} scores and {len(tr_owner_map)} risks to users.")

    # --- STEP 2: LOAD COGNITIVE SCORES ---
    print("Loading Cognitive Scores...")
    with open(os.path.join(DATA_DIR, 'cognitive_scores.csv'), 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cs_id = row['cs_id']
            # Lookup owner
            user_id = cs_owner_map.get(cs_id)
            
            if user_id:
                cur.execute("""
                    INSERT INTO cognitive_scores (cs_id, user_id, event_id, timestamp, cognitive_score)
                    VALUES (%s, %s, %s, %s, %s)
                """, (cs_id, user_id, row['event_id'], row['timestamp'], row['cognitive_score']))
            else:
                print(f"Skipping Score {cs_id}: No user found in mapping.")

    # --- STEP 3: LOAD TRACKING RISKS ---
    print("Loading Tracking Risks...")
    with open(os.path.join(DATA_DIR, 'tracking_risks.csv'), 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tr_id = row['tr_id']
            # Lookup owner
            user_id = tr_owner_map.get(tr_id)
            
            if user_id:
                cur.execute("""
                    INSERT INTO tracking_risks 
                    (tr_id, user_id, event_id, timestamp, steps, distance, heart_rate, calories, risk_metric)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    tr_id, 
                    user_id, 
                    row['event_id'], 
                    row['timestamp'], 
                    row['steps'], 
                    row['distance'], 
                    row['hearth_rate'], # Reading CSV column 'hearth_rate'
                    row['calories'], 
                    row['risk_metric']
                ))

    conn.commit()
    print("Data load complete!")

if __name__ == "__main__":
    if "REPLACE" in DB_HOST:
        print("ERROR: Please update DB credentials in the script.")
    else:
        conn = get_db_connection()
        create_schema(conn.cursor())
        load_data(conn)
        conn.close()