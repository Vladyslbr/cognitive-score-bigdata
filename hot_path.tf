# --- HOT PATH (STREAMING) ---
resource "aws_kinesis_stream" "hot_stream" {
  name             = "${var.project_name}-hot-stream"
  shard_count      = 1
  retention_period = 24

  # Phase 4 Security: Encryption at Rest
  encryption_type = "KMS"
  kms_key_id      = "alias/aws/kinesis"
}

# --- INGESTION (LAMBDA) ---
# IAM Role for Lambda (Least Privilege)
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# IAM Policy: Allow logging, Writing to S3, and Writing to Kinesis
resource "aws_iam_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Action = ["s3:PutObject"]
        Effect = "Allow"
        Resource = "${aws_s3_bucket.data_lake.arn}/*"
      },
      {
        Action = ["kinesis:PutRecord", "kinesis:PutRecords"]
        Effect = "Allow"
        Resource = aws_kinesis_stream.hot_stream.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

# Zip the Python code
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "src/ingestion.py"
  output_path = "lambda_function.zip"
}

# The Lambda Function
resource "aws_lambda_function" "ingestion_lambda" {
  filename      = "lambda_function.zip"
  function_name = "${var.project_name}-ingestion"
  role          = aws_iam_role.lambda_role.arn
  handler       = "ingestion.lambda_handler"
  runtime       = "python3.9"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.data_lake.bucket
      KINESIS_STREAM = aws_kinesis_stream.hot_stream.name
    }
  }
}