# --- STREAM PROCESSOR (Consumer) ---

# 1. Zip the new Processor Code
data "archive_file" "processor_zip" {
  type        = "zip"
  source_file = "src/stream_processor.py"
  output_path = "stream_processor.zip"
}

# 2. IAM Role for the Processor
resource "aws_iam_role" "processor_role" {
  name = "${var.project_name}-processor-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# 3. IAM Policy: Read Kinesis + Write DynamoDB
resource "aws_iam_policy" "processor_policy" {
  name = "${var.project_name}-processor-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # basic logging
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Effect = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        # READ from Kinesis
        Action = [
          "kinesis:GetShardIterator",
          "kinesis:GetRecords", 
          "kinesis:DescribeStream"
        ]
        Effect = "Allow"
        Resource = aws_kinesis_stream.hot_stream.arn
      },
      {
        # WRITE to DynamoDB
        Action = ["dynamodb:PutItem", "dynamodb:UpdateItem"]
        Effect = "Allow"
        Resource = aws_dynamodb_table.aggregates.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "proc_attach" {
  role       = aws_iam_role.processor_role.name
  policy_arn = aws_iam_policy.processor_policy.arn
}

# 4. The Lambda Function
resource "aws_lambda_function" "stream_processor" {
  filename         = "stream_processor.zip"
  function_name    = "${var.project_name}-stream-processor"
  role             = aws_iam_role.processor_role.arn
  handler          = "stream_processor.lambda_handler"
  runtime          = "python3.9"
  source_code_hash = data.archive_file.processor_zip.output_base64sha256

  environment {
    variables = {
      DYNAMO_TABLE = aws_dynamodb_table.aggregates.name
    }
  }
}

# 5. THE MISSING LINK: Connect Kinesis to Lambda
resource "aws_lambda_event_source_mapping" "kinesis_trigger" {
  event_source_arn  = aws_kinesis_stream.hot_stream.arn
  function_name     = aws_lambda_function.stream_processor.arn
  starting_position = "LATEST"
  batch_size        = 10 # Process 10 records at a time
}