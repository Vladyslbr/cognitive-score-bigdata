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
    Reads batches from Kinesis and updates DynamoDB Aggregates.
    Now includes 'distance' in the state.
    """
    print(f"Received batch of {len(event['Records'])} records")
    
    user_updates = {}

    for record in event['Records']:
        try:
            # Decode Kinesis data
            payload = base64.b64decode(record['kinesis']['data']).decode('utf-8')
            data = json.loads(payload)
            
            user_id = data.get('user_id')
            if not user_id:
                continue
            
            # We use Decimal for DynamoDB numeric types
            user_updates[user_id] = {
                'user_id': user_id,
                'timestamp': str(data.get('timestamp')),
                'heart_rate': Decimal(str(data.get('heart_rate', 0))),
                'steps': Decimal(str(data.get('steps', 0))),
                'calories': Decimal(str(data.get('calories', 0))),
                'distance': Decimal(str(data.get('distance', 0.0))) # Added field
            }
            
        except Exception as e:
            print(f"Error decoding record: {e}")

    # Write updates to DynamoDB
    for uid, stats in user_updates.items():
        try:
            table.put_item(Item=stats)
            print(f"Updated user {uid}: HR={stats['heart_rate']}, Dist={stats['distance']}")
        except Exception as e:
            print(f"Failed to write to DynamoDB for {uid}: {e}")

    return f"Successfully processed {len(event['Records'])} records."