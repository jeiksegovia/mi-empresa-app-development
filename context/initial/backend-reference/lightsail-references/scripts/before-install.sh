#!/bin/bash
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>/home/ec2-user/before-install.log 2>&1

echo "DeploymentGroup ${DEPLOYMENT_GROUP_NAME}"

# clean up app directory
rm -rf /home/ec2-user/app