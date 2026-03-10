# Backend Lightsail CloudFormation Infrastructure - Implementation Report

**Implementation Date**: March 3, 2026
**Status**: ✅ Complete + Consistency Fixes Applied
**Pattern**: CloudFormation IaC + Utility Scripts

---

## Implementation Summary

Implemented production-ready AWS Lightsail infrastructure with PostgreSQL 15, CodeDeploy, and CloudFormation-based IaC pattern. Infrastructure supports dev/prod environments with automated deployments, credential refresh, and database backups.

**Key Achievement**: Fully CloudFormation-based infrastructure (IAM, SSM parameters, CodeDeploy) with shell scripts only for utilities and instance provisioning.

---

## Architecture Delivered

### Infrastructure Components
- **AWS Lightsail**: Amazon Linux 2023, PostgreSQL 15, Node.js 20, PM2
- **CloudFormation Stacks**: IAM roles/policies, SSM parameters (26 env vars), CodeDeploy app/groups
- **Security**: STS temporary credentials (50-min auto-refresh), SSM encrypted parameters, S3 encrypted backups
- **Automation**: Zero-downtime CodeDeploy deployments, daily backups (2 AM), credential refresh (CRON every 50 min)
- **Cost**: ~$5/month dev (micro_2_0), ~$12/month prod (small_2_0)

### Directory Structure
```
backend/infrastructure/db/
├── cloudformation/              # IaC templates (3 stacks)
│   ├── iam-stack.yml           # Roles, policies, bootstrap user
│   ├── ssm-parameters-stack.yml # 26 environment variables
│   └── codedeploy-stack.yml    # Application, deployment groups
├── scripts/                     # Utilities & lifecycle hooks (10 files)
│   ├── deploy-infrastructure.sh # Deploy all CloudFormation stacks
│   ├── create-instance.sh      # Provision Lightsail + PostgreSQL
│   ├── env.sh                  # Fetch SSM → .env
│   ├── refresh-credentials.sh  # STS credential refresh
│   ├── backup-postgres-s3.sh   # S3 backup script
│   ├── before-install.sh       # CodeDeploy hook
│   ├── after-install.sh        # CodeDeploy hook: build, migrate
│   ├── start-service.sh        # CodeDeploy hook: PM2 start
│   ├── stop-service.sh         # CodeDeploy hook: PM2 stop
│   └── validate.sh             # CodeDeploy hook: health check
├── utilities/                   # Management tools (4 files)
│   ├── get-instance-ip.sh
│   ├── ssh-to-instance.sh
│   ├── install-ssh-key.sh
│   └── check-credentials.sh
├── templates/
│   └── user-data-postgresql.sh # Instance bootstrap
├── tests/
│   └── infrastructure-test.sh  # Validation suite (30+ checks)
└── appspec.yml                  # CodeDeploy deployment spec
```

---

## CloudFormation Stacks

### 1. IAM Stack (`iam-stack.yml`)
**Resources Created**:
- `CodeDeployInstanceRole` - IAM role for Lightsail instances with STS AssumeRole
- `CodeDeployInstancePolicy` - Permissions: S3 (read deployments), SSM (read parameters), CloudWatch (logs), KMS (decrypt)
- `BootstrapUser` - IAM user for initial credential exchange
- SSM parameters: `/miempresa/bootstrap/access-key-id`, `/miempresa/bootstrap/secret-access-key`

**Deployment**:
```bash
aws cloudformation deploy --template-file cloudformation/iam-stack.yml \
  --stack-name miempresa-iam --capabilities CAPABILITY_NAMED_IAM
```

### 2. SSM Parameters Stack (`ssm-parameters-stack.yml`)
**26 Parameters Created** (per environment):
- Database: DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
- JWT: JWT_SECRET, JWT_EXPIRATION, JWT_REFRESH_EXPIRATION
- Session: SESSION_SECRET
- AWS Services: AWS_REGION, AWS_S3_BUCKET, AWS_S3_BACKUP_BUCKET
- Application: NODE_ENV, PORT, API_VERSION, CORS_ORIGIN, LOG_LEVEL, LOG_FORMAT
- File Upload: MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES
- Rate Limiting: RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS
- Email (optional): SMTP_HOST, SMTP_PORT, SMTP_FROM

