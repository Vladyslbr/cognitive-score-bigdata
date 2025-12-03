# --- ML INFRASTRUCTURE (PHASE 2) ---

# 1. IAM Role for SageMaker
resource "aws_iam_role" "sagemaker_role" {
  name = "${var.project_name}-sagemaker-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "sagemaker.amazonaws.com" }
    }]
  })
}

# Allow SageMaker to read S3 (to load model) and CloudWatch
resource "aws_iam_policy" "sagemaker_policy" {
  name = "${var.project_name}-sm-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = ["s3:GetObject", "s3:ListBucket"],
        Effect = "Allow",
        Resource = "${aws_s3_bucket.data_lake.arn}/*"
      },
      {
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        Effect = "Allow",
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}
resource "aws_iam_role_policy_attachment" "sm_attach" {
  role       = aws_iam_role.sagemaker_role.name
  policy_arn = aws_iam_policy.sagemaker_policy.arn
}

# 2. SageMaker Model Object
# We tell SageMaker where to find the 'tar.gz' we uploaded in Step 1
resource "aws_sagemaker_model" "model" {
  name               = "${var.project_name}-model"
  execution_role_arn = aws_iam_role.sagemaker_role.arn

  primary_container {
    # Using standard AWS Scikit-Learn container
    image = "683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:0.23-1-cpu-py3"
    model_data_url = "s3://${aws_s3_bucket.data_lake.bucket}/models/model.tar.gz"
    
    environment = {
      SAGEMAKER_PROGRAM = "inference.py"
      SAGEMAKER_SUBMIT_DIRECTORY = "s3://${aws_s3_bucket.data_lake.bucket}/models/model.tar.gz"
    }
  }
}

# 3. Serverless Endpoint Config (Cost Savings)
resource "aws_sagemaker_endpoint_configuration" "config" {
  name = "${var.project_name}-config"

  production_variants {
    variant_name           = "AllTraffic"
    model_name             = aws_sagemaker_model.model.name
    
    # Serverless Config: Scale to 0 when not used
    serverless_config {
      max_concurrency = 1
      memory_size_in_mb = 1024
    }
  }
}

# 4. The SageMaker Endpoint
resource "aws_sagemaker_endpoint" "endpoint" {
  name                 = "${var.project_name}-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.config.name
}
