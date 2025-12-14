from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
import boto3
import pg8000.native
import os
import json
import ssl
import uuid
import time
from typing import Optional, List

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION ---
ENDPOINT_NAME = os.environ.get('SAGEMAKER_ENDPOINT', 'cpms-demo-endpoint')
TABLE_NAME = os.environ.get('DYNAMO_TABLE', 'cpms-demo-aggregates')
MODELS_BUCKET_NAME = os.environ.get('MODELS_BUCKET_NAME') 

DB_HOST = os.environ.get('DB_HOST')
DB_PASS = os.environ.get('DB_PASS')
DB_USER = "dbadmin"
DB_NAME = "cpms_user_db"

# Clients
sagemaker_runtime = boto3.client('sagemaker-runtime', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
s3_client = boto3.client('s3', region_name='us-east-1')

# --- DATA MODELS ---
class CognitiveRequest(BaseModel):
    user_id: str
    # We use 'alias' to accept Capitalized keys from frontend 
    # but use lowercase in Python logic.
    sleep_duration: float
    stress_level: int
    screen_time: float = Field(alias="Screen_Time")         
    exercise_frequency: str = Field(alias="Exercise_Frequency")
    caffeine_intake: int = Field(alias="Caffeine_Intake")
    reaction_time: float = Field(alias="Reaction_Time")
    memory_test_score: int = Field(alias="Memory_Test_Score")
    
    # Optional because it's only for training
    cognitive_score: Optional[int] = None

    class Config:
        allow_population_by_field_name = True

# --- HELPERS ---
def get_db_conn():
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        user=DB_USER, password=DB_PASS, host=DB_HOST, database=DB_NAME, ssl_context=ssl_context
    )

def get_latest_dynamo_features(user_id):
    table = dynamodb.Table(TABLE_NAME)
    resp = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id),
        Limit=1, ScanIndexForward=False
    )
    if resp['Items']:
        item = resp['Items'][0]
        return {
            "steps": int(item.get('steps', 0)),
            "distance": float(item.get('distance', 0.0)),
            "heart_rate": int(item.get('heart_rate', 0)),
            "calories": int(item.get('calories', 0)),
            "timestamp": item.get('timestamp')
        }
    return {"steps": 0, "distance": 0.0, "heart_rate": 0, "calories": 0}

def get_user_diet_type(user_id):
    conn = get_db_conn()
    try:
        result = conn.run("SELECT diet_type FROM users WHERE user_id = :uid", uid=user_id)
        if result:
            return result[0][0]
        return "Unknown"
    except Exception as e:
        print(f"DB Error: {e}")
        return "Unknown"
    finally:
        conn.close()

def build_full_feature_set(req: CognitiveRequest):
    live_data = get_latest_dynamo_features(req.user_id)
    diet = get_user_diet_type(req.user_id)
    
    # Combine everything into a flat dictionary
    features = {
        "steps": live_data['steps'],
        "distance": live_data['distance'],
        "heart_rate": live_data['heart_rate'],
        "calories": live_data['calories'],
        
        "sleep_duration": req.sleep_duration,
        "stress_level": req.stress_level,
        "Screen_Time": req.screen_time,
        "Exercise_Frequency": req.exercise_frequency,
        "Caffeine_Intake": req.caffeine_intake,
        "Reaction_Time": req.reaction_time,
        "Memory_Test_Score": req.memory_test_score,
        
        "diet_type": diet
    }
    # Add score if present (for training data)
    if req.cognitive_score is not None:
        features["cognitive_score"] = req.cognitive_score
        
    return features

# --- ROUTES ---

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/api/worker/{user_id}/status")
def get_worker_status(user_id: str):
    features = get_latest_dynamo_features(user_id)
    return {
        "user_id": user_id,
        "last_heart_rate": features.get('heart_rate'),
        "last_steps": features.get('steps'),
        "last_distance": features.get('distance'),
        "timestamp": features.get('timestamp')
    }

@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    try:
        conn = get_db_conn()
        query = """
            SELECT cs.user_id, cs.cognitive_score, cs.timestamp, tr.heart_rate
            FROM cognitive_scores cs
            LEFT JOIN tracking_risks tr ON tr.user_id = cs.user_id AND tr.timestamp = cs.timestamp
            ORDER BY cs.timestamp DESC LIMIT 50
        """
        rows = conn.run(query)
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
        return {"recent_checks": data, "critical_alerts": 0, "avg_score": 0}
    except Exception as e:
        print(f"Db Error: {e}")
        return {"recent_checks": [], "critical_alerts": 0, "avg_score": 0}

@app.post("/api/predict")
def inference(req: CognitiveRequest):
    try:
        model_input = build_full_feature_set(req)
        
        # In a real scenario, you'd send model_input to SageMaker.
        # For this demo, we can just return a dummy score if SageMaker isn't active.
        # payload = json.dumps(model_input, default=str)
        # sm_resp = sagemaker_runtime.invoke_endpoint(...) 
        
        # MOCK SCORE for demonstration (Replace with actual SageMaker call if active)
        import random
        score = random.randint(40, 95) 

        # Save to DB
        conn = get_db_conn()
        cs_id = str(uuid.uuid4())
        conn.run(
            "INSERT INTO cognitive_scores (cs_id, user_id, timestamp, cognitive_score) VALUES (:id, :uid, NOW(), :score)",
            id=cs_id, uid=req.user_id, score=score
        )
        conn.close()

        return {
            "user_id": req.user_id, 
            "cognitive_score": score, 
            "used_features": model_input
        }
    except Exception as e:
        print(f"Inference Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/submit_training_data")
def save_training_data(req: CognitiveRequest):
    try:
        if not MODELS_BUCKET_NAME:
            raise HTTPException(status_code=500, detail="MODELS_BUCKET_NAME env var not set")

        data_point = build_full_feature_set(req)
        data_point['timestamp'] = str(time.time())

        file_name = f"train/{req.user_id}_{int(time.time())}.json"

        s3_client.put_object(
            Bucket=MODELS_BUCKET_NAME,
            Key=file_name,
            Body=json.dumps(data_point),
            ContentType='application/json'
        )

        return {"status": "success", "s3_path": file_name}
    except Exception as e:
        print(f"S3 Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))