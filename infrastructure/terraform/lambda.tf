resource "aws_ecr_repository" "worker" {
  name                 = "${var.app_name}-worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${var.app_name}-worker-${var.environment}"
  retention_in_days = 14
}

resource "aws_lambda_function" "monitor_worker" {
  function_name = "${var.app_name}-worker-${var.environment}"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.worker.repository_url}:latest"
  role          = aws_iam_role.lambda.arn
  timeout       = 300
  memory_size   = 512

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      NODE_ENV          = var.environment
      SQS_ALERT_QUEUE_URL = aws_sqs_queue.alerts.url
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.worker,
    aws_iam_role_policy_attachment.lambda_vpc,
  ]
}

resource "aws_cloudwatch_event_rule" "monitor_schedule" {
  name                = "${var.app_name}-monitor-schedule-${var.environment}"
  description         = "Trigger monitor worker every minute"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "monitor_worker" {
  rule      = aws_cloudwatch_event_rule.monitor_schedule.name
  target_id = "MonitorWorkerLambda"
  arn       = aws_lambda_function.monitor_worker.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.monitor_worker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monitor_schedule.arn
}
