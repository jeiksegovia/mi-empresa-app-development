/**
 * Server-local "today" in America/Bogotá as YYYY-MM-DD.
 * Shared by asistencia + actividades (qa-session-aug-17 R6).
 * Signature must stay `() => string`.
 */
export function serverTodayBogota(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

/**
 * Colombian public holidays (Ley Emiliani — observed dates, not liturgical).
 * Keep a rolling 2-year window. Used by F4 "día hábil anterior".
 */
const COLOMBIA_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
  '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02',
  '2026-11-16', '2026-12-08', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-11', '2027-03-22', '2027-03-25', '2027-03-26',
  '2027-05-01', '2027-05-17', '2027-06-07', '2027-06-14', '2027-07-05',
  '2027-07-20', '2027-08-07', '2027-08-16', '2027-10-18', '2027-11-01',
  '2027-11-15', '2027-12-08', '2027-12-25',
])

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function weekdayUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 Sun .. 6 Sat
}

export function isColombiaHoliday(ymd: string): boolean {
  return COLOMBIA_HOLIDAYS.has(ymd)
}

export function isBusinessDayBogota(ymd: string): boolean {
  const wd = weekdayUtc(ymd)
  if (wd === 0 || wd === 6) return false
  return !isColombiaHoliday(ymd)
}

/** Previous Colombian business day relative to `ymd` (exclusive). */
export function previousBusinessDayBogota(ymd: string): string {
  let cursor = shiftYmd(ymd, -1)
  for (let i = 0; i < 16; i++) {
    if (isBusinessDayBogota(cursor)) return cursor
    cursor = shiftYmd(cursor, -1)
  }
  return cursor
}

export function contratosAllowedFechas(today = serverTodayBogota()): {
  today: string
  previousBusinessDay: string
  allowed: string[]
} {
  const prev = previousBusinessDayBogota(today)
  const allowed = prev === today ? [today] : [today, prev]
  return { today, previousBusinessDay: prev, allowed }
}