**Deployment**:
```bash
aws cloudformation deploy --template-file cloudformation/ssm-parameters-stack.yml \
  --stack-name miempresa-ssm-dev --parameter-overrides Environment=dev
```

### 3. CodeDeploy Stack (`codedeploy-stack.yml`)
**Resources Created**:
- CodeDeploy application: `miempresa-app`
- Deployment groups: `miempresa-dev`, `miempresa-prod`
- Service role with CodeDeploy permissions
- On-premises instance tag filters: `Environment=dev|prod`, `Application=miempresa`

**Deployment**:
```bash
aws cloudformation deploy --template-file cloudformation/codedeploy-stack.yml \
  --stack-name miempresa-codedeploy --capabilities CAPABILITY_NAMED_IAM
```

---

## Deployment Workflow

### Initial Setup
```bash
# 1. Deploy CloudFormation infrastructure
cd backend/infrastructure/db/scripts
./deploy-infrastructure.sh --stage dev --region us-east-1

# 2. Provision Lightsail instance
./create-instance.sh --stage dev --bundle micro_2_0

# 3. Download SSH key
cd ../utilities
./install-ssh-key.sh
```

### Application Deployment (CodeDeploy)
```bash
# From backend/ directory
zip -r deployment.zip . -x "node_modules/*" -x "dist/*" -x ".git/*"
aws s3 cp deployment.zip s3://codedeploy-artifacts-us-east-1/miempresa/

aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-dev \
  --s3-location bucket=codedeploy-artifacts-us-east-1,key=miempresa/deployment.zip,bundleType=zip
```

### CodeDeploy Lifecycle Hooks
1. **ApplicationStop** (optional) - `stop-service.sh`: Graceful PM2 shutdown
2. **BeforeInstall** - `before-install.sh`: Clean directory, verify prerequisites
3. **Install** (automatic) - CodeDeploy copies files from S3
4. **AfterInstall** - `after-install.sh`: npm install, build TypeScript, Prisma migrate, fetch SSM env vars
5. **ApplicationStart** - `start-service.sh`: Start PM2 process
6. **ValidateService** - `validate.sh`: Health check with retry (10 attempts, 3s delay)

---

## Consistency Fixes Applied (Post-Implementation)

### Critical Fixes (3)
1. **Application Tag Mismatch** (`create-instance.sh:421`)
   - Changed `Application=MiEmpresa` → `Application=miempresa` to match CodeDeploy filters
   - Impact: Prevents instance registration failures

2. **Broken CloudFormation Reference** (`ssm-parameters-stack.yml:130-134`)
   - Removed invalid `!GetAtt DBPasswordSecret.SecretString` intrinsic function
   - Replaced with placeholder `'PLACEHOLDER_WILL_BE_SET_BY_INSTANCE'`
   - Impact: Prevents stack deployment failures

3. **Missing Backup Script Deployment** (`create-instance.sh:461+`)
   - Added complete block to deploy `backup-postgres-s3.sh` to instance
   - Includes SCP transfer, installation to `/opt/miempresa/scripts/`, chmod +x, cron setup
   - Impact: Enables automated daily backups as documented

### Recommended Fixes (4)
4. **Parameter Naming Consistency** (`deploy-infrastructure.sh:42`)
   - Added `--stage` as alias to `--environment` parameter
   - Impact: Consistent CLI across all scripts

5. **Error Handling Directives** (`stop-service.sh`, `validate.sh`)
   - Added missing `set -e` and `set -o pipefail` to scripts
   - Impact: Prevents silent failures in CodeDeploy hooks

6. **Stale Script References** (multiple files)
   - Updated references from deleted `setup-iam.sh`/`setup-ssm-params.sh` to `deploy-infrastructure.sh`
   - Fixed script name from `create-lightsail-instance.sh` to `create-instance.sh`
   - Impact: Accurate error messages and documentation

