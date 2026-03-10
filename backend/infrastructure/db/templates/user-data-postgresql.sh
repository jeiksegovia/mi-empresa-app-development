#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# User Data Script: PostgreSQL 15 + CodeDeploy + Node.js on Amazon Linux 2023
# ============================================================================
# This script bootstraps a Lightsail instance with all required components
# for the Mi Empresa application backend.
#
# Components installed:
# - PostgreSQL 15
# - CodeDeploy agent
# - Node.js 20.x LTS
# - PM2 process manager
# - AWS CLI v2
# ============================================================================

# Log all output
exec > >(tee -a /var/log/user-data.log)
exec 2>&1

echo "=========================================="
echo "Starting user-data script at $(date)"
echo "=========================================="

# Environment variables (passed by create-instance.sh)
STAGE="${STAGE:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
DB_NAME="miempresa_${STAGE}"
DB_USER="miempresa"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32)}"

echo "Configuration:"
echo "  STAGE: ${STAGE}"
echo "  AWS_REGION: ${AWS_REGION}"
echo "  DB_NAME: ${DB_NAME}"
echo "  DB_USER: ${DB_USER}"

# ============================================================================
# 1. System Updates
# ============================================================================
echo "Step 1: Updating system packages..."
dnf update -y

# Install essential utilities
dnf install -y \
  wget \
  curl \
  git \
  tar \
  gzip \
  unzip \
  jq \
  ruby \
  openssl \
  postgresql15-contrib \
  postgresql15-devel

echo "✓ System packages updated"

# ============================================================================
# 2. PostgreSQL 15 Installation
# ============================================================================
echo "Step 2: Installing PostgreSQL 15..."

# Reference: https://hbayraktar.medium.com/how-to-install-postgresql-15-on-amazon-linux-2023-a-step-by-step-guide-57eebb7ad9fc

# Install PostgreSQL 15 server
dnf install -y postgresql15 postgresql15-server

# Initialize database cluster
sudo -u postgres /usr/bin/postgresql-15-setup initdb

# Configure PostgreSQL for local and network access
cat > /var/lib/pgsql/15/data/pg_hba.conf <<EOF
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     peer

# IPv4 local connections:
host    all             all             127.0.0.1/32            md5

# IPv6 local connections:
host    all             all             ::1/128                 md5

# Allow connections from application
host    ${DB_NAME}      ${DB_USER}      127.0.0.1/32            md5
host    ${DB_NAME}      ${DB_USER}      ::1/128                 md5
EOF

# Configure PostgreSQL to listen on all interfaces (for future flexibility)
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/g" /var/lib/pgsql/15/data/postgresql.conf

# Enable and start PostgreSQL
systemctl enable postgresql-15
systemctl start postgresql-15

# Wait for PostgreSQL to be ready
sleep 5

# Create application database and user
sudo -u postgres psql <<EOF
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\q
EOF

echo "✓ PostgreSQL 15 installed and configured"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"

# ============================================================================
# 3. CodeDeploy Agent Installation
# ============================================================================
echo "Step 3: Installing CodeDeploy agent..."

# Download and install CodeDeploy agent
cd /tmp
wget https://aws-codedeploy-${AWS_REGION}.s3.${AWS_REGION}.amazonaws.com/latest/install
chmod +x ./install
./install auto

# Create CodeDeploy agent configuration directory
mkdir -p /etc/codedeploy-agent/conf

# Configure systemd to restart CodeDeploy agent on failure
mkdir -p /etc/systemd/system/codedeploy-agent.service.d
cat > /etc/systemd/system/codedeploy-agent.service.d/override.conf <<EOF
[Service]
Restart=always
RestartSec=10
EOF

# Reload systemd and enable CodeDeploy agent
systemctl daemon-reload
systemctl enable codedeploy-agent
systemctl start codedeploy-agent

echo "✓ CodeDeploy agent installed and configured"

# ============================================================================
# 4. Node.js 20.x LTS Installation
# ============================================================================
echo "Step 4: Installing Node.js 20.x LTS..."

# Add NodeSource repository for Node.js 20.x
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -

# Install Node.js
dnf install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 globally for process management
npm install -g pm2

echo "✓ Node.js 20.x and PM2 installed"

# ============================================================================
# 5. AWS CLI v2 Installation
# ============================================================================
echo "Step 5: Installing AWS CLI v2..."

cd /tmp
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install

