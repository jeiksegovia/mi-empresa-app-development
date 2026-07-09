#!/bin/bash
set -e
set -o pipefail

# ============================================================================
# PostgreSQL Backup to S3 Script
# ============================================================================
# This script performs automated PostgreSQL backups with:
#   - Database dump with gzip compression
#   - S3 upload with encryption
#   - Local backup retention (30 days)
#   - Comprehensive logging and error handling
#   - Automatic credential refresh before S3 operations
#
# Usage:
#   ./backup-postgres-s3.sh
#
# CRON schedule (daily at 2 AM):
#   0 2 * * * /opt/miempresa/scripts/backup-postgres-s3.sh
# ============================================================================

LOG_FILE="/var/log/postgres-backup.log"

# Redirect all output to log file
exec >> "$LOG_FILE" 2>&1

echo "=========================================="
echo "PostgreSQL Backup to S3"
echo "=========================================="
echo "Started: $(date)"
echo ""

# ============================================================================
# Configuration
# ============================================================================

# Stage recorded at instance creation (user-data writes /etc/miempresa-stage)
STAGE=$(cat /etc/miempresa-stage 2>/dev/null || echo "staging")

# Configuration
DB_NAME="miempresa_${STAGE}"
DB_USER="miempresa"
DB_HOST="localhost"
DB_PORT="5432"
AWS_REGION="${AWS_REGION:-us-east-1}"
# May fail if STS creds expired; resolved again after the refresh step below
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
S3_BUCKET="miempresa-backups-${AWS_ACCOUNT_ID}-${STAGE}"
BACKUP_DIR="/opt/miempresa/backups"
RETENTION_DAYS=30
MAX_RETRIES=3

# Generate timestamp for backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="miempresa_${STAGE}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

echo "Configuration:"
echo "  Stage: ${STAGE}"
echo "  Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "  User: ${DB_USER}"
echo "  S3 Bucket: ${S3_BUCKET}"
echo "  Backup Directory: ${BACKUP_DIR}"
echo "  Backup File: ${BACKUP_FILENAME}"
echo "  Retention: ${RETENTION_DAYS} days"
echo ""

# ============================================================================
# Prepare Backup Directory
# ============================================================================

echo "[1/6] Preparing backup directory..."

mkdir -p "$BACKUP_DIR"
chown ec2-user:ec2-user "$BACKUP_DIR"
chmod 755 "$BACKUP_DIR"

echo "  ✓ Backup directory ready"
echo ""

# ============================================================================
# Refresh AWS Credentials
# ============================================================================

echo "[2/6] Refreshing AWS credentials..."

# Run credential refresh script to ensure valid credentials for S3 upload
if [ -f "/opt/miempresa/scripts/refresh-credentials.sh" ]; then
    bash /opt/miempresa/scripts/refresh-credentials.sh
    echo "  ✓ Credentials refreshed"
else
    echo "  ⚠ Warning: refresh-credentials.sh not found, using existing credentials"
fi

# Resolve account-scoped bucket name now that credentials are fresh
if [ -z "$AWS_ACCOUNT_ID" ]; then
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    S3_BUCKET="miempresa-backups-${AWS_ACCOUNT_ID}-${STAGE}"
    echo "  S3 Bucket (resolved): ${S3_BUCKET}"
fi

echo ""

# ============================================================================
# Create Database Backup
# ============================================================================

echo "[3/6] Creating database backup..."

# Get database password from SSM Parameter Store
echo "  Retrieving database password..."
DB_PASSWORD=$(aws ssm get-parameter \
    --name "/miempresa/${STAGE}/db/DB_PASSWORD" \
    --with-decryption \
    --query "Parameter.Value" \
    --output text \
    --region "${AWS_REGION}" 2>/dev/null || echo "")

if [ -z "$DB_PASSWORD" ]; then
    echo "  ✗ ERROR: Failed to retrieve database password from SSM"
    exit 1
fi

echo "  Dumping database..."

# Set PostgreSQL password environment variable
export PGPASSWORD="$DB_PASSWORD"

# Perform database dump with gzip compression
pg_dump -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-acl \
        --format=plain | gzip > "$BACKUP_PATH"

# Clear password from environment
unset PGPASSWORD

# Verify backup was created
if [ -f "$BACKUP_PATH" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    echo "  ✓ Database backup created"
    echo "  Size: ${BACKUP_SIZE}"
else
    echo "  ✗ ERROR: Backup file was not created"
    exit 1
fi

echo ""

# ============================================================================
# Upload to S3
# ============================================================================

echo "[4/6] Uploading backup to S3..."

S3_KEY="daily/${BACKUP_FILENAME}"
S3_URI="s3://${S3_BUCKET}/${S3_KEY}"

echo "  Destination: ${S3_URI}"

# Retry logic for S3 upload
UPLOAD_SUCCESS=false

for attempt in $(seq 1 $MAX_RETRIES); do
    echo "  Attempt $attempt/${MAX_RETRIES}..."

    # Upload to S3 with server-side encryption
    if aws s3 cp "$BACKUP_PATH" "$S3_URI" \
        --region "${AWS_REGION}" \
        --sse AES256 \
        --storage-class STANDARD_IA \
        --metadata "stage=${STAGE},database=${DB_NAME},timestamp=${TIMESTAMP}" \
        --tags "Stage=${STAGE},Database=${DB_NAME},BackupDate=$(date +%Y-%m-%d)"; then

        echo "  ✓ Upload successful"
        UPLOAD_SUCCESS=true
        break
    else
        echo "  ✗ Upload failed (attempt $attempt)"

        if [ $attempt -lt $MAX_RETRIES ]; then
            echo "  Retrying in 10 seconds..."
            sleep 10
        fi
    fi
done

if [ "$UPLOAD_SUCCESS" = false ]; then
    echo "  ✗ ERROR: Failed to upload after ${MAX_RETRIES} attempts"
    exit 1
fi

echo ""

# ============================================================================
# Verify S3 Upload
# ============================================================================

echo "[5/6] Verifying S3 upload..."

# Check if object exists in S3
if aws s3 ls "$S3_URI" --region "${AWS_REGION}" &> /dev/null; then
    S3_SIZE=$(aws s3 ls "$S3_URI" --region "${AWS_REGION}" | awk '{print $3}')
    echo "  ✓ Backup verified in S3"
    echo "  S3 Object Size: ${S3_SIZE} bytes"
else
    echo "  ✗ ERROR: Backup not found in S3"
    exit 1
fi

echo ""

# ============================================================================
# Cleanup Old Local Backups
# ============================================================================

echo "[6/6] Cleaning up old local backups..."

# Find and delete backups older than retention period
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "miempresa_${STAGE}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} 2>/dev/null || true)

if [ -n "$OLD_BACKUPS" ]; then
    echo "  Removing backups older than ${RETENTION_DAYS} days:"

    echo "$OLD_BACKUPS" | while read -r old_backup; do
        if [ -f "$old_backup" ]; then
            echo "    - $(basename "$old_backup")"
            rm -f "$old_backup"
        fi
    done

    echo "  ✓ Old backups removed"
else
    echo "  ○ No old backups to remove"
fi

# List remaining local backups
LOCAL_BACKUP_COUNT=$(find "$BACKUP_DIR" -name "miempresa_${STAGE}_*.sql.gz" -type f | wc -l)
echo "  Local backups: ${LOCAL_BACKUP_COUNT}"

echo ""

# ============================================================================
# List Recent S3 Backups
# ============================================================================

echo "Recent S3 backups:"

aws s3 ls "s3://${S3_BUCKET}/daily/" \
    --region "${AWS_REGION}" \
    --human-readable \
    --summarize | tail -10

echo ""

# ============================================================================
# Backup Statistics
# ============================================================================

echo "Backup Statistics:"

# Count total S3 backups
S3_BACKUP_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --region "${AWS_REGION}" | grep "\.sql\.gz$" | wc -l || echo "0")
echo "  Total S3 backups: ${S3_BACKUP_COUNT}"

# Calculate total S3 storage used
S3_TOTAL_SIZE=$(aws s3 ls "s3://${S3_BUCKET}/daily/" --region "${AWS_REGION}" --recursive --summarize | grep "Total Size" | awk '{print $3, $4}' || echo "Unknown")
echo "  Total S3 storage: ${S3_TOTAL_SIZE}"

# Local disk usage
LOCAL_DISK_USAGE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "  Local disk usage: ${LOCAL_DISK_USAGE}"

echo ""

# ============================================================================
# Completion
# ============================================================================

echo "=========================================="
echo "Backup completed successfully"
echo "=========================================="
echo "Completed: $(date)"
echo ""
echo "Summary:"
echo "  Database: ${DB_NAME}"
echo "  Backup file: ${BACKUP_FILENAME}"
echo "  Local path: ${BACKUP_PATH}"
echo "  S3 location: ${S3_URI}"
echo "  Backup size: ${BACKUP_SIZE}"
echo ""
echo "Next backup: $(date -d "tomorrow 02:00" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -v+1d "+%Y-%m-%d 02:00:00" 2>/dev/null || echo "tomorrow at 02:00")"
echo ""

# ============================================================================
# Optional: Send Notification (CloudWatch Logs or SNS)
# ============================================================================

# You can add SNS notification here if needed:
# aws sns publish \
#   --topic-arn "arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:backup-notifications" \
#   --subject "PostgreSQL Backup Successful - ${STAGE}" \
#   --message "Backup completed successfully: ${BACKUP_FILENAME}"

exit 0
