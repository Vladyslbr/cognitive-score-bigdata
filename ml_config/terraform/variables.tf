variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "eu-central-1"
}

variable "project_name" {
  type        = string
  description = "Name prefix for resources"
  default     = "cognitive-mock"
}

variable "bucket_name" {
  type        = string
  description = "Optional fixed bucket name. If empty, a unique bucket name will be generated."
  default     = ""
}

variable "create_endpoint" {
  type        = bool
  description = "If true, creates the SageMaker endpoint (requires images already pushed to ECR)."
  default     = false
}

variable "endpoint_instance_type" {
  type        = string
  description = "SageMaker instance type for the endpoint"
  default     = "ml.c5d.large"
}

variable "monthly_cron_expression" {
  type        = string
  description = "EventBridge schedule expression for monthly retraining (UTC)."
  default     = "cron(0 3 1 * ? *)"
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {
    project = "cognitive-score"
  }
}
