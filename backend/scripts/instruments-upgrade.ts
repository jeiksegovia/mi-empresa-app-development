/**
 * instruments-upgrade — apply template JSON changes to DB.
 *
 * Contract: schema-contract-instrumentos-dynamic-fichas §3.1 immutability.
 *  - `version` rows are immutable once ≥1 RegistroFichaCompletada references them.
 *  - One row per `instrumentoId` may have `activo = true` (enforced by partial unique index).
 *  - `definicion_jsonb` is JSONB; deep-equality check vs existing row decides if "mutated".
 *
 * Behavior (per task #15, contract §3.1):
 *   1. Read every `backend/prisma/instrument-templates/*.json` (only `*.v{n}.json`).
 *   2. Validate structure (required keys, types, gapless ranges — port of check_template.py).
 *      If invalid → exit 1 with reasons.
 *   3. For each `codigo`:
 *      a. Upsert the Instrumento row (idempotent).
 *      b. If a version row with `version = template.version` already exists:
 *         - Compare deep-equality of `definition`. If differs:
 *           - If ≥1 RegistroFichaCompletada references it → REFUSE (VERSION_LOCKED),
 *             exit non-zero. Do NOT mutate.
 *           - Else → update definition in place (no fichas pinned to it yet).
 *         - If equal → skip ("no-op").
 *      c. If no row with `version = template.version` exists → INSERT new row, flip
 *         `activo = true` (transactional; respects partial unique index by first
 *         flipping any prior active row to false in the same transaction).
 *
 * Never touches `registros_fichas_completadas`.
 *
 * Usage:
 *   npm run instruments:upgrade
 *   # or
 *   tsx scripts/instruments-upgrade.ts
 *
 * Safety:
 *   - Refuses to run against a deployed stage DB (same heuristic as seed.ts).
 *   - Exit 0 on full success / no-op; exit 1 on validation error OR VERSION_LOCKED.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/index.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ============================================================
// Validation (TypeScript port of check_template.py)
// ============================================================

type ScoringRange = { min: number; max: number; label: string };
type Definition = {
  codigo: string;
  nombre: string;
  version: number;
  tipo: string;
  descripcion?: string;
  instructions?: string;
  mergeOf?: string[];
  // fixes-features-aug-6 §3.4: optional top-level rolesPermitidos — when
  // present, the upgrade uses this CSV on the Instrumento row instead of the
  // hardcoded 'ADMIN,EMPLEADO'. Back-compat: missing → legacy default.
  rolesPermitidos?: string;
  sections: Section[];
  scoring: { total: string; resultEvaluation: ScoringRange[] };
};
type Section = {
  id: string;
  titulo: string;
  instructions?: string;
  subtotal?: { max?: number; resultEvaluation?: ScoringRange[] };
  condition?: { skipIf?: { sectionId: string; op: string; value: number } };
  items: Item[];
};
type Item = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  instructions?: string;
  placeholder?: string;
  options?: { value: string; label: string; score?: number | null }[];
  constraints?: { min: number; max: number };
  columns?: { id: string; label: string; score: null }[];
  rows?: { id: string; label: string }[];
  cellInput?: 'select' | 'text';
};

const VALID_TYPES = new Set([
  'single-select-scored',
  'number-info',
  'text-info',
  'single-select-info',
  'group-info',
]);
const VALID_TIPOS = new Set(['VALORACION', 'NUTRICION', 'MATRICULA', 'ADMISION']);
const VALID_TOTAL = new Set(['sum', 'none']);

class ValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(`Template validation failed:\n  - ${errors.join('\n  - ')}`);
    this.errors = errors;
  }
}

function validateDefinition(def: Definition, source: string): void {
  const errors: string[] = [];

  for (const k of ['codigo', 'nombre', 'version', 'tipo', 'sections', 'scoring'] as const) {
    if (def[k] === undefined || def[k] === null) errors.push(`[${source}] missing top-level key: ${k}`);
  }
  if (errors.length) throw new ValidationError(errors);

  if (!VALID_TIPOS.has(def.tipo)) errors.push(`[${source}] tipo '${def.tipo}' not in valid set`);
  if (!Number.isInteger(def.version) || def.version < 1) errors.push(`[${source}] version must be int >= 1`);
  if (!Array.isArray(def.sections) || def.sections.length < 1) errors.push(`[${source}] sections must be non-empty array`);

  const sectionIds = new Set<string>();
  const pendingSkipIf: { sidx: number; sid: string; ref: string }[] = [];
  for (const [sidx, s] of def.sections.entries()) {
    if (!s.id) errors.push(`section[${sidx}].id missing`);
    if (sectionIds.has(s.id)) errors.push(`duplicate section id: ${s.id}`);
    sectionIds.add(s.id);
    if (!s.titulo) errors.push(`section[${s.id}] missing titulo`);
    if (!Array.isArray(s.items)) errors.push(`section[${s.id}] missing items[]`);

    // condition.skipIf shape
    if (s.condition?.skipIf) {
      const si = s.condition.skipIf;
      if (!['>=', '<=', '>', '<', '==', '!='].includes(si.op)) {
        errors.push(`section[${s.id}].condition.skipIf.op '${si.op}' not supported`);
      }
      if (typeof si.value !== 'number') errors.push(`section[${s.id}].condition.skipIf.value must be number`);
      pendingSkipIf.push({ sidx, sid: s.id, ref: si.sectionId });
    }

    // Items
    const itemIds = new Set<string>();
    for (const it of s.items) {
      if (!it.id) errors.push(`item missing id in section[${s.id}]`);
      if (itemIds.has(it.id)) errors.push(`duplicate item id '${it.id}' in section[${s.id}]`);
      itemIds.add(it.id);
      if (!it.label) errors.push(`item[${it.id}] missing label`);
      if (!VALID_TYPES.has(it.type)) errors.push(`item[${it.id}].type '${it.type}' not in valid set`);
      if (typeof it.required !== 'boolean') errors.push(`item[${it.id}].required must be boolean`);

      if (it.type === 'single-select-scored') {
        if (!Array.isArray(it.options) || it.options.length < 2) {
          errors.push(`item[${it.id}] (single-select-scored): must have >= 2 options`);
        } else {
          for (const o of it.options) {
            if (typeof o.score !== 'number') errors.push(`item[${it.id}] option '${o.value}' missing numeric score`);
          }
        }
      } else if (it.type === 'single-select-info') {
        if (!Array.isArray(it.options) || it.options.length < 2) {
          errors.push(`item[${it.id}] (single-select-info): must have >= 2 options`);
        }
      } else if (it.type === 'group-info') {
        const cols = it.columns ?? [];
        const rows = it.rows ?? [];
        if (cols.length < 2) errors.push(`item[${it.id}] (group-info): must have >= 2 columns`);
        if (rows.length < 1) errors.push(`item[${it.id}] (group-info): must have >= 1 row`);
        if (it.cellInput !== undefined && !['select', 'text'].includes(it.cellInput)) {
          errors.push(`item[${it.id}] (group-info): cellInput must be 'select' or 'text'`);
        }
        for (const c of cols) {
          if (c.score !== null) errors.push(`item[${it.id}] (group-info): column '${c.id}' must have score=null`);
        }
      }
    }

    // Section-level resultEvaluation (G2-2)
    const secRe = s.subtotal?.resultEvaluation;
    if (secRe !== undefined) checkRanges(secRe, `section[${s.id}].subtotal.resultEvaluation`, errors);
  }

  // Post-pass: condition.skipIf references earlier section with subtotal.resultEvaluation
  for (const { sidx, sid, ref } of pendingSkipIf) {
    const refIdx = def.sections.findIndex((x) => x.id === ref);
    if (refIdx === -1 || refIdx >= sidx) {
      errors.push(`section[${sid}].condition.skipIf.sectionId '${ref}' must reference an EARLIER section`);
    } else {
      const refSec = def.sections[refIdx];
      if (!refSec.subtotal?.resultEvaluation) {
        errors.push(`section[${ref}] is referenced by a skipIf rule but has no subtotal.resultEvaluation (G2-2)`);
      }
    }
  }

  // Scoring
  if (!VALID_TOTAL.has(def.scoring.total)) errors.push(`scoring.total '${def.scoring.total}' not in valid set`);
  const reList = def.scoring.resultEvaluation ?? [];
  if (def.scoring.total === 'sum') {
    if (reList.length === 0) errors.push(`scoring.total='sum' but resultEvaluation is empty`);
    else checkRanges(reList, `scoring.resultEvaluation`, errors);
  } else if (def.scoring.total === 'none') {
    if (reList.length > 0) errors.push(`scoring.total='none' but resultEvaluation is non-empty`);
  }

  if (errors.length) throw new ValidationError(errors);
}

function checkRanges(ranges: ScoringRange[], ctx: string, errors: string[]): void {
  const sorted = [...ranges].sort((a, b) => a.min - b.min);
  let prevMax = -1;
  let step: number | null = null;
  for (const [i, r] of sorted.entries()) {
    if (typeof r.min !== 'number' || typeof r.max !== 'number' || !r.label) {
      errors.push(`${ctx}[${i}] must have numeric min, max, label`);
      continue;
    }
    if (r.min > r.max) errors.push(`${ctx}[${i}]: min (${r.min}) > max (${r.max})`);
    if (i === 0 && r.min !== 0) errors.push(`${ctx}[${i}]: first range must start at 0; got ${r.min}`);
    if (i > 0) {
      const gap = r.min - prevMax;
      if (step === null) step = gap;
      else if (Math.abs(gap - step) > 1e-9) errors.push(`${ctx}[${i}]: gap ${gap} differs from prior step ${step}`);
      if (r.min > prevMax + step + 1e-9) errors.push(`${ctx}[${i}]: gap of ${r.min - prevMax} (expected step=${step})`);
      if (r.min < prevMax - 1e-9) errors.push(`${ctx}[${i}]: overlap with previous (prev.max=${prevMax}, this.min=${r.min})`);
    }
    prevMax = r.max;
  }
}

// ============================================================
// Helpers
// ============================================================

const TEMPLATE_DIR = resolve(process.cwd(), 'prisma/instrument-templates');

const PERIODICIDAD_BY_CODIGO: Record<
  string,
  'UNICA' | 'ANUAL' | 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL'
> = {
  BARTHEL: 'SEMESTRAL',
  MINI_MENTAL: 'ANUAL',
  TINETTI: 'SEMESTRAL',
  YESAVAGE: 'ANUAL',
  MNA_CUADRO: 'SEMESTRAL',
  FICHA_NUTRICIONAL: 'SEMESTRAL',
  VALORACION_INTEGRAL: 'UNICA',
  // fixes-features-aug-6: 2 new templates get explicit periodicidad.
  SIGNOS_VITALES: 'MENSUAL',
  BOLETIN_ANUAL: 'ANUAL',
};

// fixes-features-aug-6 §3.4: read `rolesPermitidos` from the template
// top-level if present; otherwise fall back to the legacy 'ADMIN,EMPLEADO'.
function resolveRolesPermitidos(def: Definition): string {
  const fromTemplate = def.rolesPermitidos?.trim()
  if (fromTemplate && fromTemplate.length > 0) return fromTemplate
  return 'ADMIN,EMPLEADO'
}

function loadTemplates(): Definition[] {
  const files = readdirSync(TEMPLATE_DIR).filter((f) => /\.v\d+\.json$/.test(f));
  if (files.length === 0) throw new Error(`No template JSONs found in ${TEMPLATE_DIR}`);
  const defs: Definition[] = [];
  for (const f of files) {
    const path = join(TEMPLATE_DIR, f);
    const raw = readFileSync(path, 'utf8');
    try {
      const d = JSON.parse(raw) as Definition;
      validateDefinition(d, f);
      defs.push(d);
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new Error(`Failed to parse ${f}: ${(err as Error).message}`);
    }
  }
  return defs;
}

function deepEqualJson(a: unknown, b: unknown): boolean {
  // JSONB normalizes key order on storage, so JSON.stringify round-trip comparison fails.
  // Use a structural comparison that ignores key ordering at every level.
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualJson(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(b)) return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const akeys = Object.keys(ao).sort();
  const bkeys = Object.keys(bo).sort();
  if (akeys.length !== bkeys.length) return false;
  for (let i = 0; i < akeys.length; i++) {
    if (akeys[i] !== bkeys[i]) return false;
    if (!deepEqualJson(ao[akeys[i]], bo[bkeys[i]])) return false;
  }
  return true;
}

function latestDefinitionsByCodigo(defs: Definition[]): Definition[] {
  const latest = new Map<string, Definition>();
  for (const def of defs) {
    const current = latest.get(def.codigo);
    if (!current || def.version > current.version) latest.set(def.codigo, def);
  }
  return [...latest.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

async function ensureInstrumentRows(defs: Definition[], createdBy: number): Promise<void> {
  console.log('📋 Ensuring template Instrumento rows …');
  for (const def of latestDefinitionsByCodigo(defs)) {
    const existing = await prisma.instrumento.findUnique({ where: { codigo: def.codigo } });
    const targetRoles = resolveRolesPermitidos(def);

    if (existing) {
      // fixes-features-aug-6 §3.4: reconcile an existing row whose
      // rolesPermitidos / periodicidad predates this contract. Only sync
      // when the template declares an explicit value that differs.
      const targetPeriodicidad = (PERIODICIDAD_BY_CODIGO[def.codigo] ?? 'UNICA') as any
      const updates: Record<string, unknown> = {}
      if (def.rolesPermitidos && def.rolesPermitidos.trim() && existing.rolesPermitidos !== targetRoles) {
        updates.rolesPermitidos = targetRoles
      }
      if (existing.periodicidad !== targetPeriodicidad && PERIODICIDAD_BY_CODIGO[def.codigo]) {
        updates.periodicidad = targetPeriodicidad
      }
      if (Object.keys(updates).length > 0) {
        await prisma.instrumento.update({ where: { id: existing.id }, data: updates })
        console.log(`  🔁 ${def.codigo} reconciled: ${JSON.stringify(updates)}`)
      } else {
        console.log(`  ⏭  ${def.codigo} Instrumento row exists`)
      }
      continue
    }

    await prisma.instrumento.create({
      data: {
        codigo: def.codigo,
        nombreInstrumento: def.nombre,
        descripcion: def.descripcion,
        tipo: def.tipo as any,
        periodicidad: (PERIODICIDAD_BY_CODIGO[def.codigo] ?? 'UNICA') as any,
        // fixes-features-aug-6 §3.4: honor the template's top-level
        // rolesPermitidos when present (e.g. SIGNOS_VITALES, BOLETIN_ANUAL);
        // otherwise fall back to the legacy 'ADMIN,EMPLEADO'.
        rolesPermitidos: targetRoles,
        estado: 'ACTIVO',
        creadoPor: createdBy,
      },
    });
    console.log(`  ➕ ${def.codigo} Instrumento row created (rolesPermitidos='${targetRoles}')`);
  }
}

async function activateLatestDefinitions(defs: Definition[]): Promise<void> {
  console.log('🎯 Activating highest template versions …');
  for (const def of latestDefinitionsByCodigo(defs)) {
    const instrumento = await prisma.instrumento.findUnique({ where: { codigo: def.codigo } });
    if (!instrumento) throw new Error(`Instrumento row missing after ensure: ${def.codigo}`);
    const version = await prisma.instrumentoVersion.findUnique({
      where: { instrumentoId_version: { instrumentoId: instrumento.id, version: def.version } },
    });
    if (!version) throw new Error(`Version missing after apply: ${def.codigo} v${def.version}`);
    if (version.activo) {
      console.log(`  ⏭  ${def.codigo} v${def.version} already active`);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.instrumentoVersion.updateMany({
        where: { instrumentoId: instrumento.id, activo: true },
        data: { activo: false },
      });
      await tx.instrumentoVersion.update({
        where: { id: version.id },
        data: { activo: true },
      });
    });
    console.log(`  ✓ ${def.codigo} v${def.version} activated`);
  }
}

// ============================================================
// Upgrade logic
// ============================================================

type UpgradeAction =
  | { kind: 'noop'; codigo: string; version: number }
  | { kind: 'insert'; codigo: string; version: number }
  | { kind: 'update-definition'; codigo: string; version: number; fichas: number }
  | { kind: 'locked'; codigo: string; version: number; fichas: number };

async function upgradeOne(def: Definition): Promise<UpgradeAction> {
  // Pick highest version for this codigo (single template per codigo per call is normal,
  // but allow multiple `*.v{n}.json` files — we process highest version last so it's activo).
  const instrumento = await prisma.instrumento.findUnique({ where: { codigo: def.codigo } });
  if (!instrumento) return { kind: 'insert', codigo: def.codigo, version: def.version };

  const existing = await prisma.instrumentoVersion.findUnique({
    where: { instrumentoId_version: { instrumentoId: instrumento.id, version: def.version } },
  });
  if (!existing) {
    return { kind: 'insert', codigo: def.codigo, version: def.version };
  }

  const fichasCount = await prisma.registroFichaCompletada.count({
    where: { instrumentoVersionId: existing.id },
  });
  const sameDef = deepEqualJson(existing.definition, def);
  if (sameDef) {
    return { kind: 'noop', codigo: def.codigo, version: def.version };
  }
  if (fichasCount > 0) {
    return { kind: 'locked', codigo: def.codigo, version: def.version, fichas: fichasCount };
  }
  return { kind: 'update-definition', codigo: def.codigo, version: def.version, fichas: fichasCount };
}

async function applyAction(action: UpgradeAction, def: Definition, createdBy: number): Promise<void> {
  const instrumento = await prisma.instrumento.findUnique({ where: { codigo: def.codigo } });
  if (!instrumento) throw new Error(`Instrumento disappeared: ${def.codigo}`);

  if (action.kind === 'noop') {
    console.log(`  ⏭  skip  ${def.codigo} v${def.version} (unchanged)`);
    return;
  }
  if (action.kind === 'insert') {
    await prisma.$transaction(async (tx) => {
      // Flip any existing active row to false
      await tx.instrumentoVersion.updateMany({
        where: { instrumentoId: instrumento.id, activo: true },
        data: { activo: false },
      });
      await tx.instrumentoVersion.create({
        data: {
          instrumentoId: instrumento.id,
          version: def.version,
          definition: def as unknown as Prisma.InputJsonValue,
          activo: true,
          createdBy,
        },
      });
    });
    console.log(`  ➕ insert ${def.codigo} v${def.version} (activo=true)`);
    return;
  }
  if (action.kind === 'update-definition') {
    await prisma.instrumentoVersion.update({
      where: { id: (await prisma.instrumentoVersion.findUnique({
        where: { instrumentoId_version: { instrumentoId: instrumento.id, version: def.version } },
      }))!.id },
      data: { definition: def as unknown as Prisma.InputJsonValue },
    });
    console.log(`  ✏️  update ${def.codigo} v${def.version} definition (no fichas pinned)`);
    return;
  }
  if (action.kind === 'locked') {
    console.error(`  🔒 REFUSE ${def.codigo} v${def.version}: VERSION_LOCKED (${action.fichas} ficha(s) reference it)`);
    throw new Error(`VERSION_LOCKED: ${def.codigo} v${def.version} is referenced by ${action.fichas} completion(s); refusing to mutate.`);
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const dbName = new URL(connectionString).pathname;
  if (/(staging|prod)/i.test(dbName) && process.env.FORCE_UPGRADE !== 'true') {
    console.error(`❌ Refusing to upgrade ${dbName}: looks like a deployed stage database. Set FORCE_UPGRADE=true to override.`);
    process.exit(1);
  }

  console.log(`📥 Loading templates from ${TEMPLATE_DIR} …`);
  const defs = loadTemplates();
  console.log(`  Found ${defs.length} validated template(s): ${defs.map((d) => `${d.codigo}@v${d.version}`).join(', ')}`);

  // Sort by version ascending so that, when activating the latest, prior versions are inserted first.
  defs.sort((a, b) => a.version - b.version);

  // Validate cross-codigo uniqueness of codigo (multiple files for same codigo OK; same version NOT OK)
  const seenVersionKey = new Set<string>();
  for (const d of defs) {
    const key = `${d.codigo}@v${d.version}`;
    if (seenVersionKey.has(key)) {
      console.error(`❌ Duplicate codigo+version: ${key}`);
      process.exit(1);
    }
    seenVersionKey.add(key);
  }

  // Resolve createdBy: first ADMIN user (same heuristic as seed.ts)
  const admin = await prisma.usuario.findFirst({ where: { rol: 'ADMIN' } });
  if (!admin) {
    console.error('❌ No ADMIN user found. Run seed first.');
    process.exit(1);
  }

  // Phase 1: probe actions for each template (read-only)
  console.log('🔍 Probing existing state …');
  const actions: { def: Definition; action: UpgradeAction }[] = [];
  for (const def of defs) {
    const action = await upgradeOne(def);
    actions.push({ def, action });
  }

  const lockedActions = actions.filter(
    (entry): entry is { def: Definition; action: Extract<UpgradeAction, { kind: 'locked' }> } =>
      entry.action.kind === 'locked',
  );
  if (lockedActions.length > 0) {
    for (const { action } of lockedActions) {
      console.error(
        `  🔒 REFUSE ${action.codigo} v${action.version}: VERSION_LOCKED (${action.fichas} ficha(s) reference it)`,
      );
    }
    throw new Error('VERSION_LOCKED: one or more referenced definitions differ; no upgrade actions applied.');
  }

  // Missing Instrumento rows are created only after every existing-version lock
  // probe passes, so a refused upgrade does not leave metadata-only templates.
  await ensureInstrumentRows(defs, admin.id);

  // Phase 2: apply in order (all VERSION_LOCKED cases were rejected above)
  console.log('🚀 Applying …');
  for (const { def, action } of actions) {
    try {
      // Always stamp createdBy for new rows (insert path reads it via closure)
      await applyAction(action, def, admin.id);
    } catch (err) {
      console.error(`❌ Upgrade aborted: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  await activateLatestDefinitions(defs);

  console.log('\n✅ instruments:upgrade complete.');
}

main()
  .catch((e) => {
    console.error('❌ Upgrade failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });