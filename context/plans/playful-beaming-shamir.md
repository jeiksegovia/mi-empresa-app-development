# Backend Infrastructure Plan - AWS Lightsail with PostgreSQL and CodeDeploy

## Context

This plan establishes production-ready backend infrastructure for the Mi Empresa application using AWS Lightsail instances with PostgreSQL databases. The current backend (Node.js/Express/Prisma) is running in development with Docker Compose, but requires a serverless/cloud deployment strategy for dev and prod environments.

**Why this change is needed:**
- Move from local development to production-ready cloud infrastructure
- Enable CI/CD deployments using AWS CodeDeploy
- Provide managed PostgreSQL databases with automated backups to S3
- Implement secure AWS access using STS temporary credentials with auto-refresh
- Support multiple environments (dev, prod) with isolated resources

**Current state:**
- Backend running locally with Docker Compose PostgreSQL
- No production infrastructure exists
- Application uses Prisma ORM with 28+ database models across 8 modules
- Environment variables managed via .env files
- TypeScript application compiles to dist/ for production

**Intended outcome:**
- Complete infrastructure-as-code in `backend/infrastructure/db/`
- Automated Lightsail instance provisioning with PostgreSQL 15 on Amazon Linux 2023
- CodeDeploy integration for zero-downtime deployments
- Automated daily PostgreSQL backups to S3 with retention management
- STS temporary credential refresh (every 50 minutes) for enhanced security
- SSM Parameter Store for environment variable management
- Comprehensive documentation and testing scripts

---

## Implementation Plan

### Directory Structure

Create all infrastructure artifacts in `backend/infrastructure/db/`:

```
backend/
├── infrastructure/
│   └── db/
│       ├── README.md                          # Comprehensive documentation
│       ├── templates/
│       │   ├── lightsail-instance.yml         # Instance creation template
│       │   └── user-data-postgresql.sh        # PostgreSQL installation script
│       ├── scripts/
│       │   ├── create-instance.sh             # Main instance provisioning script
│       │   ├── setup-iam.sh                   # IAM roles/policies setup
│       │   ├── setup-ssm-params.sh            # SSM parameter creation
│       │   ├── env.sh                         # Fetch SSM params → .env
│       │   ├── before-install.sh              # CodeDeploy: cleanup
│       │   ├── after-install.sh               # CodeDeploy: build & migrate
│       │   ├── start-service.sh               # CodeDeploy: start PM2
│       │   ├── stop-service.sh                # CodeDeploy: stop PM2
│       │   ├── validate.sh                    # CodeDeploy: health check
│       │   ├── refresh-credentials.sh         # STS credential auto-refresh
│       │   └── backup-postgres-s3.sh          # Daily DB backup to S3
│       ├── utilities/
│       │   ├── get-instance-ip.sh             # Get static IP by name
│       │   ├── ssh-to-instance.sh             # SSH helper
│       │   ├── install-ssh-key.sh             # Download Lightsail SSH key
│       │   └── check-credentials.sh           # Monitor credential expiration
│       └── tests/
│           └── infrastructure-test.sh         # Bash test suite
├── appspec.yml                                # CodeDeploy deployment spec
└── (existing src/, dist/, prisma/, etc.)
```

---

## Task Breakdown

### Task 1: Create Directory Structure
**Location:** `backend/infrastructure/db/`

Create subdirectories:
- `templates/` - YAML templates and user-data scripts
- `scripts/` - Core deployment and lifecycle scripts
- `utilities/` - Helper scripts for operations
- `tests/` - Infrastructure validation scripts

### Task 2: PostgreSQL Installation User Data Script
**File:** `backend/infrastructure/db/templates/user-data-postgresql.sh`

**Purpose:** Bootstrap Lightsail instance with PostgreSQL 15, CodeDeploy agent, and security configurations.

**Key components:**
1. **System updates:** Update Amazon Linux 2023 packages
2. **PostgreSQL 15 installation:** Follow guide from https://hbayraktar.medium.com/how-to-install-postgresql-15-on-amazon-linux-2023-a-step-by-step-guide-57eebb7ad9fc
   - Install PostgreSQL 15 repository
   - Configure pg_hba.conf for local and network access
   - Create application database and user
   - Enable and start postgresql service
   - Configure to start on boot
3. **CodeDeploy agent setup:**
   - Install Ruby and CodeDeploy agent
   - Create `/etc/codedeploy-agent/conf/codedeploy.onpremises.yml`
   - Enable and start codedeploy-agent service
   - Configure auto-restart on failure (systemd)
4. **Node.js environment:**
   - Install Node.js 20.x LTS via nodesource repository
   - Install PM2 globally for process management
5. **AWS CLI v2 installation:** For SSM and S3 operations
6. **Application directories:**
   - `/opt/miempresa/app` - Application deployment target
   - `/opt/miempresa/scripts` - Runtime scripts
   - `/opt/miempresa/backups` - Local DB backup staging

