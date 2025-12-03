import json
import boto3
import os
import pg8000.dbapi  # CHANGED: Using Pure Python driver
import ssl
import time
import uuid

# Clients
sagemaker_runtime = boto3.client('sagemaker-runtime')
dynamodb = boto3.resource('dynamodb')

# Config
ENDPOINT_NAME = os.environ['SAGEMAKER_ENDPOINT']
TABLE_NAME = os.environ['DYNAMO_TABLE']
DB_HOST = os.environ['DB_HOST']
DB_PASS = os.environ['DB_PASS']
DB_USER = "dbadmin"
DB_NAME = "cpms_user_db"

def lambda_handler(event, context):
    try:
        # Parse Input
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event
            
        user_id = body.get('user_id')
        if not user_id:
            return {'statusCode': 400, 'body': 'Missing user_id'}

        print(f"Processing Inference for User: {user_id}")

        # 1. Fetch Features from DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id),
            Limit=1,
            ScanIndexForward=False
        )
        
        features = {}
        if response['Items']:
            features = response['Items'][0]
        else:
            print("No live features found. Using defaults.")
            features = {'heart_rate': 70, 'sleep': 8}

        # 2. Invoke SageMaker
        payload = json.dumps(features, default=str)
        ml_response = sagemaker_runtime.invoke_endpoint(
            EndpointName=ENDPOINT_NAME,
            ContentType='application/json',
            Body=payload
        )
        
        result = json.loads(ml_response['Body'].read().decode())
        score = result['cognitive_score']
        print(f"Model Prediction: {score}")

        # 3. Write to SQL (UserDB) using pg8000
        # Create SSL context for secure connection
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        conn = pg8000.dbapi.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            ssl_context=ssl_context
        )
        cur = conn.cursor()
        
        risk_level = 'Critical' if score < 50 else 'Normal'
        cs_id = str(uuid.uuid4())
        
        cur.execute("""
            INSERT INTO cognitive_scores (cs_id, user_id, timestamp, cognitive_score)
            VALUES (%s, %s, NOW(), %s)
        """, (cs_id, user_id, score))
        
        conn.commit()
        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'body': json.dumps({
                'user_id': user_id,
                'readiness_score': score,
                'status': risk_level
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        # Print full traceback to CloudWatch for easier debugging
        import traceback
        traceback.print_exc()
        return {'statusCode': 500, 'body': json.dumps({'message': str(e)})}