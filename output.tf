output "api_url" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/ingest"
  description = "The URL to send POST requests to"
}

output "s3_bucket" {
  value = aws_s3_bucket.data_lake.bucket
}

output "dynamo_table" {
  value = aws_dynamodb_table.aggregates.name
}

output "db_endpoint" {
  value = aws_db_instance.user_db.address
}

output "db_password_ssm" {
  value = aws_ssm_parameter.db_password_param.name
  description = "Retrieve password using: aws ssm get-parameter --name ... --with-decryption"
}