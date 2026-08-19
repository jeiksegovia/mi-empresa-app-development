/**
 * Server-local "today" in America/Bogotá as YYYY-MM-DD.
 * Shared by asistencia + actividades (qa-session-aug-17 R6).
 * Signature must stay `() => string`.
 */
export function serverTodayBogota(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}
