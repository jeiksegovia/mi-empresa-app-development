import type { TipoEmpleado } from '~/shared/types/api'

/**
 * useDomainAccess — frontend mirror of the backend RBAC matrix
 * (contract-fixes-jul17-2 §1.2 / §1.5; contract-fixes-features-aug-6 §2).
 *
 * The DOMAIN_ACCESS constant is duplicated on purpose (the contract explicitly
 * allows this); QA validates cell-by-cell parity against
 * `backend/src/middleware/domainAccess.ts`. Do NOT "simplify" it into a derived
 * shape — the flat literal IS the spec.
 *
 * Access value semantics:
 *   true          → full access
 *   'create-only' → GET list/detail + POST create allowed; PUT/PATCH/DELETE denied
 *   'read-only'   → GET allowed; POST/PUT/PATCH/DELETE denied
 *   false         → no access (section hidden, route redirected)
 */
export type Domain =
  | 'pacientes'
  | 'fichas'
  | 'instrumentos'
  | 'empleados'
  | 'nomina'
  | 'certificados'
  | 'empresa'
  | 'notas'
  | 'asistencia'
  | 'centro-costos'
  | 'actividades' // qa-session-aug-17 R6

export type DomainAccessValue = boolean | 'create-only' | 'read-only'

// ─── §2.2 matrix (single source of truth, mirrored cell-by-cell) ────────────
// fixes-features-aug-6 §2.2: 4 tipos × 11 domains. EXTENDS the prior
// fixes-jul17-2 2-tipo matrix with PROFESORES + AUXILIARES rows and the new
// 'read-only' value. GERONTOLOGA.certificados flipped from false → true (S3).
export const DOMAIN_ACCESS: Record<TipoEmpleado, Record<Domain, DomainAccessValue>> = {
  GERONTOLOGA: {
    pacientes: true,
    fichas: true,
    instrumentos: true,
    empleados: false,
    nomina: false,
    // qa-aug-27 F1: GERONTOLOGA view/print/download only (was true / full write).
    certificados: 'read-only',
    empresa: false,
    notas: true,
    asistencia: false,
    // feature-centro-costos-ago-5 D4: GERONTOLOGA does not see centro-costos.
    'centro-costos': false,
    // qa-session-aug-17 §1.2: GET only.
    actividades: 'read-only',
  },
  CONTRATOS: {
    pacientes: 'create-only',
    fichas: false,
    instrumentos: false,
    empleados: true,
    nomina: true,
    certificados: 'read-only', // qa-aug-27 F1
    empresa: false,
    notas: false,
    asistencia: true,
    // feature-centro-costos-ago-5 D4: CONTRATOS has full access to centro-costos.
    'centro-costos': true,
    // qa-session-aug-17 §1.2: GET only.
    actividades: 'read-only',
  },
  // fixes-features-aug-6 §2.2 (S1): PROFESORES — view paciente info, fill ficha
  // but cannot edit/delete; create-only on notas (autor filter enforced on the
  // BE; FE just renders what it gets and hides edit/delete affordances).
  PROFESORES: {
    pacientes: 'read-only',
    fichas: 'create-only',
    instrumentos: false,
    empleados: false,
    nomina: false,
    certificados: false,
    empresa: false,
    notas: 'create-only',
    asistencia: false,
    'centro-costos': false,
    // qa-session-aug-17 §1.2: GET + POST; own-item + today-only are service rules.
    actividades: 'create-only',
  },
  // fixes-features-aug-6 §2.2 (S1): AUXILIARES — identical matrix to PROFESORES.
  AUXILIARES: {
    pacientes: 'read-only',
    fichas: 'create-only',
    instrumentos: false,
    empleados: false,
    nomina: false,
    certificados: false,
    empresa: false,
    notas: 'create-only',
    asistencia: false,
    'centro-costos': false,
    // qa-session-aug-17 §1.2: GET + POST; own-item + today-only are service rules.
    actividades: 'create-only',
  },
}

// ─── §1.5 route prefix → domain map ─────────────────────────────────────────
// Order matters only if prefixes nest; these are all distinct top-level paths.
export const DOMAIN_PREFIX_MAP: ReadonlyArray<{ prefix: string; domain: Domain }> = [
  { prefix: '/pacientes', domain: 'pacientes' },
  { prefix: '/instrumentos', domain: 'instrumentos' },
  { prefix: '/empleados', domain: 'empleados' },
  { prefix: '/asistencia', domain: 'asistencia' },
  // qa-session-aug-17 §1.4: Registro de actividades.
  { prefix: '/actividades', domain: 'actividades' },
  { prefix: '/nomina', domain: 'nomina' },
  { prefix: '/certificados', domain: 'certificados' },
  { prefix: '/empresa', domain: 'empresa' },
  // feature-centro-costos-ago-5: route prefix → domain wiring.
  { prefix: '/centro-costos', domain: 'centro-costos' },
]

/** Resolve the domain guarding a given route path, or null if unguarded. */
export function domainForPath(path: string): Domain | null {
  const match = DOMAIN_PREFIX_MAP.find(
    ({ prefix }) => path === prefix || path.startsWith(`${prefix}/`),
  )
  return match ? match.domain : null
}

export function useDomainAccess() {
  const authStore = useAuthStore()

  /**
   * The active EMPLEADO sub-profile, or null when the matrix does not apply
   * (ADMIN, AUDITOR/OPERADOR, or legacy EMPLEADO with tipoEmpleado null).
   * §1.3 (fixes-jul17-2) + §2.4 (fixes-features-aug-6): only EMPLEADO +
   * {GERONTOLOGA, CONTRATOS, PROFESORES, AUXILIARES} is constrained;
   * everything else falls through to legacy full access (zero regression).
   */
  const profile = computed<TipoEmpleado | null>(() => {
    const rol = authStore.role
    if (rol === 'ADMIN') return null
    if (rol !== 'EMPLEADO') return null
    const tipo = authStore.user?.tipoEmpleado
    return tipo === 'GERONTOLOGA'
      || tipo === 'CONTRATOS'
      || tipo === 'PROFESORES'
      || tipo === 'AUXILIARES'
      ? tipo
      : null
  })

  /** Raw matrix value for a domain (true | 'create-only' | 'read-only' | false). */
  function access(domain: Domain): DomainAccessValue {
    const p = profile.value
    if (!p) return true // ADMIN / non-EMPLEADO / legacy null → full access
    return DOMAIN_ACCESS[p][domain]
  }

  /** Any access at all (full OR create-only OR read-only). Use for sidebar/route visibility. */
  function can(domain: Domain): boolean {
    return access(domain) !== false
  }

  /** True only when access is create-only (edit/delete must be hidden). */
  function canCreateOnly(domain: Domain): boolean {
    return access(domain) === 'create-only'
  }

  /**
   * fixes-features-aug-6 §2.1: True only when access is 'read-only' (UI shows
   * the section but hides every write affordance: create/edit/delete). Use to
   * gate write CTA visibility for PROFESORES/AUXILIARES on `pacientes` etc.
   */
  function isReadOnly(domain: Domain): boolean {
    return access(domain) === 'read-only'
  }

  return { profile, access, can, canCreateOnly, isReadOnly }
}