# --- INFERENCE BACKEND (LAMBDA) ---
# This Lambda connects everything: DB, Model, User
data "archive_file" "backend_zip" {
  type        = "zip"
  source_dir  = "src"   # CHANGED from source_file = "src/inference_backend.py"
  output_path = "backend_function.zip"
  
  # Exclude the ingestion file to keep the zip cleaner (optional)
  excludes    = ["ingestion.py"] 
}

resource "aws_lambda_function" "backend" {
  filename      = "backend_function.zip"
  function_name = "${var.project_name}-backend"
  role          = aws_iam_role.backend_role.arn # Ensure you updated the role as discussed previously
  handler       = "inference_backend.lambda_handler"
  runtime       = "python3.9"
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  timeout       = 30

  environment {
    variables = {
      SAGEMAKER_ENDPOINT = aws_sagemaker_endpoint.endpoint.name
      DYNAMO_TABLE       = aws_dynamodb_table.aggregates.name
      DB_HOST            = aws_db_instance.user_db.address
      DB_PASS            = random_password.db_password.result
    }
  }
}

resource "aws_iam_role" "backend_role" {
  name = "${var.project_name}-backend-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole", Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Update the Policy Attachment to attach to backend_role
resource "aws_iam_role_policy_attachment" "backend_attach" {
  role       = aws_iam_role.backend_role.name # CHANGED
  policy_arn = aws_iam_policy.backend_policy.arn
}

# Add IAM Permissions to Lambda for SageMaker & Dynamo
resource "aws_iam_policy" "backend_policy" {
  name = "${var.project_name}-backend-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sagemaker:InvokeEndpoint",
        Effect = "Allow",
        Resource = aws_sagemaker_endpoint.endpoint.arn
      },
      {
        Action = ["dynamodb:Query", "dynamodb:GetItem"],
        Effect = "Allow",
        Resource = aws_dynamodb_table.aggregates.arn
      }
    ]
  })
}

# Add Route to API Gateway
resource "aws_apigatewayv2_integration" "backend_integration" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.backend.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "backend_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /predict"
  target    = "integrations/${aws_apigatewayv2_integration.backend_integration.id}"
}

resource "aws_lambda_permission" "backend_api_gw" {
  statement_id  = "AllowBackendFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/predict"
}

output "prediction_url" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/predict"
}