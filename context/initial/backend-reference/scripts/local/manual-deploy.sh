#!/bin/bash
export AWS_REGION="us-east-1"
STAGE="stg"
GITHUB_REPOSITORY="AnacompInc/FOIA_API-Layer"
codeDeployAppName="$(aws cloudformation list-exports --query 'Exports[?Name==`FOIA-API-LAYER-codedeploy-app-'$STAGE'`].Value' --output text)"
codeDeployGroupName="$(aws cloudformation list-exports --query 'Exports[?Name==`FOIA-API-LAYER-codedeploy-group-'$STAGE'`].Value' --output text)"
commit_hash=$(git rev-parse HEAD)
short_commit_hash=$(git rev-parse --short HEAD)
S3_BUCKET=foia-api-layer-bundle-$STAGE

echo "Deploying commit $commit_hash"
echo "CodeDeploy app $codeDeployAppName"
echo "group $codeDeployGroupName"
# codedeploy with github connector
# aws deploy create-deployment --description "Deployment of commit $commit_hash" --application-name $codeDeployAppName --deployment-group-name $codeDeployGroupName --github-location repository=$GITHUB_REPOSITORY,commitId=$commit_hash --ignore-application-stop-failures
# aws deploy wait deployment-successful --deployment-id $result

# codedeploy with s3 bundle
# create bundle on s3 with git arhcive
mkdir -p .tmp/bundles
git archive --format zip --output .tmp/bundles/$short_commit_hash.zip $commit_hash
aws s3 cp .tmp/bundles/$short_commit_hash.zip s3://$S3_BUCKET/$short_commit_hash.zip
# use previously uploaded s3 bundle
# short_commit_hash="4f3c8e2"
# commit_hash="manual-deploy for $short_commit_hash"

# codedeploy with s3 bundle
result=$(aws deploy create-deployment --description "Deployment of commit $commit_hash" --application-name $codeDeployAppName --deployment-group-name $codeDeployGroupName --s3-location bucket=$S3_BUCKET,key=$short_commit_hash.zip,bundleType=zip --ignore-application-stop-failures --output text)
echo "Deploying -> deploymentId: $result"
aws deploy wait deployment-successful --deployment-id $result
# get deployment status
aws deploy get-deployment --deployment-id $result --query 'deploymentInfo.status'