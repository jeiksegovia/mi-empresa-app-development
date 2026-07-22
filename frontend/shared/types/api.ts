export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
  field?: string
  code?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// fixes-jul17-2 §1.4: EMPLEADO sub-profile. Additive; may be absent (legacy
// sessions) or null (EMPLEADO without a sub-profile → treated as legacy = full
// access). ADMIN/AUDITOR/OPERADOR ignore this field.
export type TipoEmpleado = 'GERONTOLOGA' | 'CONTRATOS'

// ─── nomina-asistencia-jul-18 ─────────────────────────────────────────────────
/** Medio de pago de nómina (nullable on empleado = "Sin definir"). */
export type MedioPagoNomina = 'NEQUI' | 'TRANSFERENCIA_BANCARIA'

/** Tipo de cuenta bancaria when medio is TRANSFERENCIA_BANCARIA. */
export type TipoCuentaBanco = 'AHORRO' | 'CORRIENTE'

/** Exact pendiente description when medio de pago is incomplete. */
export const PENDIENTE_MEDIO_PAGO = 'Falta medio de pago de nómina'

/** Medio de pago fields on Empleado (all optional / nullable). */
export interface EmpleadoMedioPago {
  medioPagoTipo?: MedioPagoNomina | null
  medioPagoNequi?: string | null
  bancoNombre?: string | null
  bancoTipoCuenta?: TipoCuentaBanco | null
  bancoNumeroCuenta?: string | null
}

/** Row from GET /asistencia?fecha=YYYY-MM-DD (synthetic id:null when no row). */
export interface AsistenciaDiaRow {
  id: number | null
  empleadoId: number
  jornadaAm: boolean
  jornadaPm: boolean
  notas: string | null
  empleado: {
    id: number
    nombre: string
    apellido: string
    numeroDocumento: string
    estado: string
  }
}

/** Item in PUT /asistencia/dia body. */
export interface AsistenciaDiaItem {
  empleadoId: number
  jornadaAm: boolean
  jornadaPm: boolean
  notas?: string | null
}

/** PUT /asistencia/dia request body. */
export interface AsistenciaDiaPutBody {
  fecha: string
  items: AsistenciaDiaItem[]
}

/** Row from GET /asistencia/resumen?periodo=YYYY-MM. */
export interface AsistenciaResumenRow {
  empleadoId: number
  mediasJornadas: number
  horas: number
}

/** Month summary embedded on GET /nomina rows. */
export interface AsistenciaMesSummary {
  mediasJornadas: number
  horas: number
}

/** Computed suggestion object on GET /nomina (not persisted). */
export interface NominaSugerido {
  mediasJornadas: number
  valorJornada: number | null
  subtotalCalculado: number
  aportesSociales: number
  totalPagado: number
}

/** Calc fields accepted on POST/PUT /nomina/periodos. */
export interface NominaCalcFields {
  mediasJornadas?: number | null
  valorJornada?: number | null
  subtotalCalculado?: number | null
  aportesSociales?: number | null
  totalPagado?: number | null
}

export interface User {
  id: number
  email: string
  nombre: string
  apellido: string
  rol: string
  tipoEmpleado?: TipoEmpleado | null
  activo?: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
}

export interface LogoutResponse {
  message: string
}

export interface MeResponse {
  user: User
}

export interface ApiError {
  message: string
  statusCode?: number
  errors?: Record<string, string[]>
  field?: string
  code?: string
}
