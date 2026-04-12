#!/bin/bash
# Create the S3 bucket for file uploads
awslocal s3 mb s3://dbm-uploads
awslocal s3api put-bucket-cors --bucket dbm-uploads --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}'
echo "S3 bucket 'dbm-uploads' created with CORS"