**Environment variables in user-data:**
- `STAGE` - Environment name (dev, prod)
- `AWS_REGION` - us-east-1
- `DB_NAME` - miempresa_${STAGE}
- `DB_USER` - miempresa
- `DB_PASSWORD` - (Retrieved from SSM or generated)

### Task 3: Lightsail Instance Creation Template
**File:** `backend/infrastructure/db/templates/lightsail-instance.yml`

**Purpose:** YAML template for `aws lightsail create-instances` CLI command.

**Configuration:**
```yaml
instanceNames:
  - ${INSTANCE_NAME}
availabilityZone: ${REGION}a
blueprintId: amazon_linux_2023
bundleId: ${BUNDLE}  # micro_2_0 (dev), small_2_0 (prod)
userData: |-
  # Include user-data-postgresql.sh content
tags:
  - key: Environment
    value: ${STAGE}
  - key: Application
    value: MiEmpresa
  - key: ManagedBy
    value: Terraform
ipAddressType: ipv4
```

**Variables substituted by create-instance.sh:**
- `${INSTANCE_NAME}` - e.g., miempresa-db-dev-1
- `${REGION}` - us-east-1
- `${BUNDLE}` - Instance size based on environment
- `${STAGE}` - dev or prod

### Task 4: Instance Management Script
**File:** `backend/infrastructure/db/scripts/create-instance.sh`

**Purpose:** Orchestrate Lightsail instance creation, static IP allocation, CodeDeploy registration.

**Functionality:**
1. **Environment setup:**
   - Parse command-line arguments (--stage, --region, --bundle)
   - Validate required environment variables
   - Set default values (STAGE=dev, REGION=us-east-1, BUNDLE=micro_2_0)
2. **IAM prerequisite checks:**
   - Verify CodeDeployInstanceRole exists
   - Verify bootstrap IAM user credentials configured
3. **Template rendering:**
   - Load `lightsail-instance.yml`
   - Substitute variables with envsubst
   - Generate stage-specific output: `lightsail-instance-${STAGE}.yml`
4. **Instance creation:**
   - Execute: `aws lightsail create-instances --cli-input-yaml file://lightsail-instance-${STAGE}.yml`
   - Poll instance status until "running"
5. **Static IP allocation:**
   - Create: `aws lightsail allocate-static-ip --static-ip-name miempresa-ip-${STAGE}`
   - Attach to instance
   - Output public IP for SSH access
6. **Wait for CodeDeploy agent:**
   - SSH to instance every 20 seconds
   - Check: `sudo systemctl status codedeploy-agent`
   - Wait until "active (running)"
7. **CodeDeploy registration:**
   - Assume role to get temporary credentials
   - Register: `aws deploy register-on-premises-instance --instance-name ${INSTANCE_NAME}`
   - Tag instance: `Key=DeploymentGroup,Value=miempresa-${STAGE}`
8. **Output summary:**
   - Instance ID, Public IP, SSH command
   - CodeDeploy registration status
   - Next steps instructions

**Reference pattern:** Based on `context/initial/backend-reference/create-lightsail-instance-with-codedeploy.sh`

### Task 5: IAM Setup Scripts
**File:** `backend/infrastructure/db/scripts/setup-iam.sh`

**Purpose:** Create IAM roles, policies, and bootstrap user for STS credential workflow.

**Components:**

1. **CodeDeployInstanceRole:**
   - Trust policy: Allow STS AssumeRole
   - Managed policies:
     - Custom policy for S3 (CodeDeploy artifacts, backups)
     - Custom policy for SSM Parameter Store (`/miempresa/${STAGE}/*`)
     - Custom policy for CloudWatch Logs
   - Session duration: 1 hour

2. **Bootstrap IAM User:**
   - User name: `miempresa-bootstrap`
   - Inline policy: Allow `sts:AssumeRole` for CodeDeployInstanceRole
   - Create access key
   - Store credentials in SSM: `/miempresa/bootstrap/access-key-id` and `secret-access-key`

3. **IAM Policy: CodeDeployInstancePolicy**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
         "Resource": [
           "arn:aws:s3:::codedeploy-artifacts-*",
           "arn:aws:s3:::miempresa-backups-*/*"
         ]
       },
       {
         "Effect": "Allow",
         "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
         "Resource": "arn:aws:ssm:us-east-1:ACCOUNT_ID:parameter/miempresa/*"
       },
       {
         "Effect": "Allow",
         "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
         "Resource": "arn:aws:logs:us-east-1:ACCOUNT_ID:log-group:/aws/miempresa/*"
       },
       {
         "Effect": "Allow",
         "Action": ["kms:Decrypt"],
         "Resource": "arn:aws:kms:us-east-1:ACCOUNT_ID:key/*"
       }
     ]
   }
   ```

**Outputs:**
- IAM role ARN
- Bootstrap user access key (stored in SSM)
- Confirmation of policy attachments

### Task 6: CodeDeploy Lifecycle Scripts
**Files:** `backend/infrastructure/db/scripts/{before-install,after-install,start-service,stop-service,validate}.sh`

**Reference:** Based on `context/initial/backend-reference/scripts/`

#### before-install.sh
- Log to `/opt/miempresa/logs/before-install.log`
- Stop PM2 processes if running
- Clean `/opt/miempresa/app` directory
- Create fresh deployment directory
- Verify Node.js/npm availability

#### after-install.sh
- Log to `/opt/miempresa/logs/after-install.log`
- Export environment: `REGION=${AWS_REGION}`, `STAGE=$(deployment-group-name)`
- Change to `/opt/miempresa/app`
- Install dependencies: `npm ci --production`
- Generate Prisma client: `npm run db:generate`
- Run database migrations: `npx prisma migrate deploy`
- Build TypeScript: `npm run build`
- Copy generated Prisma client to dist/: `cp -R src/generated dist/src/`
- Fetch environment variables: `./scripts/env.sh`

#### start-service.sh
- Log to `/opt/miempresa/logs/start-service.log`
- Change to `/opt/miempresa/app`
- Start PM2 process: `pm2 start dist/server.js --name miempresa-api --instances 1`
- Save PM2 configuration: `pm2 save`
- Setup PM2 startup script: `pm2 startup systemd -u ubuntu --hp /home/ubuntu`

#### stop-service.sh
- Log to `/opt/miempresa/logs/stop-service.log`
- Stop PM2 gracefully: `pm2 stop miempresa-api || true`
- Wait for graceful shutdown (5 seconds)

#### validate.sh
- Log to `/opt/miempresa/logs/validate.log`
- Health check: `curl -f http://localhost:3001/api/v1/health`
- Check PM2 process: `pm2 list | grep miempresa-api`
- Exit 0 if healthy, exit 1 if failed

### Task 7: SSM Parameter Management Script
**File:** `backend/infrastructure/db/scripts/setup-ssm-params.sh`

**Purpose:** Create/update SSM parameters for application environment variables.

**Parameters to create:**

**Database:**
- `/miempresa/${STAGE}/db/DATABASE_URL` - `postgresql://user:pass@localhost:5432/miempresa_${STAGE}`

**JWT:**
- `/miempresa/${STAGE}/api/JWT_SECRET` - Generated 64-char random string
- `/miempresa/${STAGE}/api/JWT_EXPIRATION` - `24h`

**AWS:**
- `/miempresa/${STAGE}/api/AWS_REGION` - `us-east-1`
- `/miempresa/${STAGE}/api/AWS_S3_BUCKET` - `miempresa-uploads-${STAGE}`

**CORS:**
- `/miempresa/${STAGE}/api/CORS_ORIGIN` - Frontend URL (dev: localhost:3000, prod: domain)

**Upload:**
- `/miempresa/${STAGE}/api/MAX_FILE_SIZE_MB` - `100`

**Script functionality:**
```bash
#!/bin/bash
STAGE=${1:-dev}
REGION=${2:-us-east-1}

create_param() {
  local name=$1
  local value=$2
  local type=${3:-String}

  aws ssm put-parameter \
    --name "$name" \
    --value "$value" \
    --type "$type" \
    --overwrite \
    --region "$REGION"
}

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)

# Create parameters
create_param "/miempresa/${STAGE}/db/DATABASE_URL" "postgresql://..." "SecureString"
create_param "/miempresa/${STAGE}/api/JWT_SECRET" "$JWT_SECRET" "SecureString"
# ... (continue for all params)
```

### Task 8: Environment Variable Loader Script
**File:** `backend/infrastructure/db/scripts/env.sh`

**Purpose:** Fetch SSM parameters and generate `.env` file for application runtime.

**Reference:** Based on `context/initial/backend-reference/scripts/env.sh`

**Functionality:**
```bash
#!/bin/bash
# Expected environment: STAGE, REGION

getSsmParam() {
  aws ssm get-parameter \
    --name "$1" \
    --with-decryption \
    --query "Parameter.Value" \
    --output text \
    --region "$REGION" 2>/dev/null || echo ""
}

# Generate .env file
cat > .env <<EOF
NODE_ENV=${STAGE}
PORT=3001

# Database
DATABASE_URL=$(getSsmParam "/miempresa/${STAGE}/db/DATABASE_URL")

# JWT
JWT_SECRET=$(getSsmParam "/miempresa/${STAGE}/api/JWT_SECRET")
JWT_EXPIRATION=$(getSsmParam "/miempresa/${STAGE}/api/JWT_EXPIRATION")

# AWS
AWS_REGION=${REGION}
AWS_S3_BUCKET=$(getSsmParam "/miempresa/${STAGE}/api/AWS_S3_BUCKET")

# CORS
CORS_ORIGIN=$(getSsmParam "/miempresa/${STAGE}/api/CORS_ORIGIN")

# Upload
MAX_FILE_SIZE_MB=$(getSsmParam "/miempresa/${STAGE}/api/MAX_FILE_SIZE_MB")
EOF

chmod 600 .env
echo "Generated .env from SSM parameters"
```

**Called by:** after-install.sh during deployment

### Task 9: PostgreSQL Backup to S3 Script
**File:** `backend/infrastructure/db/scripts/backup-postgres-s3.sh`

