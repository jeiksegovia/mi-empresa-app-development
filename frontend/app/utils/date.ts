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
