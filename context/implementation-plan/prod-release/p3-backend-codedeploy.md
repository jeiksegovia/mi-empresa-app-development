# P3 — First backend CodeDeploy — PASS (`d-EYN1OE0NL`). First try `d-85ZG7B1NL` hit staging (OR tag filters). See `2026-09-10-initial-deploy.md`.

**Not started.** Needs **yes, P3**. Group **`miempresa-prod` only**.

Working-tree zip. `appspec.yml` at zip root. Exclude `src/generated/*`, `prisma/prod-db/*`, `node_modules`, `*.spec.ts`.

```bash
cd backend
npm ci && npx prisma generate && npm run build
# appspec.yml already at backend/appspec.yml
zip -r /tmp/miempresa-prod-$(date +%Y%m%d-%H%M%S).zip \
  appspec.yml dist prisma package.json package-lock.json \
  src scripts infrastructure/db/scripts infrastructure/db/utilities \
  -x 'src/generated/*' -x '*node_modules*' -x '*.spec.ts' \
  -x 'prisma/prod-db/*' -x 'scripts/_tmp-*' -x '*.log' -x '*.DS_Store'

aws s3 cp /tmp/miempresa-prod-*.zip \
  s3://miempresa-artifacts-540657241795-prod/deployments/ \
  --profile disruptive --region us-east-1

aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-prod \
  --s3-location bucket=miempresa-artifacts-540657241795-prod,key=deployments/<file>.zip,bundleType=zip \
  --profile disruptive --region us-east-1
```

Verify: Succeeded; 32 migrations up to date; pm2 online; health 200 on origin `:3001`; login without `x-origin-verify` → 403.
