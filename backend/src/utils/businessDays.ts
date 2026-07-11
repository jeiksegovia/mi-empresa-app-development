/**
 * jul-9 B2: business-day math helpers (L3 hard block + L6 deferred holiday calendar).
 *
 * v1 is weekday-only (Mon-Fri are business days). No Colombian holiday table yet;
 * add when a client reports weekend-adjacent edge cases (TODO(holidays)).
 *
 * IMPORTANT: we always treat user-supplied `YYYY-MM-DD` date strings as
 * **local-calendar dates** (NOT UTC). The server may run in any TZ (dev is
 * UTC, staging/prod may be UTC-5 / Colombia). Treating the date string as UTC
 * causes a 1-day offset on UTC-5 hosts, which broke "future" rejection.
 */

/**
 * Parse a `YYYY-MM-DD` string into a Date that, when read with local-time
 * getters (getFullYear / getMonth / getDate), yields exactly those numbers.
 *
 * `new Date('YYYY-MM-DD')` interprets as UTC, so on a UTC-5 host that becomes
 * "previous day 19:00 local" — wrong. We anchor at local-noon for safety
 * (no DST surprises since noon never crosses midnight), then round-trip
 * getters on it return the intended calendar day.
 */
export function parseLocalDate(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return new Date(NaN)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  // Use local-noon so DST transitions can't push us across midnight
  return new Date(y, mo - 1, d, 12, 0, 0, 0)
}

/**
 * True if `d` is a weekday (Mon-Fri). Sat=6, Sun=0 — anything else is a weekday.
 */
export function isWeekday(d: Date): boolean {
  const dow = d.getDay()
  return dow !== 0 && dow !== 6
}

/**
 * Count weekdays from `from` (inclusive, local-calendar day) up to `to`
 * (inclusive). Always returns a non-negative integer.
 *
 * Examples (weekday-only, no holidays):
 *   businessDaysBetween(weekday, same weekday) // → 1
 *   businessDaysBetween(weekday, weekday + 1)  // → 2
 *   businessDaysBetween(mon, fri-same-week)    // → 5
 */
export function businessDaysBetween(from: Date, to: Date): number {
  // Normalize to local-midnight before iterating.
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  const lo = a.getTime() <= b.getTime() ? a : b
  const hi = a.getTime() <= b.getTime() ? b : a

  let count = 0
  const cursor = new Date(lo)
  while (cursor.getTime() <= hi.getTime()) {
    if (isWeekday(cursor)) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

/**
 * Convenience predicate (L3). `candidate` must be ≤ `now` AND within
 * `maxBusinessDays` business days back (or today). A weekend date 1 day back
 * still counts as 1 business day, since we subtract weekends.
 *
 * @param candidate        the user-supplied incident date (Date or YYYY-MM-DD string)
 * @param now              the current moment (Date)
 * @param maxBusinessDays  e.g. 2 for the L3 hard block
 */
export function isWithinLastBusinessDays(
  candidate: Date | string,
  now: Date,
  maxBusinessDays: number,
): boolean {
  const candDate = typeof candidate === 'string' ? parseLocalDate(candidate) : candidate
  if (Number.isNaN(candDate.getTime())) return false

  const candMidnight = new Date(candDate.getFullYear(), candDate.getMonth(), candDate.getDate())
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Future (incl. today-as-future-tomorrow): reject.
  if (candMidnight.getTime() > nowMidnight.getTime()) return false

  // Walk inclusive from candidate to now. businessDaysBetween counts both ends
  // as 1 when on the same weekday, so "0 business days back" means today.
  const days = businessDaysBetween(candMidnight, nowMidnight)
  const back = Math.max(0, days - 1)
  return back <= maxBusinessDays
}
