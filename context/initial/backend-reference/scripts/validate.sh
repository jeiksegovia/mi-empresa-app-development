#!/bin/bash
exec 3>&1 4>&2
trap 'exec 2>&4 1>&3' 0 1 2 3
exec 1>/home/ec2-user/validate-service.log 2>&1

echo "DeploymentGroup ${DEPLOYMENT_GROUP_NAME}"
# load path
source /root/.bashrc
# Validate by hitting root and passing if 404 is returned (or 200)
ATTEMPTS=20
SLEEP=3

for i in $(seq 1 $ATTEMPTS); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/)
  echo "Health check attempt $i => HTTP $code"
  if [[ "$code" == "404" || "$code" == "200" ]]; then
    echo "Service responding (acceptable code $code)"
    exit 0
  fi
  sleep $SLEEP
done

echo "Service validation failed"
exit 1
