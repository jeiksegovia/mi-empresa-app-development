#!/bin/bash
#functions
error(){
    echo "Error: $1" && exit 0
}
getExportParam() {
    echo $(aws cloudformation list-exports --query "Exports[?Name==\`${1}\`].Value" --no-paginate --output text --region $REGION)
}

# default parameters
: "${STAGE:=dev}"
: "${REGION:=us-east-1}"
: "${STACK_NAME:="ciw"}"
: "${INSTANCE_NAME:="ciw-wp-${STAGE}-1"}"
: "${IMAGE_BLUEPRINT:="wordpress"}" # values: amazon_linux_2, ubuntu_20_04, wordpress, lamp_7,nodejs
: "${BUNDLE:="micro_2_0"}" #nano_2_0 (3 usd), micro_2_0 (5 usd), small_2_0 (10 usd), medium_2_0 (20 usd), large_2_0 (40 usd)
: "${SITEURL:=""}"

template_path="bash-template-create-lightsail-codedeploy.yml"
output_file="create-lightsail-codedeploy-${STAGE}.yml"
deployment_group="${STACK_NAME}-codedeploy-group-${STAGE}"

# check bash-yml-template
[ -f "$template_path" ] || error "no creation-template found on: ${template_path} "

# get params from aws-stack
echo "Gettings stack parameters on -$STAGE- stage."
lightsail_prefix=""
if [[ $STAGE == "prod" ]]; then
    lightsail_prefix="-prod"
fi

acceskey_id=$(getExportParam "ciw-lightsail-user${lightsail_prefix}-accesskey-id")
acceskey_secret=$(getExportParam "ciw-lightsail-user${lightsail_prefix}-accesskey-secret")
user_arn=$(getExportParam "ciw-lightsail-user${lightsail_prefix}-arn")

# check params
[ ! -z "$acceskey_id" ] || error "no acceskey_id"
[ ! -z "$acceskey_secret" ] || error "no acceskey_secret"
[ ! -z "$user_arn" ] || error "no user_arn"

echo "Building lightsail-$STAGE-template on $REGION."
rm -f $output_file temp.yml
( echo "cat <<EOF >${output_file}";
  cat "$template_path";
  echo "EOF";
) >temp.yml
. temp.yml
rm -f temp.yml

echo "Creating Lightsail instance with template"
creationStatus=$(aws lightsail create-instances --cli-input-yaml "file://${output_file}" --region $REGION --query "operations[?resourceName==\`${INSTANCE_NAME}\`].status" --no-paginate --output text)
echo "Instace create-status: ${creationStatus}"
[[ $creationStatus == *"Started"* ]] || error "Instance-create error: ${INSTANCE_NAME}"

instanceStatus=""
until [[ $instanceStatus == *"running"* ]]
do
    printf "."
    instanceStatus="$(aws lightsail get-instance --instance-name ${INSTANCE_NAME} --query "instance.state.name" --no-paginate --output text --region $REGION)"
    sleep 1
done
echo "Instance status: "$instanceStatus

echo "Creating staticIp"
aws lightsail allocate-static-ip --static-ip-name "ciw-static-ip-${STAGE}" --region $REGION --no-paginate --output text
echo "Attaching staticIp"
aws lightsail attach-static-ip  --static-ip-name "ciw-static-ip-${STAGE}" --instance-name "${INSTANCE_NAME}" --region $REGION --query "operations[?resourceName==\`ciw-static-ip-${STAGE}\`].status" --no-paginate --output text
publicIp=$(aws lightsail get-static-ip  --static-ip-name "ciw-static-ip-${STAGE}" --query "staticIp.ipAddress" --no-paginate --output text --region $REGION)
[ ! -z "$publicIp" ] || error "Error creating StaticIp"

# # get default-key-pair
# ./install-default-ssh-key.sh

echo "Checking InstanceSSH and CodeDeploy-Agent status (each 20 sec), it could take 5-10 minutes"
agentStatus=""
until [[ $agentStatus == *"agent is running"* || $agentStatus == *"active (running)"* ]]
do
    printf "."
    agentStatus=$(ssh -o "StrictHostKeyChecking no" -i ciw_rsa bitnami@${publicIp} "sudo service codedeploy-agent status")
    sleep 20
done
echo ""
echo "Agent status: ${agentStatus}"
echo -e "\nRegistering instance on codedeploy:"
aws deploy register-on-premises-instance --instance-name "${INSTANCE_NAME}" --iam-user-arn "${user_arn}" --region $REGION
echo " - Registered"
echo "Adding codeploy TAG: ${deployment_group}"
aws deploy add-tags-to-on-premises-instances --instance-names  "${INSTANCE_NAME}" --tags Key=Name,Value="${deployment_group}" --region $REGION
echo "Check All CodeDeploy Instances: "
aws deploy list-on-premises-instances --region $REGION
echo "to connect run: ssh -o \"StrictHostKeyChecking no\" -i ciw_rsa bitnami@${publicIp}"