# Verify installation
aws --version

echo "✓ AWS CLI v2 installed"

# ============================================================================
# 6. Application Directories Setup
# ============================================================================
echo "Step 6: Creating application directories..."

mkdir -p /opt/miempresa/app
mkdir -p /opt/miempresa/scripts
mkdir -p /opt/miempresa/backups
mkdir -p /opt/miempresa/logs

# Set ownership to ec2-user (default Lightsail user on Amazon Linux)
chown -R ec2-user:ec2-user /opt/miempresa

echo "✓ Application directories created"

# ============================================================================
# 7. Bootstrap AWS Credentials Configuration
# ============================================================================
echo "Step 7: Configuring AWS credentials..."

# Create AWS configuration directory for root user
mkdir -p /root/.aws

# Create default AWS config
cat > /root/.aws/config <<EOF
[default]
region = ${AWS_REGION}
output = json
EOF

chmod 600 /root/.aws/config

# Note: Actual credentials will be populated by refresh-credentials.sh
# after the instance is registered with CodeDeploy

echo "✓ AWS credentials directory configured"

# ============================================================================
# 8. Store Database Password in SSM Parameter Store
# ============================================================================
echo "Step 8: Storing database password in SSM..."

# Note: This requires bootstrap credentials to be configured
# The password will be stored during instance registration
# For now, we'll save it locally for the refresh script to upload

cat > /tmp/db-password.txt <<EOF
${DB_PASSWORD}
EOF
chmod 600 /tmp/db-password.txt

echo "✓ Database password prepared for SSM storage"

# ============================================================================
# 9. System Configuration
# ============================================================================
echo "Step 9: Configuring system settings..."

# Increase file descriptor limits for Node.js applications
cat >> /etc/security/limits.conf <<EOF

# Increase limits for Node.js applications
ec2-user soft nofile 65536
ec2-user hard nofile 65536
root soft nofile 65536
root hard nofile 65536
EOF

# Configure log rotation for application logs
cat > /etc/logrotate.d/miempresa <<EOF
/opt/miempresa/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0644 ec2-user ec2-user
    sharedscripts
}

/var/log/postgres-backup.log {
    weekly
    rotate 12
    compress
    delaycompress
    notifempty
    missingok
    create 0644 root root
}

/var/log/credential-refresh.log {
    weekly
    rotate 12
    compress
    delaycompress
    notifempty
    missingok
    create 0644 root root
}
EOF

echo "✓ System configuration completed"

# ============================================================================
# 10. Health Check Setup
# ============================================================================
echo "Step 10: Creating health check script..."

cat > /opt/miempresa/scripts/health-check.sh <<'HEALTHCHECK'
#!/bin/bash
# Quick health check script

echo "=== System Health Check ==="
echo "Date: $(date)"
echo ""

# PostgreSQL
echo -n "PostgreSQL: "
if systemctl is-active --quiet postgresql-15; then
    echo "✓ Running"
else
    echo "✗ Not running"
fi

# CodeDeploy Agent
echo -n "CodeDeploy Agent: "
if systemctl is-active --quiet codedeploy-agent; then
    echo "✓ Running"
else
    echo "✗ Not running"
fi

# PM2 (if running)
echo -n "PM2 Process: "
if pm2 list 2>/dev/null | grep -q "miempresa-api"; then
    echo "✓ Running"
else
    echo "○ Not started (normal before first deployment)"
fi

# Disk Space
echo ""
echo "Disk Space:"
df -h / | tail -1 | awk '{print "  Used: "$3" / "$2" ("$5")"}'

# Memory
echo ""
echo "Memory:"
free -h | grep "Mem:" | awk '{print "  Used: "$3" / "$2}'

echo ""
echo "=== End Health Check ==="
HEALTHCHECK

chmod +x /opt/miempresa/scripts/health-check.sh

echo "✓ Health check script created"

# ============================================================================
# Completion
# ============================================================================
echo ""
echo "=========================================="
echo "User-data script completed successfully!"
echo "=========================================="
echo ""
echo "Instance is ready for CodeDeploy registration."
echo ""
echo "Next steps:"
echo "  1. Register instance with CodeDeploy"
echo "  2. Configure STS credential refresh"
echo "  3. Deploy application via CodeDeploy"
echo ""
echo "Run health check: /opt/miempresa/scripts/health-check.sh"
echo ""
echo "Completed at $(date)"