**Purpose:** Daily automated PostgreSQL backups uploaded to S3 with retention management.

**Key features:**
1. **Database dump:** `pg_dump` with gzip compression
2. **Credential refresh:** Refresh STS credentials before S3 upload
3. **S3 upload:** Upload to `s3://miempresa-backups-${STAGE}/daily/`
4. **Retention:** Delete local backups older than 30 days
5. **Logging:** Comprehensive logging to `/var/log/postgres-backup.log`
6. **Error handling:** Retry logic (3 attempts) for S3 upload
7. **Metadata:** S3 object tags with backup date, database name

**Configuration:**
```bash
DB_NAME="miempresa_${STAGE}"
DB_USER="miempresa"
DB_HOST="localhost"
S3_BUCKET="miempresa-backups-${STAGE}"
BACKUP_DIR="/opt/miempresa/backups"
RETENTION_DAYS=30
```

**Execution flow:**
1. Create backup: `pg_dump -h localhost -U miempresa miempresa_dev | gzip > backup.sql.gz`
2. Refresh credentials: Source `/opt/miempresa/scripts/refresh-credentials.sh`
3. Upload: `aws s3 cp backup.sql.gz s3://bucket/daily/ --sse AES256`
4. Verify upload: Check S3 object existence
5. Cleanup: Remove old local backups
6. Report: Log success/failure, list recent S3 backups

**CRON schedule:** Daily at 2 AM
```bash
0 2 * * * /opt/miempresa/scripts/backup-postgres-s3.sh
```

### Task 10: STS Credential Refresh Script
**File:** `backend/infrastructure/db/scripts/refresh-credentials.sh`

**Purpose:** Automatically refresh STS temporary credentials every 50 minutes.

**AWS Best Practice:** Based on research findings from agent a54c523396f813d21

**Implementation:**
```bash
#!/bin/bash
set -e

# Configuration
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --profile bootstrap)"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/CodeDeployInstanceRole"
ROLE_SESSION_NAME="lightsail-$(hostname)"
AWS_REGION="us-east-1"

# Assume role using bootstrap credentials
TEMP_CREDS=$(aws sts assume-role \
  --role-arn "${ROLE_ARN}" \
  --role-session-name "${ROLE_SESSION_NAME}" \
  --duration-seconds 3600 \
  --region "${AWS_REGION}" \
  --profile bootstrap \
  --output json)

# Extract credentials
ACCESS_KEY=$(echo "$TEMP_CREDS" | jq -r '.Credentials.AccessKeyId')
SECRET_KEY=$(echo "$TEMP_CREDS" | jq -r '.Credentials.SecretAccessKey')
SESSION_TOKEN=$(echo "$TEMP_CREDS" | jq -r '.Credentials.SessionToken')
EXPIRATION=$(echo "$TEMP_CREDS" | jq -r '.Credentials.Expiration')

# Update credentials file for CodeDeploy agent
mkdir -p /root/.aws
cat > /root/.aws/credentials <<EOF
[default]
aws_access_key_id = ${ACCESS_KEY}
aws_secret_access_key = ${SECRET_KEY}
aws_session_token = ${SESSION_TOKEN}
EOF

chmod 600 /root/.aws/credentials

# Update CodeDeploy agent config
mkdir -p /etc/codedeploy-agent/conf
cat > /etc/codedeploy-agent/conf/codedeploy.onpremises.yml <<EOF
---
iam_session_arn: arn:aws:sts::${ACCOUNT_ID}:assumed-role/CodeDeployInstanceRole/${ROLE_SESSION_NAME}
aws_credentials_file: /root/.aws/credentials
region: ${AWS_REGION}
EOF

# Restart CodeDeploy agent to pick up new credentials
sudo systemctl restart codedeploy-agent

# Log success
echo "[$(date)] Credentials refreshed. Expiration: ${EXPIRATION}" >> /var/log/credential-refresh.log
```

**CRON schedule:** Every 50 minutes (before 1-hour expiration)
```bash
*/50 * * * * /opt/miempresa/scripts/refresh-credentials.sh
```

**Critical note:** CodeDeploy agent MUST be restarted after credential update (AWS requirement).

### Task 11: Utility Scripts
**Files:** `backend/infrastructure/db/utilities/*.sh`

#### get-instance-ip.sh
```bash
#!/bin/bash
INSTANCE_NAME=${1:-miempresa-db-dev-1}
REGION=${2:-us-east-1}

aws lightsail get-static-ip \
  --static-ip-name "miempresa-ip-${STAGE}" \
  --query "staticIp.ipAddress" \
  --output text \
  --region "$REGION"
```

#### ssh-to-instance.sh
```bash
#!/bin/bash
INSTANCE_NAME=${1:-miempresa-db-dev-1}
REGION=${2:-us-east-1}

IP=$(./get-instance-ip.sh "$INSTANCE_NAME" "$REGION")
SSH_KEY="${HOME}/.ssh/miempresa-lightsail-key.pem"

ssh -i "$SSH_KEY" ec2-user@"$IP"
```

