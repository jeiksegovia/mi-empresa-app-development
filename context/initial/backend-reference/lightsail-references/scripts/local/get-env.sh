#!/bin/bash
export REGION=us-east-1
export AWS_PROFILE=wsc-dev
export STACK_NAME=PAYMENT-REPORTING-API
export STAGE=dev

getExportParam() {
    echo $(aws cloudformation list-exports --query "Exports[?Name==\`${1}\`].Value" --no-paginate --output text --region $REGION --profile $AWS_PROFILE)
}
getSsmParam() {
    echo $(aws ssm get-parameter --name ${1} --query "Parameter.Value" --output text --region $REGION)
}

# generate base .env file
./scripts/env.sh
## dev env vars
echo AWS_PROFILE=$AWS_PROFILE >> ./.env
