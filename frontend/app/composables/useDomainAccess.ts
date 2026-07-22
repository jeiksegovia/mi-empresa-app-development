import type { TipoEmpleado } from '~/shared/types/api'

/**
 * useDomainAccess — frontend mirror of the backend RBAC matrix
 * (contract-fixes-jul17-2 §1.2 / §1.5).
 *
 * The DOMAIN_ACCESS constant is duplicated on purpose (the contract explicitly
 * allows this); QA validates cell-by-cell parity against
 * `backend/src/middleware/domainAccess.ts`. Do NOT "simplify" it into a derived
 * shape — the flat literal IS the spec.
 *
 * Access value semantics:
 *   true          → full access
 *   'create-only' → GET list/detail + POST create allowed; PUT/PATCH/DELETE denied
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

export type DomainAccessValue = boolean | 'create-only'

// ─── §1.2 matrix (single source of truth, mirrored cell-by-cell) ────────────
export const DOMAIN_ACCESS: Record<TipoEmpleado, Record<Domain, DomainAccessValue>> = {
  GERONTOLOGA: {
    pacientes: true,
    fichas: true,
    instrumentos: true,
    empleados: false,
    nomina: false,
    certificados: false,
    empresa: false,
    notas: true,
    asistencia: false,
  },
  CONTRATOS: {
    pacientes: 'create-only',
    fichas: false,
    instrumentos: false,
    empleados: true,
    nomina: true,
    certificados: true,
    empresa: false,
    notas: false,
    asistencia: true,
  },
}

// ─── §1.5 route prefix → domain map ─────────────────────────────────────────
// Order matters only if prefixes nest; these are all distinct top-level paths.
export const DOMAIN_PREFIX_MAP: ReadonlyArray<{ prefix: string; domain: Domain }> = [
  { prefix: '/pacientes', domain: 'pacientes' },
  { prefix: '/instrumentos', domain: 'instrumentos' },
  { prefix: '/empleados', domain: 'empleados' },
  { prefix: '/asistencia', domain: 'asistencia' },
  { prefix: '/nomina', domain: 'nomina' },
  { prefix: '/certificados', domain: 'certificados' },
  { prefix: '/empresa', domain: 'empresa' },
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
   * §1.3: only EMPLEADO + GERONTOLOGA/CONTRATOS is constrained; everything
   * else falls through to legacy full access (zero regression).
   */
  const profile = computed<TipoEmpleado | null>(() => {
    const rol = authStore.role
    if (rol === 'ADMIN') return null
    if (rol !== 'EMPLEADO') return null
    const tipo = authStore.user?.tipoEmpleado
    return tipo === 'GERONTOLOGA' || tipo === 'CONTRATOS' ? tipo : null
  })

  /** Raw matrix value for a domain (true | 'create-only' | false). */
  function access(domain: Domain): DomainAccessValue {
    const p = profile.value
    if (!p) return true // ADMIN / non-EMPLEADO / legacy null → full access
    return DOMAIN_ACCESS[p][domain]
  }

  /** Any access at all (full OR create-only). Use for sidebar/route visibility. */
  function can(domain: Domain): boolean {
    return access(domain) !== false
  }

  /** True only when access is create-only (edit/delete must be hidden). */
  function canCreateOnly(domain: Domain): boolean {
    return access(domain) === 'create-only'
  }

  return { profile, access, can, canCreateOnly }
}
