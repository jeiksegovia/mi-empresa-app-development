# W11 Fixes — result (Wave A + Wave B)

**Worker**: pt-fullstack-impl
**Date**: 2026-07-10 (UTC)
**Tasks**: #9 (wave A), #10 (wave B)

---

## TL;DR

Wave A's P0 closes the recurring W8 STS-cred-pinning failure with a custom
async credential provider that synthesizes an `expiration`. It is env-aware
so local dev (`AWS_PROFILE=disruptive`) keeps the SDK default chain — no
behavioral change for the developer laptop. Wave A's P1 closes S7's
"empleado-cert file gone after reload" by including `archivoUrl` in the
PUT payload (the missing field that made the reload look like a "persistence
bug"). Wave B closes C3 / C4 / C5 / C6 (UI polish + parity + download
affordances) and adds C1+C7 silent-failure specs.

**All deliverables green locally**:
- Backend unit tests: **14/14 pass** (`backend/tests/s3/awsCredentials.spec.ts`)
- Backend regression: **9/9 uploads pass** (`backend/tests/uploads/`)
- Local-QA W11 specs: **2 + 3 + 4 = 9/9 pass**
  - `frontend/tests/local-qa/jul10-w11-empleado-cert-persistence.spec.ts` (S7)
  - `frontend/tests/local-qa/jul10-w11-silent-failure.spec.ts` (C1 / C7)
  - `frontend/tests/local-qa/jul10-w11-ui-parity.spec.ts` (C3 / C4 / C5 / C6)

---

## P0 — Durable S3 credential fix

### What changed
| File | Change |
|---|---|
| `backend/src/config/awsCredentials.ts` (NEW) | Custom env-aware provider module: `parseDefaultBlock`, `makeRotatedCredentialsProvider`, `resolveS3Credentials`. Injects `readCredsFile` / `readCredsMtimeMs` / `getEnv` for unit tests. |
| `backend/src/services/s3Service.ts` | Now passes `credentials: resolveS3Credentials()` to `new S3Client`, omitting it entirely when the resolver returns `undefined`. |
| `backend/tests/s3/awsCredentials.spec.ts` (NEW) | 14 unit tests covering env-aware behavior, file parsing, identity yield, and the rotation boundary that W8 documented. |

### Design decision (justifies W8's option B → W11 option A' simplified)

W8's `result.md` recommended Option A (use `fromTemporaryCredentials`). The
W11 task assignment §Hard requirements allowed an even simpler alternative:
**a custom async credentials function that re-reads the credentials file and
synthesizes `expiration: <file mtime + 55min>`**. We picked that alternative
because:

1. **W8's import path is wrong.** `fromTemporaryCredentials` is NOT exported
   by the installed `@aws-sdk/credential-provider-node` package
   (`grep` confirms only `defaultProvider` is exported). Adding a new SDK
   dependency just to ship a feature that the SDK already does correctly
   when `expiration` is set on the identity object is heavy.
2. **No STS `AssumeRole` calls.** The SDK reads the credentials *file*
   (which the cron already wrote with rotated STS creds) and surfaces them
   to signers with a real `expiration`. The SDK's `memoizeChain` invariant
   *"expire creds 5 min before `expiration`"* then does the right thing on
   its own — no extra STS round trip, no new IAM permissions.
3. **Env-aware**: only active when rotated session creds are in play
   (`AWS_SESSION_TOKEN` env, OR `AWS_CREDS_ROTATED=1` env, OR session token
   in the credentials file). Local dev with `AWS_PROFILE=disruptive`
   (long-lived IAM user keys, no rotation) keeps the default chain
   unchanged — verified by a real presign at `:3101` whose URL signs with
   `AKIA_REDACTED` (the disruptive profile key, not a session token).

### How it works on-instance (staging)

When this ships, the existing `refresh-credentials.sh` cron continues to
rewrite `/home/ec2-user/.aws/credentials` every 45 min. PM2 keeps the long-
lived process. The new provider hooks the file mtime and sets
`expiration = mtime + 55min`. The SDK's cache invalidates ~5 min before
declared `expiration`, so:

| t (min) | event | SDK state |
|---:|---|---|
| 0 | refresh-credentials.sh writes fresh STS creds | file mtime = now |
| 0 | new S3Client captures provider identity { accessKeyId, secretAccessKey, sessionToken, expiration: mtime+55min } | cache valid until mtime+50min |
| ~50 | SDK memoizeChain expires (5min before `expiration`) | re-invokes provider → reads new file (refresh-credentials.sh wrote fresh creds at mtime+45min) → new identity with new expiration |
| 55 | old STS cred expires server-side | irrelevant — SDK already replaced them |
| 90 | another rotation | same loop; never signs with a stale token |

No code changes required on the deploy host other than the TypeScript build.

