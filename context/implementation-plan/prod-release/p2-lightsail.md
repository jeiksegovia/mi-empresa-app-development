# P2 — Lightsail `miempresa-backend-prod` — WAITING

**Not started.** Needs **yes, P2** after P1 verify.

```bash
cd backend/infrastructure/db/scripts
./create-instance.sh --stage prod --bundle micro_3_0 --profile disruptive
```

Verify: instance running; user-data completion marker; `[bootstrap]` profile survives **two** credential-refresh cycles (B16); `DB_PASSWORD`/`DATABASE_URL` in SSM are real; CodeDeploy on-premises `Environment=prod`.
