# Plan: fix-review-findings — full list (bugs + cleanups)

## Objective
Fix ALL accepted findings from the two review passes (`tasks/code-review-jul4/result.md` + Fable verification): 3 HIGH bugs, 9 MED bugs/gaps, and the MED/LOW cleanups (composables, date utils, spec helper, dead code, ~70 phase-marker comments, console.error→toast, threshold/toast standardization). End state: backend typechecks (`tsc --noEmit`), full local-qa suite green (36 pre-existing + new regression asserts for the fixed bugs).

## Fix inventory — detailed, with snippets

### GROUP 1 — HIGH bugs (do first, each with a regression assert)

**FIX-1 (N1) — updateNovedad wipes attachments** — `backend/src/services/employeeService.ts:616-632`
`tx.archivoNovedad.deleteMany` runs unconditionally but re-create only happens `if (input.archivos)`. PUT without `archivos` silently deletes all files.
```ts
// inside the $transaction — replace the unconditional deleteMany block:
if (input.archivos !== undefined) {
  await tx.archivoNovedad.deleteMany({ where: { novedadId } })
  if (input.archivos.length > 0) {
    await tx.archivoNovedad.createMany({
      data: input.archivos.map((a) => ({ novedadId, nombre: a.nombre, url: a.url })),
    })
  }
}
```
Regression assert (extend `jul4-p5-novedades.spec.ts`): create novedad with 1 adjunto → PUT changing only `titulo` (NO `archivos` key in body) → GET → adjunto still present.

**FIX-2 (A1) — empleado detail TAB 2 renders removed fields** — `frontend/app/pages/empleados/[id]/index.vue`
Interface still declares `certificadoAlturas`/`certificadoRiesgoElectrico` (:49-50); template consumes them (:660-678, :695-713). API returns only `certificados[]` (employeeService `ALL_RELATIONS`). Every employee shows the empty-state.
1. Interface: drop the two stale fields; add
```ts
certificados: Array<{ id: number; tipo: 'ALTURAS' | 'RIESGO_ELECTRICO' | 'MANIPULACION_ALIMENTOS' | 'OTRO'; nombre: string | null; fechaExpedicion: string; fechaVencimiento: string; archivoUrl: string | null }>
```
2. Template: replace the two fixed cards with ONE "Certificados" card iterating `employee.certificados`:
```vue
<div v-if="!employee.certificados?.length" class="text-sm text-[var(--text-color-secondary)]">
  No tiene certificados registrados.
</div>
<div v-for="cert in employee.certificados" :key="cert.id" class="border border-[var(--surface-border)] rounded-lg p-4 flex items-center justify-between">
  <div>
    <p class="font-medium">{{ certTipoLabels[cert.tipo] }}<span v-if="cert.tipo === 'OTRO' && cert.nombre"> — {{ cert.nombre }}</span></p>
    <p class="text-sm text-[var(--text-color-secondary)]">{{ formatDate(cert.fechaExpedicion) }} → {{ formatDate(cert.fechaVencimiento) }}</p>
  </div>
  <div class="flex items-center gap-2">
    <Tag v-if="isCertExpired(cert.fechaVencimiento)" severity="danger" value="VENCIDO" />
    <Tag v-else-if="isCertExpiringSoon(cert.fechaVencimiento)" severity="warn" value="POR VENCER" />
    <Button v-if="cert.archivoUrl" icon="pi pi-download" text rounded size="small" @click="downloadFile(cert.archivoUrl)" />
  </div>
</div>
```
```ts
const certTipoLabels: Record<string, string> = {
  ALTURAS: 'Trabajo en Alturas', RIESGO_ELECTRICO: 'Riesgo Eléctrico',
  MANIPULACION_ALIMENTOS: 'Manipulación de Alimentos', OTRO: 'Otro',
}
```
3. Fix F3 while here: `isCertExpiringSoon` threshold 60 → `CERT_POR_VENCER_DAYS` (30) from the new date util (CL-2).
Regression assert (extend `jul4-p2-cert-empleado-archivo.spec.ts`): after saving a cert in editar → visit `/empleados/{id}` detail → TAB 2 (`:visible`) shows the cert tipo label.

