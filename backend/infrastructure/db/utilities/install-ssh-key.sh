#!/bin/bash

# ============================================================================
# Install Lightsail SSH Key
# ============================================================================
# Downloads the default Lightsail SSH key pair and saves it locally.
#
# Usage:
#   ./install-ssh-key.sh [region]
#
# Example:
#   ./install-ssh-key.sh us-east-1
# ============================================================================

REGION="${1:-us-east-1}"
SSH_KEY_PATH="${HOME}/.ssh/miempresa-lightsail-key.pem"

echo "Downloading Lightsail SSH key..."
echo "  Region: ${REGION}"
echo "  Destination: ${SSH_KEY_PATH}"
echo ""

# Create .ssh directory if it doesn't exist
mkdir -p "${HOME}/.ssh"

# Download default key pair.
# Despite the field name, privateKeyBase64 contains the PEM as PLAIN TEXT --
# piping through `base64 --decode` corrupts the key.
aws lightsail download-default-key-pair \
    --region "$REGION" \
    --query "privateKeyBase64" \
    --output text > "$SSH_KEY_PATH"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to download SSH key"
    exit 1
fi

# Set correct permissions
chmod 400 "$SSH_KEY_PATH"

echo "✓ SSH key downloaded successfully"
echo ""
echo "Key saved to: ${SSH_KEY_PATH}"
echo "Permissions: 400 (read-only for owner)"
echo ""
echo "You can now SSH to instances using:"
echo "  ssh -i ${SSH_KEY_PATH} ec2-user@<instance-ip>"
echo ""
echo "Or use the ssh-to-instance.sh utility:"
echo "  ./ssh-to-instance.sh miempresa-backend-staging"
