#!/bin/bash
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>/home/ec2-user/after-install.log 2>&1

export REGION=us-east-1
export STACK_NAME=PAYMENT-REPORTING-API
# extract stage from deployment group-name
export STAGE=$(echo ${DEPLOYMENT_GROUP_NAME##*-})

getExportParam() {
    echo $(aws cloudformation list-exports --query "Exports[?Name==\`${1}\`].Value" --no-paginate --output text --region $REGION)
}

getSsmParam() {
    echo $(aws ssm get-parameter --name ${1} --query "Parameter.Value" --output text --region $REGION)
}

# ec2 user home directory
echo "DeploymentGroup ${DEPLOYMENT_GROUP_NAME}"
cd /home/ec2-user/app
yarn install --frozen-lockfile

# generate base .env file
./scripts/env.sh
