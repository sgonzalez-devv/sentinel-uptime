environment       = "production"
aws_region        = "us-east-1"
app_name          = "sentinel-uptime"
vpc_cidr          = "10.0.0.0/16"
api_cpu           = 512
api_memory        = 1024
api_desired_count = 2
db_instance_class = "db.t4g.medium"
db_name           = "sentinel"
db_username       = "sentinel_admin"
# certificate_arn and domain_name must be set per deployment
