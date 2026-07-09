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

# Log all output to /var/log/user-data.log, with per-command trace lines
# (timestamped) so failed bootstraps are debuggable line-by-line.
exec > >(tee -a /var/log/user-data.log)
exec 2>&1
export PS4='+ [$(date "+%H:%M:%S")] '
set -x

echo "=========================================="
echo "Starting user-data script at $(date)"
echo "=========================================="

# Environment variables — create-instance.sh prepends explicit exports
# (export STAGE=..., export AWS_REGION=...) before this content; the defaults
# below only apply if the script is run standalone.
STAGE="${STAGE:-staging}"
AWS_REGION="${AWS_REGION:-us-east-1}"
DB_NAME="miempresa_${STAGE}"
DB_USER="miempresa"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)}"

echo "Configuration:"
echo "  STAGE: ${STAGE}"
echo "  AWS_REGION: ${AWS_REGION}"
echo "  DB_NAME: ${DB_NAME}"
echo "  DB_USER: ${DB_USER}"

# Persist stage for on-instance scripts (refresh-credentials.sh, backup-postgres-s3.sh)
echo "${STAGE}" > /etc/miempresa-stage
chmod 644 /etc/miempresa-stage

# ============================================================================
# 0. Swap (2 GB) — mandatory on 1 GB micro_3_0: npm/prisma would OOM without it
# ============================================================================
echo "Step 0: Creating 2 GB swapfile..."
if [ ! -f /swapfile ]; then
    dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo "✓ Swap active: $(free -h | grep Swap)"

# ============================================================================
# 1. System Updates
# ============================================================================
echo "Step 1: Updating system packages..."
dnf update -y

# Install essential utilities.
# NOTE: no 'curl' here — AL2023 preinstalls curl-minimal (provides /usr/bin/curl)
# and installing full curl CONFLICTS with it, aborting the whole bootstrap.
dnf install -y \
  wget \
  git \
  tar \
  gzip \
  unzip \
  jq \
  ruby \
  openssl \
  cronie \
  postgresql15-contrib \
  postgresql15-devel

# AL2023 does not preinstall cron — crond must be installed AND enabled
systemctl enable --now crond

echo "✓ System packages updated"

# ============================================================================
# 2. PostgreSQL 15 Installation
# ============================================================================
echo "Step 2: Installing PostgreSQL 15..."

# Reference: https://hbayraktar.medium.com/how-to-install-postgresql-on-amazon-linux-2023-a-step-by-step-guide-57eebb7ad9fc

# Install PostgreSQL 15 server
dnf install -y postgresql15 postgresql15-server

# Initialize database cluster
postgresql-setup --initdb

# Configure PostgreSQL for local and network access
cat > /var/lib/pgsql/data/pg_hba.conf <<EOF
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
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/g" /var/lib/pgsql/data/postgresql.conf

# Tune for micro_3_0 (1 GB RAM shared with Node/PM2/CodeDeploy agent + 2 GB swap).
# Defaults (shared_buffers=128MB, max_connections=100) waste connection slots and
# under-use cache; these values follow pgtune "mixed" guidance scaled to ~1 GB.
cat >> /var/lib/pgsql/data/postgresql.conf <<'PGTUNE'

# --- miempresa tuning (micro_3_0: 1 GB RAM, SSD) ---
shared_buffers = 256MB
effective_cache_size = 512MB
work_mem = 8MB
maintenance_work_mem = 64MB
max_connections = 50
random_page_cost = 1.1
checkpoint_completion_target = 0.9
wal_compression = on
log_min_duration_statement = 1000
PGTUNE

# Enable and start PostgreSQL
systemctl enable postgresql
systemctl start postgresql

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
# 8. Stash Database Password for create-instance.sh
# ============================================================================
echo "Step 8: Stashing database password..."

# create-instance.sh reads this file over SSH, stores the password in SSM as
# SecureString, then deletes it. Not /tmp (systemd-tmpfiles cleanup).
printf '%s' "${DB_PASSWORD}" > /opt/miempresa/.db-password
chmod 600 /opt/miempresa/.db-password
chown root:root /opt/miempresa/.db-password

echo "✓ Database password stashed at /opt/miempresa/.db-password"

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
if systemctl is-active --quiet postgresql; then
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
