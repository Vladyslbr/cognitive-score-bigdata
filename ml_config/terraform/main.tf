data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  suffix      = random_id.suffix.hex
  bucket_name = var.bucket_name != "" ? var.bucket_name : "${var.project_name}-${local.suffix}-${data.aws_caller_identity.current.account_id}"
  endpoint_name = "${var.project_name}-endpoint"
  training_job_prefix      = "${var.project_name}-train"
  model_prefix            = "${var.project_name}-model"
  endpoint_config_prefix  = "${var.project_name}-epc"
}

# ----------------
# S3 bucket
# ----------------
resource "aws_s3_bucket" "ml" {
  bucket = local.bucket_name
  tags   = var.tags
}

resource "aws_s3_bucket_versioning" "ml" {
  bucket = aws_s3_bucket.ml.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ml" {
  bucket = aws_s3_bucket.ml.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "ml" {
  bucket                  = aws_s3_bucket.ml.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Dummy artifact for initial deploy (the inference container ignores it, but SageMaker Model requires a model_data_url)
resource "aws_s3_object" "dummy_model" {
  bucket = aws_s3_bucket.ml.id
  key    = "artifacts/dummy-model.tar.gz"
  source = "${path.module}/../artifacts/dummy-model.tar.gz"
  etag   = filemd5("${path.module}/../artifacts/dummy-model.tar.gz")
}

# ----------------
# ECR repos
# ----------------
resource "aws_ecr_repository" "inference" {
  name                 = "${var.project_name}-inference"
  image_tag_mutability = "MUTABLE"
  tags                 = var.tags
}

resource "aws_ecr_repository" "training" {
  name                 = "${var.project_name}-training"
  image_tag_mutability = "MUTABLE"
  tags                 = var.tags
}

# ----------------
# IAM roles
# ----------------
data "aws_iam_policy_document" "sagemaker_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["sagemaker.amazonaws.com"]
    }
  }
}


resource "aws_iam_role" "sagemaker_execution" {
  name               = "${var.project_name}-sagemaker-exec-${local.suffix}"
  assume_role_policy = data.aws_iam_policy_document.sagemaker_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "sagemaker_policy" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject","s3:PutObject","s3:ListBucket"
    ]
    resources = [
      aws_s3_bucket.ml.arn,
      "${aws_s3_bucket.ml.arn}/*"
    ]
  }

  statement {
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchCheckLayerAvailability"
    ]
    resources = ["*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "sagemaker_exec" {
  name   = "${var.project_name}-sagemaker-exec-policy-${local.suffix}"
  policy = data.aws_iam_policy_document.sagemaker_policy.json
}

resource "aws_iam_role_policy_attachment" "sagemaker_exec_attach" {
  role       = aws_iam_role.sagemaker_execution.name
  policy_arn = aws_iam_policy.sagemaker_exec.arn
}

# Step Functions role
data "aws_iam_policy_document" "sfn_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "sfn" {
  name               = "${var.project_name}-sfn-${local.suffix}"
  assume_role_policy = data.aws_iam_policy_document.sfn_assume.json
  tags               = var.tags
}




data "aws_iam_policy_document" "sfn_policy" {

  # Step Functions викликає SageMaker API
  statement {
    effect = "Allow"
    actions = [
      "sagemaker:CreateTrainingJob",
      "sagemaker:DescribeTrainingJob",
      "sagemaker:CreateModel",
      "sagemaker:CreateEndpointConfig",
      "sagemaker:UpdateEndpoint"
    ]
    resources = ["*"]
  }

  # Дозволити Step Functions передавати роль SageMaker-у
  statement {
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.sagemaker_execution.arn]
  }

  # Логи Step Functions (CloudWatch Logs delivery)
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogDelivery",
      "logs:GetLogDelivery",
      "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutResourcePolicy",
      "logs:DescribeResourcePolicies",
      "logs:DescribeLogGroups",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["*"]
  }

  # ВАЖЛИВО: для .sync інтеграцій (managed rule в EventBridge)
  statement {
    effect = "Allow"
    actions = [
      "events:PutRule",
      "events:PutTargets",
      "events:DescribeRule",
      "events:RemoveTargets",
      "events:DeleteRule"
    ]
    resources = ["*"]
  }
}