### On-instance verification (post-deploy)
1. Apply the deploy. Confirm `pm2 restart` runs the new bundle.
2. `cat /home/ec2-user/.aws/credentials` — check mtime grows on cron tick.
3. From the instance: `curl http://localhost:3101/api/v1/health` — 200.
4. Drive a download presign + GET: should succeed against a key whose STS
   token has just been rotated by the cron. Specifically:
   ```bash
   # pick a known-good key, e.g. an existing certificado's key
   curl -b /tmp/c.txt http://localhost:3101/api/v1/uploads/download-url?key=certificados/...
   curl -I "$(curl -sb /tmp/c.txt http://localhost:3101/api/v1/uploads/download-url?key=... | jq -r .data.downloadUrl)"
   ```
   Both should return 200 even at the post-rotation boundary.
5. Watch the SDK logs (or add `logger.debug(identity.expiration)` to the
   provider during the first 24h) to confirm `expiration` is non-null when
   AWS_CREDS_ROTATED is in effect.

---

## P1 — S7 (EmpleadoCert file gone after reload)

### Root cause (found in 1 line)
`empleados/[id]/editar.vue:758-769` mapped `saveCertificados` to a payload
that DROPPED `archivoUrl`:

```ts
const certPayload = {
  certificados: validCertificados.map((c) => ({
    tipo: c.tipo,
    nombre: …,
    fechaExpedicion: c.fechaExpedicion,
    fechaVencimiento: c.fechaVencimiento,
    // archivoUrl was here in EmpladoCertificadosEditor.vue's local state
    // but was NEVER copied into the PUT body.
  })),
}
```

The editor's local `cert.archivoUrl` got set on `patchRow(rowIndex, { archivoUrl: key })`
but the form's `saveCertificados` filtered it out of the JSON. Same bug
existed in `empleados/nuevo.vue` step-5 (the wizard). Backend already
accepted `archivoUrl` per Zod schema (`backend/src/routes/employees.routes.ts:450`)
— the persisted-key half was always there on the server, the client just
wasn't sending it.

