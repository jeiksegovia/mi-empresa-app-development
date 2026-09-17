#!/bin/bash
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>/home/ec2-user/validate-service.log 2>&1

echo "DeploymentGroup ${DEPLOYMENT_GROUP_NAME}"

while true 
do
    health="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/health )"
    echo "HeathCheck http -> "$health
    if [[ "$health" == *"200"* ]]; then
        echo "Service is up"
        exit 0
    fi
    sleep 3
done

echo "Error validating service"
exit 1