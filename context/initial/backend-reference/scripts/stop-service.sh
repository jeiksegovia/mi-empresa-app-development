#!/bin/bash
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>/home/ec2-user/stop-service.log 2>&1

echo "DeploymentGroup ${DEPLOYMENT_GROUP_NAME}"
# load path
source /root/.bashrc

cd /home/ec2-user/app || exit 0
# Stop via PM2
yarn pm2 delete foia-api || true
