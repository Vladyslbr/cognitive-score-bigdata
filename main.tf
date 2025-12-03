provider "aws" {
  region = "us-east-1"
}

# --- STORAGE (COLD PATH) ---
# S3 Bucket for Raw Data Lake
resource "aws_s3_bucket" "data_lake" {
  bucket_prefix = "${var.project_name}-data-lake-"
  force_destroy = true # Allows deleting bucket even if it has files (Good for student demos)
}

# Security: Encryption at Rest
resource "aws_s3_bucket_server_side_encryption_configuration" "data_lake_crypto" {
  bucket = aws_s3_bucket.data_lake.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Security: Block Public Access
resource "aws_s3_bucket_public_access_block" "data_lake_block" {
  bucket = aws_s3_bucket.data_lake.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket for Model Artifacts
resource "aws_s3_bucket" "models" {
  bucket_prefix = "${var.project_name}-models-"
  force_destroy = true
}

# --- STORAGE (AGGREGATES) ---
resource "aws_dynamodb_table" "aggregates" {
  name         = "${var.project_name}-aggregates"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "timestamp"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  # Security: Encryption at Rest
  server_side_encryption {
    enabled = true
  }
}

# --- DATABASE (UserDB - Aurora/Postgres) ---
# Security: Create a random password (secrets management)
resource "random_password" "db_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store password in Systems Manager (SSM) Parameter Store for security
resource "aws_ssm_parameter" "db_password_param" {
  name  = "/${var.project_name}/db_password"
  type  = "SecureString"
  value = random_password.db_password.result
}

# Security Group to allow access
resource "aws_security_group" "db_sg" {
  name        = "${var.project_name}-db-sg"
  description = "Allow inbound traffic to Postgres"

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # WARNING: Open for demo simplicity. In prod, restrict to your IP.
  }
}

# The Database Instance
resource "aws_db_instance" "user_db" {
  identifier             = "${var.project_name}-user-db"
  engine                 = "postgres"
  engine_version         = "16.3"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  db_name                = "cpms_user_db"
  username               = "dbadmin"
  password               = random_password.db_password.result
  publicly_accessible    = true # Set to true so you can run the loader script from your laptop
  skip_final_snapshot    = true
  vpc_security_group_ids = [aws_security_group.db_sg.id]

  # Security: Enforce SSL
  parameter_group_name = "default.postgres16"
}


# --- API GATEWAY (HTTP API) ---
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.ingestion_lambda.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /ingest"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingestion_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/ingest"
}
