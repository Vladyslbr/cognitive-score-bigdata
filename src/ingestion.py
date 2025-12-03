import json
import boto3
import os
import time
import uuid

# Initialize clients outside handler for performance
s3 = boto3.client('s3')
kinesis = boto3.client('kinesis')

S3_BUCKET = os.environ['S3_BUCKET_NAME']
KINESIS_STREAM = os.environ['KINESIS_STREAM']

def lambda_handler(event, context):
    try:
        # 1. Parse Input
        # API Gateway HTTP API passes body as a string
        if 'body' in event:
            body = json.loads(event['body'])
        else:
            body = event # Fallback for test events

        print(f"Received event: {body}")
        
        # Add server-side timestamp and ID if missing
        if 'event_id' not in body:
            body['event_id'] = str(uuid.uuid4())
        if 'timestamp' not in body:
            body['timestamp'] = str(time.time())

        # 2. Cold Path: Save Raw Data to S3
        # We partition by Date for easier querying later
        # Key format: raw/YYYY-MM-DD/event_id.json
        file_key = f"raw/{body['event_id']}.json"
        
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=file_key,
            Body=json.dumps(body),
            ContentType='application/json'
        )

        # 3. Hot Path: Push to Kinesis (Stream)
        # This simulates pushing to Kafka
        kinesis.put_record(
            StreamName=KINESIS_STREAM,
            Data=json.dumps(body),
            PartitionKey=body.get('user_id', 'unknown')
        )

        return {
            'statusCode': 200,
            'body': json.dumps({'status': 'success', 'event_id': body['event_id']})
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }