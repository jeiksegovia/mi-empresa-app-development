#!/bin/bash
#functions
error(){
    echo "Error: $1" && exit 0
}

[ ! -z "$AWS_PROFILE" ] || error "Provide AWS_PROFILE"
[ ! -z "$INSTANCE_NAME" ] || error "Provide INSTANCE_NAME"

#default params
: "${REGION:=us-east-1}"

# get default-key-pair if not exists
if [ ! -f "${AWS_PROFILE}-${REGION}-rsa" ]; then
    ./install-default-ssh-key.sh 
fi

# get instance ip by stage
publicIp=$(./get-instalce-ip-by-instance-name.sh)
echo "publicIp: "$publicIp
if [[ $publicIp == *"Error"* ]]; then
    error "No StaticIp - Exit 0"
fi

echo " > ssh -o \"StrictHostKeyChecking no\" -i ${AWS_PROFILE}-${REGION}-rsa bitnami@${publicIp}"
ssh -o "StrictHostKeyChecking no" -i ${AWS_PROFILE}-${REGION}-rsa bitnami@${publicIp}