from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import boto3
import pg8000.native
import os
import json
import ssl
import uuid
from datetime import datetime
from typing import Optional

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
ENDPOINT_NAME = os.environ.get('SAGEMAKER_ENDPOINT', 'cpms-demo-endpoint')
TABLE_NAME = os.environ.get('DYNAMO_TABLE', 'cpms-demo-aggregates')
DB_HOST = os.environ.get('DB_HOST')
DB_PASS = os.environ.get('DB_PASS')
DB_USER = "dbadmin"
DB_NAME = "cpms_user_db"

# Clients
sagemaker_runtime = boto3.client('sagemaker-runtime', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# --- DATA MODELS ---
class PredictRequest(BaseModel):
    user_id: str
    sleep_duration: float
    stress_level: int
    screen_time: float
    exercise_frequency: str  # Category: 'None', 'Light', 'Moderate', 'Heavy'
    caffeine_intake: int     # mg
    reaction_time: float     # ms
    memory_test_score: int   # 0-100

# --- HELPERS ---
def get_db_conn():
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        user=DB_USER, password=DB_PASS, host=DB_HOST, database=DB_NAME, ssl_context=ssl_context
    )

def get_latest_dynamo_features(user_id):
    """Fetches the latest hot-path data (wearables) for a user."""
    table = dynamodb.Table(TABLE_NAME)
    resp = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id),
        Limit=1, ScanIndexForward=False
    )
    # Return features or defaults if no data exists yet
    if resp['Items']:
        return resp['Items'][0]
    return {'heart_rate': 0, 'steps': 0, 'calories': 0}

# --- ROUTES ---

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/api/worker/{user_id}/status")
def get_worker_status(user_id: str):
    """Used by Worker App to show 'Last Pulse' before filling form"""
    features = get_latest_dynamo_features(user_id)
    return {
        "user_id": user_id,
        "last_heart_rate": int(features.get('heart_rate', 0)),
        "last_steps": int(features.get('steps', 0)),
        "timestamp": features.get('timestamp')
    }

@app.post("/api/predict")
def predict_readiness(req: PredictRequest):
    try:
        # 1. Fetch Aggregates (Live Wearable Data)
        features = get_latest_dynamo_features(req.user_id)
        
        # 2. Merge Manual Form Data with Live Data
        # We convert the Pydantic model to a dict and merge
        model_input = features.copy()
        model_input.update(req.dict())

        # 3. Call SageMaker
        payload = json.dumps(model_input, default=str)
        sm_resp = sagemaker_runtime.invoke_endpoint(
            EndpointName=ENDPOINT_NAME,
            ContentType='application/json',
            Body=payload
        )
        result = json.loads(sm_resp['Body'].read().decode())
        score = result.get('cognitive_score', 0)

        # 4. Save Result to Postgres
        status = 'Critical' if score < 50 else 'Normal'
        conn = get_db_conn()
        cs_id = str(uuid.uuid4())
        
        # We also save the 'snapshot' of heart rate at this moment into tracking_risks 
        # (This logic mimics the 'TrackingRisk' table population in your report)
        tr_id = str(uuid.uuid4())
        conn.run(
            """INSERT INTO tracking_risks 
               (tr_id, user_id, timestamp, heart_rate, risk_metric, steps, distance, calories) 
               VALUES (:id, :uid, NOW(), :hr, :risk, :steps, 0, 0)""",
            id=tr_id, uid=req.user_id, hr=int(features.get('heart_rate', 0)), 
            risk=status, steps=int(features.get('steps', 0))
        )

        conn.run(
            "INSERT INTO cognitive_scores (cs_id, user_id, timestamp, cognitive_score) VALUES (:id, :uid, NOW(), :score)",
            id=cs_id, uid=req.user_id, score=score
        )
        conn.close()

        return {"user_id": req.user_id, "score": score, "status": status}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    try:
        conn = get_db_conn()
        
        # Fetch Scores + Join with latest Heart Rate (via Tracking Risks table)
        query = """
            SELECT 
                u.user_id, 
                cs.cognitive_score, 
                cs.timestamp, 
                tr.heart_rate
            FROM cognitive_scores cs
            JOIN users u ON u.user_id = cs.user_id
            LEFT JOIN tracking_risks tr ON tr.user_id = cs.user_id 
                AND tr.timestamp = cs.timestamp
            ORDER BY cs.timestamp DESC LIMIT 50
        """
        rows = conn.run(query)
        
        # Get Stats
        risk_count = conn.run("SELECT COUNT(*) FROM cognitive_scores WHERE cognitive_score < 50")[0][0]
        avg_score = conn.run("SELECT AVG(cognitive_score) FROM cognitive_scores")[0][0]
        
        conn.close()

        data = []
        for r in rows:
            data.append({
                "user_id": r[0],
                "score": r[1],
                "timestamp": str(r[2]),
                "heart_rate": r[3] if r[3] else 0,
                "status": "Critical" if r[1] < 50 else "Normal"
            })
            
        return {
            "recent_checks": data, 
            "critical_alerts": risk_count,
            "avg_score": int(avg_score) if avg_score else 0
        }

    except Exception as e:
        print(f"Db Error: {e}")
        return {"recent_checks": [], "critical_alerts": 0, "avg_score": 0}