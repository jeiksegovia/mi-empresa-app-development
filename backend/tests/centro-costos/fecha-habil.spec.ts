import { test, expect } from '@playwright/test'
import {
  previousBusinessDayBogota,
  isBusinessDayBogota,
  contratosAllowedFechas,
} from '../../src/utils/dateBogota.js'

test.describe('aug-27 F4 business-day helper', () => {
  test('Saturday 2026-08-22 → previous Friday 2026-08-21', () => {
    expect(previousBusinessDayBogota('2026-08-22')).toBe('2026-08-21')
  })

  test('Monday after Ley Emiliani 2026-08-17 (Mon holiday) → Friday 2026-08-14', () => {
    // 2026-08-17 is a Monday holiday; 2026-08-18 is Tuesday.
    expect(isBusinessDayBogota('2026-08-17')).toBe(false)
    expect(previousBusinessDayBogota('2026-08-18')).toBe('2026-08-14')
  })

  test('allowed window includes today and previous business day', () => {
    const w = contratosAllowedFechas('2026-08-18')
    expect(w.today).toBe('2026-08-18')
    expect(w.previousBusinessDay).toBe('2026-08-14')
    expect(w.allowed).toEqual(['2026-08-18', '2026-08-14'])
  })
})