**FIX-3 (A2 + N3) — 7 stale `@ts-expect-error` + silent catch** — `backend/src/services/employeeService.ts:504-521, 579, 592, 612, 615, 637, 640`
Contrato + NovedadEmpleado models are generated; directives are unused (TS2578) and the silent catch hides real DB errors (phantom/missing "Sin contrato activo" pendiente).
```ts
// listPendientes — replace the whole try/@ts-expect-error/catch block:
const contratoActivo = await prisma.contrato.findFirst({
  where: { empleadoId, activo: true },
  select: { id: true },
})
if (!contratoActivo) {
  derivados.push({ derived: true, tipo: 'SIN_CONTRATO_ACTIVO', descripcion: 'Sin contrato activo' /* keep existing shape */ })
}
```
Remove the six `@ts-expect-error` on `novedadEmpleado`/`archivoNovedad` access — plain calls.
**Gate**: `cd backend && npx tsc --noEmit` → zero errors (this is a NEW gate; if pre-existing unrelated errors surface, fix only delivered-code ones and list the rest in result.md).

### GROUP 2 — MED bugs

**FIX-4 (A4) — stale tipo enum on cert edit page** — `frontend/app/pages/certificados/[id].vue:55-70`
Replace `tipoLabels` + `tipoOptions` with the new taxonomy — copy exactly from `certificados/index.vue:73-91`:
```ts
const tipoLabels: Record<string, string> = {
  ALCALDIA: 'Alcaldía', GOBERNACION: 'Gobernación', SECRETARIAS: 'Secretarías',
  TRIBUTARIOS: 'Tributarios', REGISTRO_MERCANTIL: 'Registro Mercantil', OTRO: 'Otro',
}
const tipoOptions = Object.entries(tipoLabels).map(([value, label]) => ({ label, value }))
```
Also fix the stale union type on the cert interface in the same file if present.

**FIX-5 (N2) — cargo salario dropped on create** — `backend/src/services/employeeService.ts:283-294`
`createEmployee`'s `cargos.map` omits `salario` (Zod accepts it, wizard sends it, PUT /cargos persists it — create/edit disagree). Add to the map:
```ts
salario: c.salario ?? null,
```
Regression assert (extend `p3-empleado-fields.spec.ts` or wizard spec): create employee with salario → GET → cargos[0].salario persisted.

**FIX-6 (N4) — nomina salario prefill missing + Decimal-as-string** — `backend/src/services/nominaService.ts:129-136` + `frontend/app/pages/nomina/index.vue:100-107`
Backend `getNominaMonth`: include latest cargo salario per empleado:
```ts
cargos: { orderBy: { fechaIngreso: 'desc' }, take: 1, select: { salario: true } },
```
Expose as `cargoSalario: emp.cargos[0]?.salario ?? null` in the row mapper.
Frontend `openDialog`:
```ts
salario: row.entrada?.salario != null ? Number(row.entrada.salario)
       : row.cargoSalario != null ? Number(row.cargoSalario) : null,
```
(Prisma Decimal serializes to string — always `Number()` before InputNumber.)

**FIX-7 (A5) — blanket P2002 mapping** — `backend/src/routes/employees.routes.ts:155-157, 179-182`
```ts
if (error?.code === 'P2002') {
  const target = Array.isArray(error?.meta?.target) ? (error.meta.target as string[]) : []
  const message = target.includes('numero_documento') ? 'Número de documento ya registrado' : 'Registro duplicado'
  res.status(409).json({ success: false, message })
  return
}
```

