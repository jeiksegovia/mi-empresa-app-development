# Backend Infrastructure Implementation - AWS Lightsail with PostgreSQL

**Implementation Date**: March 3, 2026
**Status**: ✅ Complete
**Infrastructure Pattern**: CloudFormation + Utility Scripts

---

## Overview

Production-ready backend infrastructure for Mi Empresa using:
- **AWS Lightsail**: Cost-effective compute instances ($5-12/month)
- **PostgreSQL 15**: Local database with automated backups to S3
- **AWS CodeDeploy**: Zero-downtime deployments
- **CloudFormation**: Infrastructure as Code for all AWS resources
- **STS Credentials**: Auto-refreshing temporary credentials (50-minute cycle)

---

## Directory Structure

```
backend/infrastructure/db/
├── cloudformation/                    # CloudFormation templates
│   ├── iam-stack.yml                 # IAM roles, policies, bootstrap user
│   ├── ssm-parameters-stack.yml      # Environment variables
│   └── codedeploy-stack.yml          # CodeDeploy application & groups
├── scripts/                          # Utility scripts
│   ├── deploy-infrastructure.sh      # Deploy all CloudFormation stacks
│   ├── create-instance.sh            # Provision Lightsail instance
│   ├── env.sh                        # Fetch SSM params → .env
│   ├── refresh-credentials.sh        # STS credential refresh (CRON)
│   ├── backup-postgres-s3.sh         # Database backup (CRON)
│   ├── before-install.sh             # CodeDeploy: pre-deployment
│   ├── after-install.sh              # CodeDeploy: build & migrate
│   ├── start-service.sh              # CodeDeploy: start PM2
│   ├── stop-service.sh               # CodeDeploy: stop PM2
│   └── validate.sh                   # CodeDeploy: health check
├── utilities/                        # Management tools
│   ├── get-instance-ip.sh           # Get instance IP by name
│   ├── ssh-to-instance.sh           # SSH helper
│   ├── install-ssh-key.sh           # Download Lightsail key
│   └── check-credentials.sh         # Monitor credential status
├── templates/
│   └── user-data-postgresql.sh      # Instance bootstrap script
├── tests/
│   └── infrastructure-test.sh       # Validation test suite (30+ checks)
└── appspec.yml                       # CodeDeploy deployment spec
```

---

## Quick Start

### 1. Deploy Infrastructure (CloudFormation)

```bash
cd backend/infrastructure/db/scripts

# Deploy all CloudFormation stacks
./deploy-infrastructure.sh --environment dev --region us-east-1
```

This creates:
- IAM roles and policies
- Bootstrap IAM user with STS AssumeRole permissions
- SSM parameters for environment variables
- CodeDeploy application and deployment groups

### 2. Create Lightsail Instance

```bash
# Provision instance with PostgreSQL 15
./create-instance.sh --stage dev --bundle micro_2_0

# Download SSH key
cd ../utilities
./install-ssh-key.sh
```

### 3. Deploy Application

```bash
# Create deployment package
cd ../../..  # Back to backend/
zip -r deployment.zip . -x "node_modules/*" -x "dist/*" -x ".git/*"

# Upload to S3
aws s3 cp deployment.zip s3://codedeploy-artifacts-us-east-1/miempresa/

# Deploy
aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-dev \
  --s3-location bucket=codedeploy-artifacts-us-east-1,key=miempresa/deployment.zip,bundleType=zip
```

### 4. Verify Deployment

```bash
cd infrastructure/db/tests
./infrastructure-test.sh --stage dev --verbose
```

---

## CloudFormation Stacks

### 1. IAM Stack (`iam-stack.yml`)

**Resources Created**:
- `CodeDeployInstanceRole` - Role for Lightsail instances
- `CodeDeployInstancePolicy` - Permissions for S3, SSM, CloudWatch, KMS
- `BootstrapUser` - IAM user for STS AssumeRole
- SSM parameters storing bootstrap credentials