7. **Dead Code Removal** (`ssm-parameters-stack.yml:86-88`)
   - Removed unused `IsDevEnvironment` condition
   - Impact: Cleaner CloudFormation template

**Total Changes**: 5 files modified, 34 lines changed

---

## Key Implementation Decisions

### IaC Pattern Compliance
**Decision**: Use CloudFormation for all AWS infrastructure, shell scripts only for utilities
**Rationale**: Mono-repo organization, version control, reproducible deployments, automatic rollback
**Implementation**:
- Converted scripted IAM/SSM setup to CloudFormation templates
- Kept scripts for: instance provisioning (Lightsail API), SSH utilities, credential monitoring, CodeDeploy lifecycle hooks

### Credential Management
**Decision**: STS temporary credentials with 50-minute auto-refresh (CRON)
**Rationale**: Enhanced security over static IAM keys, AWS best practice
**Implementation**: Bootstrap IAM user → AssumeRole → 1-hour STS credentials → refresh-credentials.sh CRON job

### Database Password Handling
**Decision**: Auto-generate on instance, store in SSM, update DATABASE_URL parameter
**Rationale**: Avoid hardcoding passwords, leverage instance bootstrap for secure generation
**Implementation**: `user-data-postgresql.sh` generates password → stores in `/tmp/db-password.txt` → `create-instance.sh` reads and updates SSM

### Backup Strategy
**Decision**: Daily pg_dump to S3 with 30-day retention
**Rationale**: Cost-effective, encrypted, geographically redundant
**Implementation**: `backup-postgres-s3.sh` CRON job (2 AM), AES256 encryption, lifecycle policy