**FIX-8 (N5) — unguarded sub-resource PUTs** — `backend/src/routes/employees.routes.ts:208-462`
Add `requireRole('ADMIN')` to all 8 collection PUTs (`/cargos`, `/nucleo-familiar`, `/contactos-emergencia`, `/experiencias-laborales`, `/educacion-idiomas`, `/vehiculos`, `/datos-migracion`, `/certificados`) — matches the delivered pendientes/novedades/nomina pattern. Add a Zod schema for `/certificados` body (the delivered surface):
```ts
const certificadosPutSchema = z.object({
  certificados: z.array(z.object({
    tipo: z.enum(['ALTURAS', 'RIESGO_ELECTRICO', 'MANIPULACION_ALIMENTOS', 'OTRO']),
    nombre: z.string().max(200).optional().nullable(),
    fechaExpedicion: z.string().min(1),
    fechaVencimiento: z.string().min(1),
    archivoUrl: z.string().max(500).optional().nullable(),
  })),
})
```
Zod for the other 7 legacy PUTs: OUT OF SCOPE (pre-existing surface) — note as deferred in result.md. All specs log in as admin, so regression risk is nil.

**FIX-9 (N6) — local-time DATE construction** — `backend/src/services/nominaService.ts:127,167` + `backend/src/services/certificateService.ts:106`
Replace `new Date(y, m - 1, 1)` with `new Date(Date.UTC(y, m - 1, 1))` in all three. (East-of-UTC servers would otherwise store the previous month's last day.)

**FIX-10 (N7) — nomina update can't clear fields** — `frontend/app/pages/nomina/index.vue:165-167` + `backend/src/services/nominaService.ts:~217-237`
Frontend: always send the full state — `archivos: archivosList` (even `[]`), `notas: form.notas.trim() || null`, `salario: form.salario` (null allowed). Backend `updateNominaPeriodo`: `null` → clear column; `archivos !== undefined` → replace-all (deleteMany + createMany, same conditional pattern as FIX-1).

**FIX-11 (N9) — contrato snapshot race + missing date-order validation** — `backend/src/services/nominaService.ts:170-178` + contratoSchema in `nomina.routes.ts`
Move the `contrato.findFirst` lookup INSIDE the `$transaction` of `createNominaPeriodo`. Add to contratoSchema:
```ts
.refine((d) => !d.fechaFin || d.fechaFin >= d.fechaInicio,
  { message: 'fechaFin debe ser posterior a fechaInicio', path: ['fechaFin'] })
```
Note: `.refine()` returns ZodEffects — if the update path uses `.partial()`, apply the refine AFTER building both schemas (same `baseCertificateFields` trick already used in certificates.routes.ts).

**FIX-12 (N8) — empty-string date → Prisma 500** — `backend/src/services/certificateService.ts:158-164`
```ts
// updateCertificate — normalize before spread:
for (const k of ['fechaEmision', 'fechaVencimiento', 'periodo'] as const) {
  if ((input as any)[k] === '') delete (input as any)[k]
}
```

### GROUP 3 — Cleanups

**CL-1 (B1+B2+D1) — `useFileUpload` composable** — NEW `frontend/app/composables/useFileUpload.ts`
Replaces 7 upload + 6 download re-implementations. First READ `backend/src/routes/uploads.routes.ts` to confirm the download-url response shape, then:
```ts
export function useFileUpload() {
  const { apiFetch } = useApi()
  const toast = useToast()
  const uploading = ref(false)

  async function uploadFile(file: File, folder: string): Promise<string | null> {
    uploading.value = true
    try {
      const res = await apiFetch<{ uploadUrl: string; key: string }>('/uploads/presigned-url', {
        method: 'POST',
        body: { contentType: file.type, folder },
      })
      await fetch(res.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      return res.key
    } catch (e: any) {
      toast.add({ severity: 'error', summary: 'Error al subir archivo', detail: e?.data?.message || e?.message || 'No se pudo subir el archivo.', life: 5000 })
      return null
    } finally {
      uploading.value = false
    }
  }

  async function downloadFile(key: string): Promise<void> {
    try {
      const res = await apiFetch<{ downloadUrl: string }>(`/uploads/download-url?key=${encodeURIComponent(key)}`) // verify shape vs uploads.routes.ts
      window.open(res.downloadUrl, '_blank')
    } catch {
      toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo descargar el archivo.', life: 5000 })
    }
  }

  return { uploading, uploadFile, downloadFile }
}
```
Also export `filenameFromKey` from `frontend/app/utils/file.ts` (kills the 4 copies — B2):
```ts
export function filenameFromKey(key?: string | null): string {
  if (!key) return ''
  const parts = key.split('/')
  return parts[parts.length - 1] || key
}
```
Call sites keep page-specific state (which slot is uploading etc.) but delegate the pipeline. Always reset the file input after handling: `(e.target as HTMLInputElement).value = ''` (D1 — nomina/index.vue is missing it). Nuxt auto-imports composables/ and utils/ — no import statements needed in pages.
Replace at: `certificados/crear.vue` (×2), `EmpleadoCertificadosEditor.vue`, `nomina/index.vue`, `empleados/[id]/index.vue`, `empleados/[id]/editar.vue` (×2 upload, ×2 download), `certificados/[id].vue` (×2 download).

**CL-2 (B3+B4+F3) — date utils** — NEW `frontend/app/utils/date.ts`
```ts
const MESES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const CERT_POR_VENCER_DAYS = 30

export function formatDate(value?: string | Date | null, style: 'long' | 'short' = 'short'): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', style === 'long'
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatPeriodo(periodo?: string | null): string {
  if (!periodo) return '—'
  const d = new Date(periodo)
  if (Number.isNaN(d.getTime())) return '—'
  return `${MESES_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
```
Replace the 7+ local `formatDate` and 2 `formatPeriodo` definitions in delivered files. DON'T touch pre-existing pages outside the delivered set.

**CL-3 (B5+B6) — spec auth helper** — NEW `frontend/tests/helpers/auth.ts`
```ts
import { expect, type Page } from '@playwright/test'
export async function loginAsAdmin(page: Page): Promise<void> {
  // copy body from any jul4 spec's login()
}
```
Update the 6 `jul4-p*.spec.ts` to import it (relative `../helpers/auth`); delete the 6 local `login()` + the dead `todayIso()` in jul4-p1.

**CL-4 (A3) — dead code**: delete `getContratoActivo` (`nominaService.ts:34-37`).

**CL-5 (C1–C14, D4) — strip phase-marker comments** (~70 lines)
`grep -rn "jul4 P\|jul4 —\|(P0 jul4)\|F2.3\|F1.1" backend/src backend/prisma/schema.prisma frontend/app` → delete narrative/phase markers. KEEP: the F1.1 badge-math banner in certificados/index.vue (documents non-obvious ≤30-day logic — strip only the "F1.1" token), the partial-index "defense in depth" note in the migration (F2 — but see FORBIDDEN below: never edit files under prisma/migrations/), and a 1-line note on EmpleadoCertificadosEditor's `v-model:certificados` semantics. Trim its JSDoc (C7) to that single constraint. Delete the nomina/index.vue header JSDoc (C13 — stale after FIX-6 anyway).

**CL-6 (B7) — console.error → toast** in delivered data-fetchers: `empleados/[id]/index.vue:165,255`, `empleados/[id]/editar.vue:258`, `certificados/index.vue:140,151` →
```ts
toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información.', life: 5000 })
```

**CL-7 (D3) — toast life**: normalize literals in DELIVERED files: success `3000`, error `5000`.

**CL-8 (D8/E2) — migrations convention doc** — NEW `backend/prisma/MIGRATIONS.md` (~15 lines): never edit applied migration files (checksum drift — the f2 incident); `20260705*`+ use idempotent guards (`DO $$ … duplicate_object`, `IF NOT EXISTS`) safe for staging re-runs; F-series are one-shot; DRIFT-1 note (tipo_certificado SET NOT NULL history) lives here, not in SQL headers.

### EXPLICITLY EXCLUDED (do NOT do)
- **E1/D7: editing any file under `backend/prisma/migrations/`** — FORBIDDEN. Applied migrations are checksummed; editing breaks `migrate status/deploy`.
- D2 periodo-typing unification, D6 REGISTRO_CIVIL spec, Zod for the 7 legacy sub-PUTs, OpenAPI type generation (cleanup #11) — deferred; list in result.md.

## Execution order
GROUP 1 (with regression asserts) → `tsc --noEmit` gate → GROUP 2 → GROUP 3 (CL-1/CL-2 first — FIX-2's template uses `formatDate`/`downloadFile`/`CERT_POR_VENCER_DAYS`; do CL-1+CL-2 BEFORE finishing FIX-2, or in one combined pass) → full suite.
Pragmatic order: CL-2 → CL-1 → FIX-1..3 → FIX-4..12 → CL-3..8 → gates.

## Key Files / Resources
- `development/jul4-improvements/tasks/code-review-jul4/result.md` — original findings (A/B/C/D/E/F codes)
- The Fable verification (N1–N9) is fully captured in this plan — no other source needed
- `backend/src/routes/uploads.routes.ts` — verify download-url response shape before CL-1
- `frontend/app/pages/certificados/index.vue:73-91` — canonical new-taxonomy labels for FIX-4

## Implementation Location
- Backend: `/Users/jeik/ws/mi-empresa-app-development/backend/`
- Frontend: `/Users/jeik/ws/mi-empresa-app-development/frontend/`

## Expected Deliverables
| File | Description |
|---|---|
| tasks/fix-review-findings/result.md | Per-fix table: finding id → files changed → verification evidence |
| tasks/fix-review-findings/completion-report.md | Handoff + deferred list |
| Modified: employeeService.ts, nominaService.ts, certificateService.ts, employees.routes.ts, nomina.routes.ts | Groups 1–2 |
| Modified: empleados/[id]/{index,editar}.vue, certificados/{[id],index,crear}.vue, nomina/index.vue, pacientes/{crear,editar}.vue, EmpleadoCertificadosEditor.vue, empleados/nuevo.vue, schema.prisma (comments only) | Groups 1–3 |
| NEW: frontend/app/composables/useFileUpload.ts, frontend/app/utils/date.ts, frontend/app/utils/file.ts, frontend/tests/helpers/auth.ts, backend/prisma/MIGRATIONS.md | Cleanup artifacts |
| Extended specs: jul4-p2, jul4-p5, p3-empleado-fields | Regression asserts for FIX-1/2/5 |

## Acceptance Criteria
1. All 12 FIX items implemented; each verified (spec assert or curl evidence in result.md)
2. `cd backend && npx tsc --noEmit` → 0 errors in delivered code (pre-existing unrelated errors listed, not fixed)
3. Zero `@ts-expect-error` left in employeeService.ts
4. `grep -rn "jul4 P" backend/src frontend/app backend/prisma/schema.prisma` → 0 hits
5. `grep -rn "async function login" frontend/tests/local-qa` → 0 hits (helper imported)
6. One `uploadFile` pipeline implementation in frontend/app (composable) — `grep -rln "presigned-url" frontend/app` → composable + ≤0 pages with inline pipeline
7. Full `tests/local-qa/` suite green (36 + new asserts) — no skipped tests
8. NO file under `backend/prisma/migrations/` modified (`git status backend/prisma/migrations` clean vs pre-task)

## Constraints / Watch-outs
- NEVER touch `backend/prisma/migrations/**` — checksummed.
- No schema/DB changes at all this task (schema.prisma edits = comment removal only; no `prisma migrate`).
- Backend restart after backend edits: `kill $(lsof -ti :3101)` → relaunch from backend/ with DATABASE_URL `postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev` PORT=3101 — never blanket pkill (:4142 prod).
- Nuxt auto-imports `composables/` + `utils/` — no manual imports in pages; specs DO need explicit relative imports.
- Tabs `v-show` → `:visible` scoping in specs.
- Comment stripping: per-file Edit, not blind sed (risk of eating real comments); verify with acceptance grep #4.
- Self-repair ≤2 per error → TURNING-POINT-STRATEGY.
