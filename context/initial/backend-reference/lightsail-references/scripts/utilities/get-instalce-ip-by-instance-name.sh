#!/bin/bash
#functions
error(){
    echo "Error: $1" && exit 0
}

[ ! -z "$INSTANCE_NAME" ] || error "Provide INSTANCE_NAME"
# check aws_proife
[ ! -z "$AWS_PROFILE" ] || error "Provide AWS_PROFILE"

#default params
: "${REGION:=us-east-1}"

instanceStatus="$(aws lightsail get-instance --instance-name ${INSTANCE_NAME} --query "instance.state.name" --no-paginate --output text --region $REGION)"
[ ! -z "$instanceStatus" ] || error "${INSTANCE_NAME} instance don't exist"
publicIp="$(aws lightsail get-static-ip  --static-ip-name "${INSTANCE_NAME}_static_ip" --query "staticIp.ipAddress" --no-paginate --output text --region $REGION)"
[ ! -z "$publicIp" ] || error "Error getting StaticIp"

echo $publicIp