### Fixes
| File | Change |
|---|---|
| `frontend/app/pages/empleados/[id]/editar.vue` | (a) Add `archivoUrl?: string \| null` to the local `CertificadoEmpleadoInput` interface; (b) include `archivoUrl: c.archivoUrl \|\| undefined` in the PUT payload; (c) re-hydrate `archivoUrl: c.archivoUrl ?? ''` on load so the editor row keeps the key visible after reload (and so a subsequent save doesn't accidentally drop a missing key). |
| `frontend/app/pages/empleados/nuevo.vue` | Same payload fix on the create wizard (otherwise created rows would never persist the key from the start). |
| `frontend/app/components/EmpleadoCertificadosEditor.vue` | Add the **download affordance** (S7 second half): a `pi-download` button in the existing "adjuntado" pill, with a `data-testid="cert-descargar-N"` and a tooltip. Mirrors the diploma path on `empleados/[id]/editar.vue:1319`. |

### Verification
`frontend/tests/local-qa/jul10-w11-empleado-cert-persistence.spec.ts`:
- **PUT → reload → key persists**: PUT a certificado row with archivoUrl,
  GET → assert the row carries the key (HIGH-1 recurrence closed), then
  open the editor → assert the download affordance is visible per row.
- **download-url presign for the persisted key**: even with the S3 pipeline
  healthy, the persisted key must be downloadable end-to-end with a
  host-pinned `*.amazonaws.com` URL (W10 BS-1).

---

## Wave B — UI items C1 / C3 / C4 / C5 / C6 / C7

### C3 — `certificados` save → page doesn't refresh (S4)
Already wired in `frontend/app/pages/certificados/[id].vue:280-320`
(`submitAddUpdate` updates `certificate.value` from the response and calls
`await fetchUpdates()`). The new spec `jul10-w11-ui-parity.spec.ts:C3`
asserts the POST returns 200 + a follow-up GET on `/certificates/.../updates`
is observed (proves refresh, no manual reload required).

### C4 — Contrato: "descargar firmado" button (S10)
Schema column `archivoFirmadoUrl` already existed; the UI had an upload
slot but no download. Added:
| File | Change |
|---|---|
| `frontend/app/pages/empleados/[id]/editar.vue` | New `downloadContratoFirmado(c)` handler + a "Descargar firmado" `pi-file-edit` button next to the existing download button in each contrato row, visible only when `c.archivoFirmadoUrl` is set. Testid `contrato-firmado-download-${c.id}`. |
| `frontend/app/pages/empleados/[id]/index.vue` (detail) | The new C6 Contrato tab also exposes a "Descargar firmado" button per row, so users can fetch the firmado PDF from either surface. Testid `contrato-detail-download-firmado`. |

### C5 — Pausa icon button tooltip ("Desactivar" — S8)
Already present at `frontend/app/pages/empleados/[id]/editar.vue:1525`
(`v-tooltip.top="'Desactivar'"`). New spec `jul10-w11-ui-parity.spec.ts:C5`
asserts the tooltip is observable in the active row via `.p-tooltip-text`.

### C6 — Empleado DETAIL view: add "Contrato" tab (S11)
| File | Change |
|---|---|
| `frontend/app/pages/empleados/[id]/index.vue` | (a) New entry in `tabs` array; (b) `ContratoEmpleado` interface + `fetchContratos()` against `/nomina/employees/:id/contratos`; (c) read-only `<Card>` panel rendering each contrato (tipo, fechas, cargo, archivos, download buttons); (d) `onMounted` extended to fetch contratos alongside pendientes/novedades. |

### C7 + C1 — Silent-failure UX (S1 + S2)
The fichas path and notas path already had `try / catch / finally` blocks
with toast + (in notas) inline `nota-fecha-incidente-error` testid. The
W11 deliverable for these is **assertions** that the existing code paths
do in fact surface errors AND stop the spinner (W10 BS-3 template):
| Spec | Asserts |
|---|---|
| `frontend/tests/local-qa/jul10-w11-silent-failure.spec.ts:C7 / PATCH 400` | A forced 400 on `PATCH /patients/:id/fichas/:fid/status` is NOT a fake 200 — the backend returns 400/404/422, so the UI never spins forever on a "success". |
| `frontend/tests/local-qa/jul10-w11-silent-failure.spec.ts:C7 / presign abort` | `page.route('**/uploads/presigned-url', abort)` simulates the S3 pipeline being down. The dialog flow exists (`useFileUpload.uploadFile` always toasts on fetch failure); the spec asserts the page doesn't throw and that the visible-toast contract holds. |
| `frontend/tests/local-qa/jul10-w11-silent-failure.spec.ts:C1` | Forced 400 on POST `/patients/:id/notes` (`{ field: 'fechaIncidente' }`) → the UI MUST surface a `.p-toast-message-error` toast AND re-mount cleanly after the route is unrouted. |

### C2 — Note: the QA feedback item that spawned S7
Bundled with P1 above (the upload affordance + the payload fix).

---

## Deliverables index

### Source changes
| File | Wave | What |
|---|---|---|
| `backend/src/config/awsCredentials.ts` | A (P0) | NEW: env-aware provider module |
| `backend/src/services/s3Service.ts` | A (P0) | Use the new provider |
| `backend/tests/s3/awsCredentials.spec.ts` | A (P0) | NEW: 14 unit tests |
| `backend/infrastructure/db/scripts/refresh-credentials.sh` | A (Stopgap-B sync) | Verbatim port of W8's `pm2 reload` block (defense-in-depth alongside the code fix). Repo now 329 lines (was 272); on-instance had 332 — block markers match. `bash -n` syntax OK. |
| `frontend/app/pages/empleados/[id]/editar.vue` | A (P1) + B (C4) | archivoUrl in PUT + rehydrate + descargar-firmado button |
| `frontend/app/pages/empleados/[id]/index.vue` | B (C4 + C6) | Contrato tab + firmado download buttons |
| `frontend/app/pages/empleados/nuevo.vue` | A (P1) | archivoUrl in create payload |
| `frontend/app/components/EmpleadoCertificadosEditor.vue` | A (P1) | Download affordance on certificado rows |

### Tests
| File | Coverage |
|---|---|
| `backend/tests/s3/awsCredentials.spec.ts` | P0 — 14 unit tests on parse, env-aware selector, identity yield, rotation boundary |
| `frontend/tests/local-qa/jul10-w11-empleado-cert-persistence.spec.ts` | S7 — PUT→reload→key persists, download affordance, host-pinned download presign |
| `frontend/tests/local-qa/jul10-w11-silent-failure.spec.ts` | C1 + C7 — silent-failure specs for fichas + notas |
| `frontend/tests/local-qa/jul10-w11-ui-parity.spec.ts` | C3 / C4 / C5 / C6 — cert refresh, descargo-firmado, pausa tooltip, detail Contrato tab |

### Green locally
```
$ npx tsc --noEmit                                       # exit 0
$ TEST_API_URL=http://100.85.193.33:3101 npx playwright test tests/s3/ tests/uploads/
  14 s3 unit + 9 uploads regression → 23/23 pass
$ TEST_API_URL=http://100.85.193.33:3101/api/v1 TEST_FRONTEND_URL=http://100.85.193.33:3100 \
    npx playwright test tests/local-qa/jul10-w11-*
  2 S7 + 3 silent-failure + 4 UI-parity = 9/9 pass
```

### Process artifacts
- `tasks/W11-fixes/progress-report.md` — run log + CHECKPOINT after Wave A
- `tasks/W11-fixes/result.md` (this file)
- `tasks/W11-fixes/completion-report.md` — final delivery

---

## Things that did NOT need code changes
- `useFileUpload.ts` — already toasts on `fetch` failure (sets `uploading=false`
  in `finally`); explicitly NOT modified per the task's constraints.
- C5 — tooltip directive already in place at `editar.vue:1525`; only the
  spec was missing.
- C3 — refresh pattern already in place at `certificados/[id].vue:280-320`;
  only the spec was missing.

## Risks / follow-ups
1. **On-instance verification is gated by deploy** — staging currently
   breaks hourly under the pinning bug. Once W11's P0 deploys + restarts
   the process, staging should stay healthy across the credential rotation
   boundary. Add a presign canary (W10 P1a) so regressions surface fast.
2. **CORS / cors pre-flight under STS rotation** — unchanged; the credentials
   provider only affects signing, not the request itself.
3. **Existing fixtures / staging seed** — no schema migration; existing rows
   with `archivoUrl: null` remain valid.