#### install-ssh-key.sh
```bash
#!/bin/bash
REGION=${1:-us-east-1}

aws lightsail download-default-key-pair \
  --region "$REGION" \
  --query "privateKeyBase64" \
  --output text | base64 --decode > ~/.ssh/miempresa-lightsail-key.pem

chmod 400 ~/.ssh/miempresa-lightsail-key.pem
echo "SSH key downloaded to ~/.ssh/miempresa-lightsail-key.pem"
```

#### check-credentials.sh
```bash
#!/bin/bash
# Monitor credential validity and expiration

CRED_FILE="/root/.aws/credentials"

if [ ! -f "$CRED_FILE" ]; then
  echo "ERROR: Credentials file not found"
  exit 1
fi

# Test credentials
CALLER_IDENTITY=$(aws sts get-caller-identity 2>&1)

if [ $? -eq 0 ]; then
  echo "✓ Credentials are valid"
  echo "$CALLER_IDENTITY"
else
  echo "✗ Credentials are INVALID or EXPIRED"
  echo "$CALLER_IDENTITY"
  exit 1
fi

# Check CodeDeploy agent
if systemctl is-active --quiet codedeploy-agent; then
  echo "✓ CodeDeploy agent is running"
else
  echo "✗ CodeDeploy agent is NOT running"
  exit 1
fi
```

### Task 12: Create appspec.yml
**File:** `backend/appspec.yml` (root of backend)

**Purpose:** Define CodeDeploy deployment lifecycle and file mappings.

```yaml
version: 0.0
os: linux

files:
  - source: /
    destination: /opt/miempresa/app

permissions:
  - object: /opt/miempresa/app
    pattern: "**"
    owner: ec2-user
    group: ec2-user
    mode: 755
    type:
      - directory
  - object: /opt/miempresa/app
    pattern: "**"
    owner: ec2-user
    group: ec2-user
    mode: 644
    type:
      - file
  - object: /opt/miempresa/app/infrastructure/db/scripts
    pattern: "*.sh"
    owner: root
    group: root
    mode: 755
    type:
      - file

hooks:
  BeforeInstall:
    - location: infrastructure/db/scripts/before-install.sh
      timeout: 300
      runas: root

  AfterInstall:
    - location: infrastructure/db/scripts/after-install.sh
      timeout: 600
      runas: root

  ApplicationStart:
    - location: infrastructure/db/scripts/start-service.sh
      timeout: 300
      runas: root

  ValidateService:
    - location: infrastructure/db/scripts/validate.sh
      timeout: 60
      runas: root
```

**File mappings:**
- Deploy entire backend codebase to `/opt/miempresa/app`
- Preserve directory structure
- Set executable permissions on shell scripts

**Hooks:**
- BeforeInstall: Stop services, clean directory
- AfterInstall: Install deps, build, migrate DB, generate .env
- ApplicationStart: Start PM2 process
- ValidateService: Health check API endpoint

### Task 13: Comprehensive Documentation
**File:** `backend/infrastructure/db/README.md`

**Sections:**

1. **Overview**
   - Architecture diagram (ASCII)
   - Component descriptions (Lightsail, PostgreSQL, CodeDeploy, S3)
   - Security model (STS temporary credentials)

2. **Prerequisites**
   - AWS account with appropriate permissions
   - AWS CLI v2 installed
   - jq, envsubst utilities
   - SSH key pair

3. **Quick Start**
   ```bash
   # Step 1: Setup IAM
   ./scripts/setup-iam.sh

   # Step 2: Create SSM parameters
   ./scripts/setup-ssm-params.sh dev us-east-1

   # Step 3: Create Lightsail instance
   ./scripts/create-instance.sh --stage dev --region us-east-1

   # Step 4: SSH to instance
   ./utilities/ssh-to-instance.sh miempresa-db-dev-1

   # Step 5: Verify setup
   ./utilities/check-credentials.sh
   ```

4. **Architecture Diagram**
   ```
   ┌─────────────────────────────────────────────────────────────────┐
   │                         AWS Account                              │
   │                                                                   │
   │  ┌────────────────────────────────────────────────────────────┐ │
   │  │  Lightsail Instance (Amazon Linux 2023)                    │ │
   │  │                                                              │ │
   │  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
   │  │  │ PostgreSQL15 │  │ Node.js/PM2  │  │  CodeDeploy     │  │ │
   │  │  │    :5432     │  │    :3001     │  │     Agent       │  │ │
   │  │  └──────────────┘  └──────────────┘  └─────────────────┘  │ │
   │  │                                                              │ │
   │  │  ┌──────────────────────────────────────────────────────┐  │ │
   │  │  │ CRON Jobs:                                            │  │ │
   │  │  │  */50 * * * * refresh-credentials.sh                 │  │ │
   │  │  │  0 2 * * * backup-postgres-s3.sh                     │  │ │
   │  │  └──────────────────────────────────────────────────────┘  │ │
   │  └────────────────────────────────────────────────────────────┘ │
   │                              │                                    │
   │         ┌────────────────────┼────────────────────┐              │
   │         │                    │                    │              │
   │    ┌────▼────┐         ┌────▼────┐         ┌────▼─────┐        │
   │    │   S3    │         │   SSM   │         │   IAM    │        │
   │    │ Backups │         │ Params  │         │ STS Role │        │
   │    └─────────┘         └─────────┘         └──────────┘        │
   │                                                                   │
   └─────────────────────────────────────────────────────────────────┘
   ```

