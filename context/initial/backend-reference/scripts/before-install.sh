#!/bin/bash
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>/home/ec2-user/before-install.log 2>&1

echo "DeploymentGroup ${DEPLOYMENT_GROUP_NAME}"
# load path
source /root/.bashrc
# Clean app directory
rm -rf /home/ec2-user/app
mkdir -p /home/ec2-user/app

# Ensure Volta/Node/Yarn/PM2 are available for root
if ! command -v volta >/dev/null 2>&1   ; then
  echo "Volta not found in PATH, ensure LaunchTemplate installed it."
fi