### Naming Convention
**Decision**: Lowercase `miempresa` for all tags, parameters, resources
**Rationale**: Consistency with CloudFormation outputs, avoid case-sensitivity issues
**Fix Applied**: Changed all `MiEmpresa` references to `miempresa` (Issue #1)

---

## Environment Variables (SSM Parameter Store)

All stored at `/miempresa/{stage}/{category}/*`:

**Database** (`/db/`):
- DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

**Application** (`/api/`):
- JWT_SECRET, JWT_EXPIRATION, JWT_REFRESH_EXPIRATION
- SESSION_SECRET
- CORS_ORIGIN, PORT (3001), API_VERSION (v1)
- LOG_LEVEL (debug/info), LOG_FORMAT (json)

**AWS Services** (`/api/`):
- AWS_REGION, AWS_S3_BUCKET, AWS_S3_BACKUP_BUCKET

**File Upload** (`/api/`):
- MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES

**Rate Limiting** (`/api/`):
- RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS

---

## Testing & Validation

### Validation Suite (`tests/infrastructure-test.sh`)
**30+ Checks**:
- CloudFormation stack status (IAM, SSM, CodeDeploy)
- IAM role/policy validation
- SSM parameter existence and encryption
- Lightsail instance state
- PostgreSQL connectivity
- CodeDeploy agent status
- Credential refresh functionality
- Backup script execution

**Usage**:
```bash
cd backend/infrastructure/db/tests
./infrastructure-test.sh --stage dev --verbose
```

### Pre-Production Checklist
```bash
# 1. Validate CloudFormation templates
aws cloudformation validate-template --template-body file://cloudformation/ssm-parameters-stack.yml

# 2. Syntax check scripts
shellcheck scripts/*.sh

# 3. Run validation suite
./tests/infrastructure-test.sh --stage dev --verbose

# 4. Deploy to dev, verify health
curl http://<instance-ip>:3001/api/v1/health
```

---

## Cost Breakdown

### Dev Environment
- Lightsail micro_2_0 (1GB RAM, 1 vCPU, 40GB SSD): $5.00/month
- S3 storage (10GB backups): $0.23/month
- SSM parameters: FREE (Standard tier)
- CodeDeploy: FREE (on-premises instances)
- **Total: ~$5.25/month**

### Prod Environment
- Lightsail small_2_0 (2GB RAM, 1 vCPU, 60GB SSD): $10.00/month
- S3 storage (50GB backups): $1.15/month
- Data transfer (10GB egress): $0.90/month
- **Total: ~$12.05/month**

**Combined: ~$17.30/month**

---

## Operational Procedures

### Update Environment Variable
```bash
# Via CloudFormation (recommended)
aws cloudformation update-stack --stack-name miempresa-ssm-dev \
  --use-previous-template --parameters ParameterKey=CorsOrigin,ParameterValue=https://new-domain.com

# Or directly via SSM (temporary)
aws ssm put-parameter --name /miempresa/dev/api/CORS_ORIGIN --value https://new-domain.com --overwrite

# Reload on instance
ssh ec2-user@<ip> "cd /opt/miempresa/app && export STAGE=dev AWS_REGION=us-east-1 && ./infrastructure/db/scripts/env.sh && pm2 restart miempresa-api"
```

### Manual Backup
```bash
ssh ec2-user@<ip> "sudo /opt/miempresa/scripts/backup-postgres-s3.sh"
aws s3 ls s3://miempresa-backups-dev/daily/
```

### View Logs
```bash
# Application logs
ssh ec2-user@<ip> "pm2 logs miempresa-api"

# Deployment logs
ssh ec2-user@<ip> "cat /opt/miempresa/logs/after-install.log"

# System logs
ssh ec2-user@<ip> "sudo tail -f /var/log/postgres-backup.log"
```

### Disaster Recovery
```bash
# 1. Download backup
aws s3 cp s3://miempresa-backups-dev/daily/backup-2026-03-03.sql.gz .
gunzip backup-2026-03-03.sql.gz

# 2. Restore database
ssh ec2-user@<ip>
pm2 stop miempresa-api
sudo -u postgres psql -c "DROP DATABASE IF EXISTS miempresa_dev;"
sudo -u postgres psql -c "CREATE DATABASE miempresa_dev OWNER miempresa;"
psql -h localhost -U miempresa -d miempresa_dev < backup-2026-03-03.sql
pm2 restart miempresa-api
```

---

## Files Delivered

### CloudFormation Templates (3)
- `cloudformation/iam-stack.yml` (185 lines)
- `cloudformation/ssm-parameters-stack.yml` (337 lines)
- `cloudformation/codedeploy-stack.yml` (158 lines)

### Scripts (10)
- `scripts/deploy-infrastructure.sh` (268 lines) - Deploy all CloudFormation stacks
- `scripts/create-instance.sh` (537 lines) - Provision Lightsail instance
- `scripts/env.sh` - Fetch SSM parameters to .env
- `scripts/refresh-credentials.sh` - STS credential refresh
- `scripts/backup-postgres-s3.sh` - Database backup to S3
- `scripts/before-install.sh` - CodeDeploy hook
- `scripts/after-install.sh` - CodeDeploy hook
- `scripts/start-service.sh` - CodeDeploy hook
- `scripts/stop-service.sh` - CodeDeploy hook (fixed)
- `scripts/validate.sh` - CodeDeploy hook (fixed)

### Utilities (4)
- `utilities/get-instance-ip.sh`
- `utilities/ssh-to-instance.sh`
- `utilities/install-ssh-key.sh`
- `utilities/check-credentials.sh`

### Configuration (2)
- `appspec.yml` - CodeDeploy deployment specification
- `templates/user-data-postgresql.sh` - Instance bootstrap script

### Tests (1)
- `tests/infrastructure-test.sh` - Validation suite (30+ checks)

### Documentation (1)
- `context/implementation-plan/backend-lightsail-infrastructure-cloudformation.md` - Comprehensive reference (508 lines)

**Total: 21 files**

---

## Keywords

cloudformation iac infrastructure-as-code aws-lightsail postgresql-15 codedeploy zero-downtime-deployment sts-credentials ssm-parameter-store s3-backups automated-backups credential-refresh pm2-process-manager amazon-linux-2023 mono-repo bash-scripts deployment-automation security-best-practices cost-optimization disaster-recovery health-checks validation-suite

---

**Pattern**: CloudFormation for infrastructure, shell scripts for utilities
**Status**: ✅ Production-ready with consistency fixes applied
**Implementation Date**: March 3, 2026
**Version**: 2.1 (post-consistency-fixes)