**Deploy**:
```bash
aws cloudformation deploy \
  --template-file cloudformation/iam-stack.yml \
  --stack-name miempresa-iam \
  --capabilities CAPABILITY_NAMED_IAM
```

### 2. SSM Parameters Stack (`ssm-parameters-stack.yml`)

**Resources Created** (per environment):
- Database configuration (DATABASE_URL, DB_HOST, DB_PORT, etc.)
- JWT configuration (JWT_SECRET, JWT_EXPIRATION)
- Session secrets
- AWS service configuration (region, S3 buckets)
- Application settings (CORS, log level, rate limits)

**Deploy**:
```bash
aws cloudformation deploy \
  --template-file cloudformation/ssm-parameters-stack.yml \
  --stack-name miempresa-ssm-dev \
  --parameter-overrides Environment=dev
```

### 3. CodeDeploy Stack (`codedeploy-stack.yml`)

**Resources Created**:
- CodeDeploy application
- Deployment groups (dev, prod)
- Service role with permissions

**Deploy**:
```bash
aws cloudformation deploy \
  --template-file cloudformation/codedeploy-stack.yml \
  --stack-name miempresa-codedeploy \
  --capabilities CAPABILITY_NAMED_IAM
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  CloudFormation Stacks                   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  IAM Stack   │  │  SSM Stack   │  │   CodeDeploy │ │
│  │              │  │              │  │     Stack    │ │
│  │ • Roles      │  │ • Env Vars   │  │ • Application│ │
│  │ • Policies   │  │ • Secrets    │  │ • Deploy     │ │
│  │ • Bootstrap  │  │ • Config     │  │   Groups     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           │ Provides credentials & config
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Lightsail Instance (Created via Script)     │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐    │
│  │PostgreSQL15│  │ Node.js/PM2│  │ CodeDeploy    │    │
│  │   :5432    │  │   :3001    │  │    Agent      │    │
│  └────────────┘  └────────────┘  └───────────────┘    │
│                                                          │
│  CRON Jobs:                                              │
│  • */50 * * * * refresh-credentials.sh                   │
│  • 0 2 * * * backup-postgres-s3.sh                       │
└─────────────────────────────────────────────────────────┘
```

---

## Key Features

### Infrastructure as Code (CloudFormation)
- ✅ All AWS resources defined in CloudFormation
- ✅ Version controlled and reproducible
- ✅ Stack updates with change sets
- ✅ Automatic rollback on errors
- ✅ Parameters for environment-specific values

### Utility Scripts (Shell)
- ✅ Instance provisioning (Lightsail API)
- ✅ SSH and connection helpers
- ✅ Credential monitoring
- ✅ Test suite for validation
- ✅ CodeDeploy lifecycle hooks

### Security
- ✅ STS temporary credentials (1-hour sessions)
- ✅ Auto-refresh every 50 minutes
- ✅ SSM Parameter Store with encryption
- ✅ S3 backup encryption (AES256)
- ✅ Minimal IAM permissions

### Automation
- ✅ Zero-downtime deployments
- ✅ Automated daily backups
- ✅ Credential auto-refresh
- ✅ Health check validation
- ✅ Automatic rollback on failure

---

## Environment Variables (SSM)

All stored in AWS Systems Manager Parameter Store:

**Database**:
- `/miempresa/{env}/db/DATABASE_URL` - PostgreSQL connection string
- `/miempresa/{env}/db/DB_HOST` - localhost
- `/miempresa/{env}/db/DB_PORT` - 5432
- `/miempresa/{env}/db/DB_NAME` - miempresa_{env}
- `/miempresa/{env}/db/DB_USER` - miempresa
- `/miempresa/{env}/db/DB_PASSWORD` - Auto-generated

**Application**:
- `/miempresa/{env}/api/JWT_SECRET` - JWT signing secret
- `/miempresa/{env}/api/SESSION_SECRET` - Express session secret
- `/miempresa/{env}/api/CORS_ORIGIN` - Allowed origin
- `/miempresa/{env}/api/PORT` - 3001
- `/miempresa/{env}/api/LOG_LEVEL` - debug (dev) / info (prod)

