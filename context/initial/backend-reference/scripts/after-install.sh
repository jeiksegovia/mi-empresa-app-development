#!/bin/bash
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>/home/ec2-user/after-install.log 2>&1

export REGION=${AWS_REGION:-us-east-1}
# derive stage from Deployment Group naming convention: <something>-<stage>
export STAGE=$(echo ${DEPLOYMENT_GROUP_NAME##*-})
export STACK_NAME=FOIA-API-LAYER

getSsmParam() {
  aws ssm get-parameter --name "$1" --query "Parameter.Value" --output text --region "$REGION"
}
# load path
source /root/.bashrc

cd /home/ec2-user/app

# Use yarn via Volta
yarn install --frozen-lockfile

# Generate environment file from SSM and defaults
./scripts/env.sh

# Prisma generate and build
yarn db:generate
yarn build

# Copy any runtime generated clients into dist
if [ -d "src/generated" ]; then
  mkdir -p dist/src
  cp -R src/generated dist/src/
fi