resource "aws_iam_policy" "sfn" {
  name   = "${var.project_name}-sfn-policy-${local.suffix}"
  policy = data.aws_iam_policy_document.sfn_policy.json
}

resource "aws_iam_role_policy_attachment" "sfn_attach" {
  role       = aws_iam_role.sfn.name
  policy_arn = aws_iam_policy.sfn.arn
}

# EventBridge role for starting SFN execution
data "aws_iam_policy_document" "events_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "events" {
  name               = "${var.project_name}-events-${local.suffix}"
  assume_role_policy = data.aws_iam_policy_document.events_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "events_policy" {
  statement {
    effect = "Allow"
    actions = ["states:StartExecution"]
    resources = [aws_sfn_state_machine.retrain.arn]
  }
}

resource "aws_iam_policy" "events" {
  name   = "${var.project_name}-events-policy-${local.suffix}"
  policy = data.aws_iam_policy_document.events_policy.json
}

resource "aws_iam_role_policy_attachment" "events_attach" {
  role       = aws_iam_role.events.name
  policy_arn = aws_iam_policy.events.arn
}

# ----------------
# SageMaker endpoint (optional)
# ----------------
locals {
  inference_image_uri = "${aws_ecr_repository.inference.repository_url}:latest"
  training_image_uri  = "${aws_ecr_repository.training.repository_url}:latest"
}

resource "aws_sagemaker_model" "mock" {
  count              = var.create_endpoint ? 1 : 0
  name               = "${var.project_name}-model-initial"
  execution_role_arn = aws_iam_role.sagemaker_execution.arn

  primary_container {
    image          = local.inference_image_uri
    model_data_url = "s3://${aws_s3_bucket.ml.bucket}/${aws_s3_object.dummy_model.key}"
  }

  depends_on = [aws_iam_role_policy_attachment.sagemaker_exec_attach, aws_s3_object.dummy_model]
  tags       = var.tags
}

resource "aws_sagemaker_endpoint_configuration" "mock" {
  count = var.create_endpoint ? 1 : 0
  name  = "${var.project_name}-epc-initial"

  production_variants {
    variant_name           = "AllTraffic"
    model_name             = aws_sagemaker_model.mock[0].name
    initial_instance_count = 1
    instance_type          = var.endpoint_instance_type
  }

  tags = var.tags
}

resource "aws_sagemaker_endpoint" "mock" {
  count = var.create_endpoint ? 1 : 0
  name  = local.endpoint_name

  endpoint_config_name = aws_sagemaker_endpoint_configuration.mock[0].name
  tags                 = var.tags
}

# ----------------
# Step Functions + Schedule (always created)
# ----------------
resource "aws_cloudwatch_log_group" "sfn" {
  name              = "/aws/vendedlogs/states/${var.project_name}-retrain"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_sfn_state_machine" "retrain" {
  name     = "${var.project_name}-monthly-retrain"
  role_arn = aws_iam_role.sfn.arn

  definition = templatefile("${path.module}/statemachine.asl.json.tftpl", {
    bucket_name                 = aws_s3_bucket.ml.bucket
    training_image_uri          = local.training_image_uri
    inference_image_uri         = local.inference_image_uri
    sagemaker_execution_role_arn = aws_iam_role.sagemaker_execution.arn
    endpoint_name               = local.endpoint_name
    endpoint_instance_type      = var.endpoint_instance_type
    training_job_prefix         = local.training_job_prefix
    model_prefix                = local.model_prefix
    endpoint_config_prefix      = local.endpoint_config_prefix
  })

  logging_configuration {
    include_execution_data = true
    level                  = "ALL"
    log_destination        = "${aws_cloudwatch_log_group.sfn.arn}:*"
  }

  tags = var.tags
}

resource "aws_cloudwatch_event_rule" "monthly" {
  name                = "${var.project_name}-monthly-retrain"
  schedule_expression = var.monthly_cron_expression
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "monthly_to_sfn" {
  rule      = aws_cloudwatch_event_rule.monthly.name
  arn       = aws_sfn_state_machine.retrain.arn
  role_arn  = aws_iam_role.events.arn
  input     = jsonencode({ "trigger": "monthly" })
}
