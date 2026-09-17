#!/bin/bash
getExportParam() {
    echo $(aws cloudformation list-exports --query "Exports[?Name==\`${1}\`].Value" --no-paginate --output text --region $REGION)
}
getSsmParam() {
    echo $(aws ssm get-parameter --name ${1} --query "Parameter.Value" --output text --region $REGION)
}
# generate .env file
echo STAGE=${STAGE} > ./.env
echo AWS_REGION=$REGION >> ./.env
echo KINESIS_STREAM_NAME=$(getExportParam "${STACK_NAME}-kinesis-stream-${STAGE}") >> ./.env
echo AUTH_TOKEN=$(getSsmParam "/${STACK_NAME}/${STAGE}/auth-token") >> ./.env
echo CUSTOMER_UPDATES_KINESIS_STREAM_NAME=$(getExportParam "${STACK_NAME}-customer-updates-kinesis-stream-${STAGE}") >> ./.env
echo CUSTOMER_UPDATES_JWT_SECRET=$(getSsmParam "/${STACK_NAME}/${STAGE}/customer-updates-jwt-secret") >> ./.env
echo CUSTOMER_UPDATES_EMAIL_VERIFICATION_TABLE_NAME=$(getExportParam "${STACK_NAME}-customer-updates-email-verification-dynamodb-${STAGE}") >> ./.env
echo THANK_YOU_PAGE_URL=\"$(getSsmParam "/${STACK_NAME}/${STAGE}/thank-you-page-url")\" >> ./.env
echo DOT818_KINESIS_STREAM_NAME=$(getExportParam "${STACK_NAME}-3rd-party-data-kinesis-stream-${STAGE}") >> ./.env
echo AMSIVE_SOURCE_SECRET=$(getSsmParam "/${STACK_NAME}/${STAGE}/amsive-source-secret") >> ./.env
echo DOT818_SOURCE_SECRET=$(getSsmParam "/${STACK_NAME}/${STAGE}/dot818-source-secret") >> ./.env
echo CONTRACTS_AUTH_TOKENS=$(getSsmParam "/${STACK_NAME}/${STAGE}/api/contracts/basic-auth-credentials") >> ./.env
echo CONTRACTS_DEBUG_TABLE_NAME=$(getExportParam "${STACK_NAME}-contracts-debug-dynamodb-${STAGE}") >> ./.env
echo CONTRACTS_KINESIS_STREAM_NAME=$(getExportParam "${STACK_NAME}-contracts-kinesis-stream-${STAGE}") >> ./.env