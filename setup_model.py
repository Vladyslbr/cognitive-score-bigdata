import boto3
import tarfile
import os
import io
from dotenv import load_dotenv

load_dotenv()

# --- CONFIGURATION ---
# REPLACE THIS with the bucket name from your 'terraform output s3_bucket'
BUCKET_NAME = os.getenv("BUCKET_NAME") 

def create_dummy_model():
    """Creates a tar.gz file containing a mock inference script for SageMaker."""
    
    # This is the code that will run INSIDE SageMaker
    inference_code = """
import json
import random
import os

def model_fn(model_dir):
    # Load model logic here (Mocking it for now)
    return "DummyModel"

def input_fn(request_body, request_content_type):
    if request_content_type == 'application/json':
        return json.loads(request_body)
    raise ValueError("Content type must be application/json")

def predict_fn(input_data, model):
    # SIMULATION: Return a random cognitive score
    # In real life, this would use model.predict(input_data)
    simulated_score = random.randint(40, 100)
    return {'cognitive_score': simulated_score, 'model_version': 'v1-mock'}

def output_fn(prediction, response_content_type):
    return json.dumps(prediction)
"""

    # Create directory structure
    os.makedirs("model_code", exist_ok=True)
    with open("model_code/inference.py", "w") as f:
        f.write(inference_code)

    # Compress to model.tar.gz
    with tarfile.open("model.tar.gz", "w:gz") as tar:
        tar.add("model_code/inference.py", arcname="inference.py")
    
    print("Created model.tar.gz")
    return "model.tar.gz"

def upload_to_s3(filename, bucket):
    s3 = boto3.client('s3')
    key = f"models/{filename}"
    print(f"Uploading to s3://{bucket}/{key}...")
    s3.upload_file(filename, bucket, key)
    print("Upload complete!")

if __name__ == "__main__":
    if "REPLACE" in BUCKET_NAME:
        print("ERROR: Please update BUCKET_NAME in the script with your Terraform output.")
    else:
        file = create_dummy_model()
        upload_to_s3(file, BUCKET_NAME)
        # Clean up local files
        os.remove(file)
        import shutil
        shutil.rmtree("model_code")