5. **Environment Variables**
   - List all SSM parameters
   - Environment-specific values

6. **Deployment Process**
   - CodeDeploy application and deployment group setup
   - GitHub Actions / CI/CD integration
   - Manual deployment commands

7. **Database Management**
   - Connect to PostgreSQL: `psql -h localhost -U miempresa -d miempresa_dev`
   - Run migrations: `npx prisma migrate deploy`
   - Seed data: `npm run db:seed`
   - Backup manually: `./scripts/backup-postgres-s3.sh`
   - Restore from backup: Instructions with S3 download and pg_restore

8. **Monitoring and Maintenance**
   - Check credentials: `./utilities/check-credentials.sh`
   - View logs:
     - Application: `pm2 logs miempresa-api`
     - CodeDeploy: `/opt/codedeploy-agent/deployment-root/deployment-logs/`
     - Backups: `/var/log/postgres-backup.log`
     - Credentials: `/var/log/credential-refresh.log`
   - Restart services:
     - PM2: `pm2 restart miempresa-api`
     - CodeDeploy: `sudo systemctl restart codedeploy-agent`
     - PostgreSQL: `sudo systemctl restart postgresql-15`

9. **Troubleshooting**
   - **CodeDeploy agent not running:** Check logs, restart agent, verify credentials
   - **Credentials expired:** Run refresh-credentials.sh manually
   - **Database connection failed:** Check PostgreSQL service, pg_hba.conf, DATABASE_URL
   - **S3 upload failed:** Verify IAM permissions, check network connectivity
   - **Deployment failed:** Check appspec.yml, script logs, CodeDeploy console

10. **Security Best Practices**
    - Rotate bootstrap credentials monthly
    - Use SecureString for sensitive SSM parameters
    - Enable S3 bucket encryption (AES256)
    - Restrict security group to necessary ports
    - Enable CloudTrail for audit logging
    - Regular security updates: `sudo yum update`

11. **Cost Optimization**
    - Lightsail micro_2_0: ~$5/month (dev)
    - Lightsail small_2_0: ~$10/month (prod)
    - S3 storage: ~$0.023/GB/month
    - Data transfer: First 1GB free, then $0.09/GB

12. **Disaster Recovery**
    - Daily automated backups to S3
    - 30-day retention policy
    - Restore procedure:
      1. Download backup: `aws s3 cp s3://bucket/daily/backup.sql.gz .`
      2. Decompress: `gunzip backup.sql.gz`
      3. Restore: `psql -U miempresa -d miempresa_dev < backup.sql`
    - Infrastructure-as-code allows quick instance recreation

### Task 14: Infrastructure Testing Script
**File:** `backend/infrastructure/db/tests/infrastructure-test.sh`

**Purpose:** Validate infrastructure setup with automated tests.

**Test cases:**

1. **Lightsail Instance Tests**
   - Instance exists and is running
   - Static IP allocated and attached
   - Security group allows port 3001 (API)
   - SSH connectivity test

2. **CodeDeploy Tests**
   - Instance registered with CodeDeploy
   - Proper tags configured
   - Agent running and healthy
   - Can receive deployments

3. **IAM/Credentials Tests**
   - Bootstrap credentials valid
   - Can assume CodeDeployInstanceRole
   - Temporary credentials not expired
   - Credential refresh CRON job configured

4. **PostgreSQL Tests**
   - Service running and enabled
   - Can connect locally
   - Database exists
   - Migrations applied

5. **Application Tests**
   - PM2 process running
   - Health endpoint responds (HTTP 200)
   - Environment variables loaded correctly
   - Prisma client generated

6. **S3/Backup Tests**
   - S3 bucket exists and accessible
   - Can upload test file
   - Backup script executable
   - CRON job configured

7. **SSM Parameter Tests**
   - All required parameters exist
   - Can read parameters
   - SecureString parameters encrypted

**Execution:**
```bash
#!/bin/bash
cd backend/infrastructure/db/tests
./infrastructure-test.sh --stage dev --verbose

# Output:
# ✓ Instance miempresa-db-dev-1 is running
# ✓ Static IP 12.34.56.78 attached
# ✓ CodeDeploy agent is active
# ✓ PostgreSQL service is running
# ✓ PM2 process miempresa-api online
# ✓ Health check passed: HTTP 200
# ✓ S3 bucket miempresa-backups-dev accessible
# ✓ All SSM parameters present
#
# Tests: 8/8 passed
```

---

## Critical Files Modified/Created

**New files (14 shell scripts + 3 config files):**
1. `backend/infrastructure/db/README.md`
2. `backend/infrastructure/db/templates/lightsail-instance.yml`
3. `backend/infrastructure/db/templates/user-data-postgresql.sh`
4. `backend/infrastructure/db/scripts/create-instance.sh`
5. `backend/infrastructure/db/scripts/setup-iam.sh`
6. `backend/infrastructure/db/scripts/setup-ssm-params.sh`
7. `backend/infrastructure/db/scripts/env.sh`
8. `backend/infrastructure/db/scripts/before-install.sh`
9. `backend/infrastructure/db/scripts/after-install.sh`
10. `backend/infrastructure/db/scripts/start-service.sh`
11. `backend/infrastructure/db/scripts/stop-service.sh`
12. `backend/infrastructure/db/scripts/validate.sh`
13. `backend/infrastructure/db/scripts/refresh-credentials.sh`
14. `backend/infrastructure/db/scripts/backup-postgres-s3.sh`
15. `backend/infrastructure/db/utilities/get-instance-ip.sh`
16. `backend/infrastructure/db/utilities/ssh-to-instance.sh`
17. `backend/infrastructure/db/utilities/install-ssh-key.sh`
18. `backend/infrastructure/db/utilities/check-credentials.sh`
19. `backend/infrastructure/db/tests/infrastructure-test.sh`
20. `backend/appspec.yml`

**No existing files modified** - This is net-new infrastructure setup.

---

## Verification Steps

### Local Verification (Before AWS Deployment)

1. **Validate script syntax:**
   ```bash
   cd backend/infrastructure/db
   shellcheck scripts/*.sh utilities/*.sh tests/*.sh
   ```

2. **Test YAML template rendering:**
   ```bash
   export INSTANCE_NAME=test-instance
   export REGION=us-east-1
   export BUNDLE=micro_2_0
   export STAGE=dev
   envsubst < templates/lightsail-instance.yml
   ```

3. **Review appspec.yml:**
   ```bash
   aws deploy validate-appspec --appspec-content file://backend/appspec.yml
   ```

### AWS Infrastructure Verification

1. **Setup IAM (one-time):**
   ```bash
   cd backend/infrastructure/db
   ./scripts/setup-iam.sh
   ```

2. **Configure SSM parameters:**
   ```bash
   ./scripts/setup-ssm-params.sh dev us-east-1
   ./scripts/setup-ssm-params.sh prod us-east-1
   ```

3. **Create dev instance:**
   ```bash
   ./scripts/create-instance.sh --stage dev --region us-east-1 --bundle micro_2_0
   ```

4. **Wait for instance provisioning** (~5-10 minutes)

5. **SSH to instance:**
   ```bash
   ./utilities/install-ssh-key.sh
   ./utilities/ssh-to-instance.sh miempresa-db-dev-1
   ```

6. **On instance, verify components:**
   ```bash
   # PostgreSQL
   sudo systemctl status postgresql-15
   psql -U miempresa -d miempresa_dev -c "SELECT version();"

   # CodeDeploy
   sudo systemctl status codedeploy-agent

   # Credentials
   sudo cat /root/.aws/credentials

   # CRON jobs
   sudo crontab -l
   ```

7. **Test credential refresh:**
   ```bash
   sudo /opt/miempresa/scripts/refresh-credentials.sh
   cat /var/log/credential-refresh.log
   ```

8. **Test backup script:**
   ```bash
   sudo /opt/miempresa/scripts/backup-postgres-s3.sh
   aws s3 ls s3://miempresa-backups-dev/daily/
   ```

9. **Deploy application via CodeDeploy:**
   ```bash
   # From local machine
   cd backend
   zip -r ../deployment.zip . -x "node_modules/*" "dist/*"

   aws s3 cp ../deployment.zip s3://codedeploy-artifacts-YOUR-REGION/miempresa/

   aws deploy create-deployment \
     --application-name MiEmpresa \
     --deployment-group-name miempresa-dev \
     --s3-location bucket=codedeploy-artifacts-YOUR-REGION,key=miempresa/deployment.zip,bundleType=zip
   ```

10. **Test deployed application:**
    ```bash
    INSTANCE_IP=$(./utilities/get-instance-ip.sh miempresa-db-dev-1)
    curl http://${INSTANCE_IP}:3001/api/v1/health
    # Expected: {"status":"ok","timestamp":"..."}
    ```

11. **Run infrastructure tests:**
    ```bash
    ./tests/infrastructure-test.sh --stage dev --verbose
    ```

### End-to-End Verification

1. **Database connectivity:**
   ```bash
   curl -X POST http://${INSTANCE_IP}:3001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"password123"}'
   # Should return JWT token
   ```

2. **SSM parameters loaded:**
   ```bash
   ssh ec2-user@${INSTANCE_IP} "cat /opt/miempresa/app/.env | grep DATABASE_URL"
   ```

3. **Backups scheduled:**
   ```bash
   ssh ec2-user@${INSTANCE_IP} "sudo crontab -l | grep backup"
   ```

