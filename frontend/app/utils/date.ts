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

/**
 * Normalize a date value to a plain `YYYY-MM-DD` string (LOCAL calendar date).
 *
 * QA jul-11 B1/B2: PrimeVue DatePicker v-models are `Date` objects. Passing
 * them straight into a JSON body serializes the full ISO timestamp, which the
 * backend's YYYY-MM-DD schemas reject. Always run DatePicker values through
 * this before building request payloads. Local getters (not toISOString) so
 * a midnight-local pick never rolls to the previous UTC day.
 */
export function toYMD(value?: string | Date | null): string {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  if (Number.isNaN(value.getTime())) return ''
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${m}-${d}`
}

export function formatPeriodo(periodo?: string | null): string {
  if (!periodo) return '—'
  const d = new Date(periodo)
  if (Number.isNaN(d.getTime())) return '—'
  return `${MESES_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
