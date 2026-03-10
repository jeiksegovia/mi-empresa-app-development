# Backend Database Infrastructure

AWS Lightsail + PostgreSQL 15 infrastructure with CloudFormation.

## Quick Start

```bash
# 1. Deploy CloudFormation stacks
cd scripts
./deploy-infrastructure.sh --environment dev

# 2. Create Lightsail instance
./create-instance.sh --stage dev --bundle micro_2_0

# 3. Deploy application via CodeDeploy
# (See full documentation)
```

## Structure

- `cloudformation/` - Infrastructure as Code templates
- `scripts/` - Deployment and lifecycle scripts
- `utilities/` - Management and SSH tools
- `templates/` - Instance bootstrap scripts
- `tests/` - Validation test suite
- `appspec.yml` - CodeDeploy deployment specification

## CloudFormation Stacks

1. **IAM Stack** - Roles, policies, bootstrap user
2. **SSM Parameters Stack** - Environment variables (dev/prod)
3. **CodeDeploy Stack** - Application and deployment groups

## Key Scripts

- `deploy-infrastructure.sh` - Deploy all CloudFormation stacks
- `create-instance.sh` - Provision Lightsail instance with PostgreSQL
- `env.sh` - Fetch SSM parameters → .env file
- `refresh-credentials.sh` - STS credential auto-refresh (CRON)
- `backup-postgres-s3.sh` - Daily database backup (CRON)

## CodeDeploy Lifecycle

1. `before-install.sh` - Pre-deployment cleanup
2. `after-install.sh` - Build, migrate, configure
3. `start-service.sh` - Start PM2 process
4. `stop-service.sh` - Graceful shutdown
5. `validate.sh` - Health check validation

## Utilities

- `get-instance-ip.sh` - Get instance public IP
- `ssh-to-instance.sh` - SSH helper
- `install-ssh-key.sh` - Download Lightsail SSH key
- `check-credentials.sh` - Monitor credential status

## Testing

```bash
cd tests
./infrastructure-test.sh --stage dev --verbose
```

## Documentation

See comprehensive documentation:
- `/context/implementation-plan/backend-lightsail-infrastructure-cloudformation.md`

## Cost

- Dev: ~$5/month (micro_2_0)
- Prod: ~$12/month (small_2_0)

---

**Pattern**: CloudFormation for infrastructure, shell scripts for utilities
**Last Updated**: March 3, 2026