4. **Monitor logs:**
   ```bash
   ssh ec2-user@${INSTANCE_IP}
   tail -f /var/log/credential-refresh.log
   tail -f /var/log/postgres-backup.log
   pm2 logs miempresa-api
   ```

---

## Risk Mitigation

**Security Risks:**
- **STS credential expiration:** Mitigated by CRON refresh every 50 minutes + monitoring
- **Bootstrap credentials exposure:** Store in SSM, rotate monthly, restrict permissions
- **Database password in SSM:** Use SecureString with KMS encryption
- **SSH key security:** Download once, store securely, rotate periodically

**Operational Risks:**
- **CodeDeploy failures:** Comprehensive logging, rollback capability, validate.sh health checks
- **Database migration failures:** Test migrations in dev first, backup before prod migrations
- **Backup failures:** Retry logic, CloudWatch alarms, test restore procedures
- **Instance downtime:** Static IP persists, PM2 auto-restart, systemd service auto-restart

**Cost Risks:**
- **S3 storage growth:** 30-day retention policy, lifecycle rules to Glacier after 90 days
- **Oversized instances:** Start with micro_2_0, scale up based on monitoring

---

## Next Steps After Implementation

1. **Setup CodeDeploy application and deployment groups:**
   ```bash
   aws deploy create-application --application-name MiEmpresa

   aws deploy create-deployment-group \
     --application-name MiEmpresa \
     --deployment-group-name miempresa-dev \
     --on-premises-instance-tag-filters Key=Environment,Value=dev,Type=KEY_AND_VALUE
   ```

2. **Configure CI/CD pipeline (GitHub Actions):**
   - On push to `main`: deploy to dev
   - On release tag: deploy to prod
   - Run tests before deployment
   - Notify on success/failure

3. **Setup CloudWatch monitoring:**
   - CPU utilization alarms
   - Disk space alerts
   - Failed API call metrics
   - Backup success/failure notifications

4. **Implement log aggregation:**
   - Configure CloudWatch Logs agent
   - Ship application logs to CloudWatch
   - Create log insights queries

5. **Document runbooks:**
   - Incident response procedures
   - Scaling procedures
   - Disaster recovery drills
   - On-call rotation

---

## Testing Strategy

**Unit Tests:**
- Each shell script should be independently testable
- Mock AWS CLI commands for local testing
- Use shellcheck for syntax validation

**Integration Tests:**
- `infrastructure-test.sh` validates all components together
- Tests run on actual AWS resources (dev environment)
- Can be automated in CI/CD

**Smoke Tests:**
- Health endpoint responds
- Database connection succeeds
- Authentication works
- Basic CRUD operations function

**Load Tests (Future):**
- Artillery or k6 for API load testing
- Database connection pooling validation
- PM2 cluster mode evaluation

---

## Maintenance Schedule

**Daily:**
- Automated backups (2 AM)
- Credential refresh (every 50 minutes via CRON)

**Weekly:**
- Review CloudWatch logs and metrics
- Check backup integrity (test restore)
- Verify CodeDeploy deployments

**Monthly:**
- Rotate bootstrap IAM credentials
- Review and update SSM parameters
- Security patch updates (yum update)
- Review S3 storage costs and retention

**Quarterly:**
- Disaster recovery drill
- Load testing
- Cost optimization review
- Documentation updates

---

## Success Criteria

Infrastructure is considered successfully implemented when:

1. ✅ All 20 files created and validated
2. ✅ Lightsail instances created for dev and prod
3. ✅ PostgreSQL 15 installed and accessible
4. ✅ CodeDeploy agent running and receiving deployments
5. ✅ STS credentials refreshing automatically
6. ✅ Daily backups uploading to S3
7. ✅ Application deployed and health check passing
8. ✅ All infrastructure tests passing
9. ✅ Documentation complete and reviewed
10. ✅ Team trained on deployment process

---

## References

**Existing patterns reused:**
- CodeDeploy lifecycle scripts pattern from `context/initial/backend-reference/scripts/`
- Lightsail creation script pattern from `context/initial/backend-reference/create-lightsail-instance-with-codedeploy.sh`
- Template rendering with envsubst from reference implementation
- SSM parameter fetching from `context/initial/backend-reference/scripts/env.sh`

**AWS documentation referenced:**
- STS temporary credentials with CodeDeploy (from research agent a54c523396f813d21)
- PostgreSQL 15 installation guide: https://hbayraktar.medium.com/how-to-install-postgresql-15-on-amazon-linux-2023-a-step-by-step-guide-57eebb7ad9fc
- CodeDeploy environment variables: https://aws.amazon.com/blogs/devops/using-codedeploy-environment-variables/

**Current backend structure (from exploration agent af10bd341e390b40d):**
- Express.js app at `backend/src/app.ts`
- Server entry at `backend/src/server.ts`
- Prisma schema at `backend/prisma/schema.prisma` (28+ models, 8 modules)
- Build output to `backend/dist/`
- PM2 process management
- Environment config via `backend/src/config/env.ts`