**AWS Services**:
- `/miempresa/{env}/api/AWS_REGION` - us-east-1
- `/miempresa/{env}/api/AWS_S3_BUCKET` - miempresa-uploads-{env}
- `/miempresa/{env}/api/AWS_S3_BACKUP_BUCKET` - miempresa-backups-{env}

---

## Deployment Lifecycle (CodeDeploy)

Defined in `appspec.yml`:

1. **ApplicationStop** (optional) - Gracefully stop PM2
2. **BeforeInstall** - Clean directory, verify tools
3. **Install** (automatic) - Copy files from S3
4. **AfterInstall** - Install deps, build TypeScript, migrate DB, fetch env vars
5. **ApplicationStart** - Start PM2 process
6. **ValidateService** - Health check (retry 10x with 3s delay)

**Rollback**: Automatic on any hook failure

---

## Common Operations

### Update Environment Variable

```bash
# Update in CloudFormation (recommended)
aws cloudformation update-stack \
  --stack-name miempresa-ssm-dev \
  --use-previous-template \
  --parameters ParameterKey=CorsOrigin,ParameterValue=https://new-domain.com

# Or update directly (temporary)
aws ssm put-parameter \
  --name /miempresa/dev/api/CORS_ORIGIN \
  --value https://new-domain.com \
  --overwrite

# Then reload on instance
ssh ec2-user@<instance-ip>
cd /opt/miempresa/app
export STAGE=dev AWS_REGION=us-east-1
./infrastructure/db/scripts/env.sh
pm2 restart miempresa-api
```

### View Logs

```bash
# SSH to instance
./utilities/ssh-to-instance.sh miempresa-db-dev-1

# Application logs
pm2 logs miempresa-api

# Deployment logs
cat /opt/miempresa/logs/after-install.log
cat /opt/miempresa/logs/validate.log

# System logs
sudo tail -f /var/log/postgres-backup.log
sudo tail -f /var/log/credential-refresh.log
```

### Manual Backup

```bash
# SSH to instance
sudo /opt/miempresa/scripts/backup-postgres-s3.sh

# List S3 backups
aws s3 ls s3://miempresa-backups-dev/daily/
```

### Check Infrastructure

```bash
# Run test suite
cd infrastructure/db/tests
./infrastructure-test.sh --stage dev --verbose

# Check specific resources
aws cloudformation describe-stacks --stack-name miempresa-iam
aws cloudformation describe-stacks --stack-name miempresa-ssm-dev
aws cloudformation describe-stacks --stack-name miempresa-codedeploy
```

---

## Cost Estimate

### Monthly Costs

**Dev Environment**:
- Lightsail micro_2_0: $5.00
- S3 storage (10GB): $0.23
- SSM parameters: FREE
- CodeDeploy: FREE
- **Total: ~$5.25/month**

**Prod Environment**:
- Lightsail small_2_0: $10.00
- S3 storage (50GB): $1.15
- Data transfer (10GB): $0.90
- **Total: ~$12.05/month**

**Combined: ~$17.30/month**

---

## Troubleshooting

### Stack Deployment Failed

```bash
# View stack events
aws cloudformation describe-stack-events --stack-name miempresa-iam

# View failed resources
aws cloudformation describe-stack-resources --stack-name miempresa-iam \
  | jq '.StackResources[] | select(.ResourceStatus | contains("FAILED"))'
```

### CodeDeploy Agent Not Running

```bash
# SSH to instance
sudo systemctl status codedeploy-agent
sudo systemctl restart codedeploy-agent

# Check credentials
./utilities/check-credentials.sh
sudo /opt/miempresa/scripts/refresh-credentials.sh
```

### Database Connection Failed

```bash
# Check PostgreSQL
sudo systemctl status postgresql-15
sudo systemctl restart postgresql-15

# Test connection
psql -h localhost -U miempresa -d miempresa_dev -c "SELECT version();"
```

