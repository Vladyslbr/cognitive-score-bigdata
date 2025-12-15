#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 --region <region> --inference-repo <repo_url> --training-repo <repo_url>"
  exit 1
}

REGION=""
INF_REPO=""
TRN_REPO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2;;
    --inference-repo) INF_REPO="$2"; shift 2;;
    --training-repo) TRN_REPO="$2"; shift 2;;
    *) usage;;
  esac
done

[[ -z "$REGION" || -z "$INF_REPO" || -z "$TRN_REPO" ]] && usage

echo "Logging in to ECR..."
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$(echo "$INF_REPO" | cut -d/ -f1)"

echo "Building inference image..."
docker build -t cognitive-inference:latest -f docker/inference/Dockerfile docker/inference
docker tag cognitive-inference:latest "${INF_REPO}:latest"
docker push "${INF_REPO}:latest"

echo "Building training image..."
docker build -t cognitive-training:latest -f docker/training/Dockerfile docker/training
docker tag cognitive-training:latest "${TRN_REPO}:latest"
docker push "${TRN_REPO}:latest"

echo "Done."
