#!/bin/bash
# default parameters

[ ! -z "$AWS_PROFILE" ] || error "Provide AWS_PROFILE"

: "${REGION:=us-east-1}"
: "${privateKeyName:=${AWS_PROFILE}-${REGION}'-rsa'}"
: "${publickKeyName:=${AWS_PROFILE}-${REGION}'-rsa.pub'}"

echo "getting default-ssh-key-pair for ${REGION}"

# override permissions if file exits already and remove
chmod 500 $privateKeyName $publickKeyName
rm $privateKeyName $publickKeyName

# save key-pairs with breaklines
echo -e "$(aws lightsail download-default-key-pair --query "privateKeyBase64" --output text --region ${REGION})" > $privateKeyName
echo -e "$(aws lightsail download-default-key-pair --query "publicKeyBase64" --output text --region ${REGION})" > $publickKeyName

# set permissions
chmod 400 $privateKeyName $publickKeyName

mv $publickKeyName "~/.ssh/${$publickKeyName}"
echo "${publickKeyName} moved to ~/.ssh/"
echo "- key-pair retrieved" 
