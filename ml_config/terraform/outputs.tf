output "ml_bucket_name" {
  value = aws_s3_bucket.ml.bucket
}

output "inference_repo_url" {
  value = aws_ecr_repository.inference.repository_url
}

output "training_repo_url" {
  value = aws_ecr_repository.training.repository_url
}

output "endpoint_name" {
  value = "${var.project_name}-endpoint"
}

output "state_machine_arn" {
  value = aws_sfn_state_machine.retrain.arn
}