---

## Disaster Recovery

### Backup Strategy
- ✅ Automated daily backups (2 AM)
- ✅ 30-day retention in S3
- ✅ Encrypted with AES256
- ✅ Infrastructure as Code (recreate quickly)

### Restore Procedure

1. **Download backup**:
```bash
aws s3 cp s3://miempresa-backups-dev/daily/backup.sql.gz .
gunzip backup.sql.gz
```

2. **Restore database** (on instance):
```bash
pm2 stop miempresa-api
sudo -u postgres psql -c "DROP DATABASE IF EXISTS miempresa_dev;"
sudo -u postgres psql -c "CREATE DATABASE miempresa_dev OWNER miempresa;"
psql -h localhost -U miempresa -d miempresa_dev < backup.sql
pm2 restart miempresa-api
```

### Recreate Infrastructure

```bash
# All stacks
./scripts/deploy-infrastructure.sh --environment prod

# New instance
./scripts/create-instance.sh --stage prod
```

---

## Security Best Practices

1. **Rotate bootstrap credentials monthly**:
```bash
# Delete old key
aws iam delete-access-key --user-name miempresa-bootstrap --access-key-id OLD_KEY

# Update CloudFormation stack to create new key
aws cloudformation update-stack --stack-name miempresa-iam --use-previous-template
```

2. **Review IAM policies quarterly**
3. **Enable CloudTrail for audit logging**
4. **Use AWS Secrets Manager for sensitive values** (future enhancement)
5. **Regular security updates on instances**: `sudo dnf update`

---

## Maintenance Schedule

- **Every 50 minutes**: Automatic credential refresh
- **Daily 2 AM**: Automated database backup
- **Weekly**: Review logs and metrics
- **Monthly**: Rotate bootstrap credentials, test backup restore
- **Quarterly**: Disaster recovery drill, cost optimization review

---

## Files Reference

### CloudFormation Templates (3)
1. `cloudformation/iam-stack.yml` - IAM resources
2. `cloudformation/ssm-parameters-stack.yml` - Environment variables
3. `cloudformation/codedeploy-stack.yml` - CodeDeploy application

### Scripts (10)
1. `scripts/deploy-infrastructure.sh` - Deploy all stacks
2. `scripts/create-instance.sh` - Provision Lightsail
3. `scripts/env.sh` - Load environment variables
4. `scripts/refresh-credentials.sh` - STS credential refresh
5. `scripts/backup-postgres-s3.sh` - Database backup
6. `scripts/before-install.sh` - CodeDeploy hook
7. `scripts/after-install.sh` - CodeDeploy hook
8. `scripts/start-service.sh` - CodeDeploy hook
9. `scripts/stop-service.sh` - CodeDeploy hook
10. `scripts/validate.sh` - CodeDeploy hook

### Utilities (4)
1. `utilities/get-instance-ip.sh`
2. `utilities/ssh-to-instance.sh`
3. `utilities/install-ssh-key.sh`
4. `utilities/check-credentials.sh`

### Configuration (2)
1. `appspec.yml` - CodeDeploy deployment spec
2. `templates/user-data-postgresql.sh` - Instance bootstrap

### Tests (1)
1. `tests/infrastructure-test.sh` - Validation suite

---

## Success Criteria ✅

- ✅ All infrastructure defined as CloudFormation
- ✅ Scripts only for utilities and instance management
- ✅ Multi-environment support (dev, prod)
- ✅ Zero-downtime deployments
- ✅ Automated backups and credential refresh
- ✅ Comprehensive testing
- ✅ Production-ready security
- ✅ Cost-effective ($17/month for both environments)

---

**Keywords**: aws lightsail postgres cloudformation codedeploy infrastructure iac backend deployment automation security sts credentials ssm parameters s3 backups

**Last Updated**: March 3, 2026
**Version**: 2.0 (CloudFormation-based)
