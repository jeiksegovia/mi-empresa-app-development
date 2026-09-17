#!/bin/bash

# ============================================================================
# SSH to Lightsail Instance
# ============================================================================
# Convenient wrapper to SSH into a Lightsail instance.
#
# Usage:
#   ./ssh-to-instance.sh <instance-name> [region] [--allow-current-ip]
#
# Examples:
#   ./ssh-to-instance.sh miempresa-backend-staging
#   ./ssh-to-instance.sh miempresa-backend-prod us-east-1
#   ./ssh-to-instance.sh miempresa-backend-staging --allow-current-ip
#
# F-01 wiring: by default this script does NOT call ssh-allow-current-ip.sh
# (avoiding surprise AWS API calls on every SSH). If your public IP has
# drifted and 22/tcp denies you, run ssh-allow-current-ip.sh directly OR pass
# --allow-current-ip to this script to refresh the allow-list first.
# ============================================================================

ALLOW_CURRENT_IP=false
INSTANCE_NAME=""
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pull --allow-current-ip out of the argv so positional args stay clean.
ARGS_LEFT=()
for arg in "$@"; do
    if [ "$arg" == "--allow-current-ip" ]; then
        ALLOW_CURRENT_IP=true
    else
        ARGS_LEFT+=("$arg")
    fi
done
set -- "${ARGS_LEFT[@]}"

INSTANCE_NAME="${1:-}"
REGION="${2:-us-east-1}"

if [ -z "$INSTANCE_NAME" ]; then
    echo "Usage: $0 <instance-name> [region] [--allow-current-ip]"
    echo ""
    echo "Examples:"
    echo "  $0 miempresa-backend-staging"
    echo "  $0 miempresa-backend-prod us-east-1"
    echo "  $0 miempresa-backend-staging --allow-current-ip   # refresh port-22 allow-list first"
    exit 1
fi

if $ALLOW_CURRENT_IP; then
    echo "Refreshing port-22 allow-list via ssh-allow-current-ip.sh (idempotent)..."
    "${SCRIPT_DIR}/ssh-allow-current-ip.sh" --stage "${STAGE:-$(echo "${INSTANCE_NAME}" | sed -E 's/.*-(staging|prod)$/\1/')}" --no-ssh 2>/dev/null || true
    # The above intentionally swallows errors — we still try the SSH below even
    # if the helper couldn't reach AWS (e.g. no profile on the laptop). The
    # user gets the real SSH failure message in that case.
fi

# Get instance IP
PUBLIC_IP=$("${SCRIPT_DIR}/get-instance-ip.sh" "$INSTANCE_NAME" "$REGION")

if [ -z "$PUBLIC_IP" ]; then
    echo "ERROR: Could not retrieve instance IP"
    exit 1
fi

echo "Connecting to ${INSTANCE_NAME} (${PUBLIC_IP})..."

# SSH key path
SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo ""
    echo "SSH key not found: ${SSH_KEY}"
    echo "Run install-ssh-key.sh first to download the key:"
    echo "  ${SCRIPT_DIR}/install-ssh-key.sh"
    exit 1
fi

# SSH to instance
ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o LogLevel=ERROR \
    ec2-user@"${PUBLIC_IP}"