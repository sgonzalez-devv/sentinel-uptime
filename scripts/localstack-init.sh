#!/bin/sh
set -e

echo "Initializing LocalStack resources..."

awslocal sqs create-queue --queue-name sentinel-alerts
awslocal sqs create-queue --queue-name sentinel-alerts-dlq

awslocal s3 mb s3://sentinel-assets-dev

echo "LocalStack initialization complete"
