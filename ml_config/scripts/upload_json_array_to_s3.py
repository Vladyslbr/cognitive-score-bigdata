import argparse
import json
import os
import sys
import uuid
import boto3
from botocore.exceptions import NoCredentialsError, ClientError

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bucket", required=True)
    ap.add_argument("--prefix", default="train")
    ap.add_argument("--file", required=True)
    ap.add_argument("--region", default=None)
    args = ap.parse_args()

    try:
        with open(args.file, "r", encoding="utf-8") as f:
            records = json.load(f)
    except Exception as e:
        print(f"ERROR reading {args.file}: {e}")
        sys.exit(1)

    if not isinstance(records, list):
        print("ERROR: файл має бути JSON-масивом: [ {...}, {...} ]")
        sys.exit(1)

    s3 = boto3.client("s3", region_name=args.region)

    uploaded = 0
    for rec in records:
        if not isinstance(rec, dict):
            continue

        key = f"{args.prefix}/{uuid.uuid4()}.json"
        try:
            s3.put_object(
                Bucket=args.bucket,
                Key=key,
                Body=json.dumps(rec, ensure_ascii=False).encode("utf-8"),
                ContentType="application/json",
            )
            uploaded += 1
            print(f"OK -> s3://{args.bucket}/{key}")
        except NoCredentialsError:
            print("ERROR: немає AWS кредів. Зроби `aws configure`.")
            sys.exit(1)
        except ClientError as e:
            print(f"ERROR upload failed: {e}")
            sys.exit(1)

    print(f"Done. Uploaded {uploaded} records.")

if __name__ == "__main__":
    main()
