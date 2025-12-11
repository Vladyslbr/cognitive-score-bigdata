import base64
import json
import boto3
import os
from decimal import Decimal

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ['DYNAMO_TABLE']
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    """
    Acts as the 'Spark Streaming' consumer.
    Reads batches of records from Kinesis and updates DynamoDB Aggregates.
    """
    print(f"Received batch of {len(event['Records'])} records")
    
    # Batch processing to reduce DB writes (simple aggregation)
    user_updates = {}

    for record in event['Records']:
        try:
            # Kinesis data is base64 encoded
            payload = base64.b64decode(record['kinesis']['data']).decode('utf-8')
            data = json.loads(payload)
            
            user_id = data.get('user_id')
            if not user_id:
                continue
                
            # Logic: We want the LATEST state for the dashboard.
            # If a user appears twice in this batch, overwrite with the newer one.
            user_updates[user_id] = {
                'user_id': user_id,
                'timestamp': str(data.get('timestamp')),
                'heart_rate': Decimal(str(data.get('heart_rate', 0))),
                'steps': Decimal(str(data.get('steps', 0))),
                'calories': Decimal(str(data.get('calories', 0)))
            }
            
        except Exception as e:
            print(f"Error decoding record: {e}")

    # Write aggregated updates to DynamoDB
    # This matches the schema expected by your main.py backend
    for uid, stats in user_updates.items():
        try:
            print(f"Updating state for user {uid}: HR={stats['heart_rate']}")
            table.put_item(Item=stats)
        except Exception as e:
            print(f"Failed to write to DynamoDB: {e}")

    return f"Successfully processed {len(event['Records'])} records."