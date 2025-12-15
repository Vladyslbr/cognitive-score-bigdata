import argparse
import json
import boto3

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint-name", required=True)
    ap.add_argument("--region", default=None)
    ap.add_argument("--payload", default='{"hello":"world"}')
    args = ap.parse_args()

    runtime = boto3.client("sagemaker-runtime", region_name=args.region)

    resp = runtime.invoke_endpoint(
        EndpointName=args.endpoint_name,
        ContentType="application/json",
        Body=args.payload.encode("utf-8"),
    )

    body = resp["Body"].read().decode("utf-8")
    try:
        print(json.dumps(json.loads(body), ensure_ascii=False, indent=2))
    except Exception:
        print(body)

if __name__ == "__main__":
    main()
