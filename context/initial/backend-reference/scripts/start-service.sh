#!/bin/bash
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>/home/ec2-user/start-service.log 2>&1

echo "DeploymentGroup ${DEPLOYMENT_GROUP_NAME}"
# load path
source /root/.bashrc

cd /home/ec2-user/app
# Start via PM2, environment from .env
yarn serve
# Save PM2 process list
yarn pm2 save
