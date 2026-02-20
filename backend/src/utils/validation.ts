import { z } from 'zod'

export function dateStr() {
  return z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid date string' }
  )
}

export function optionalDateStr() {
  return z.string().nullable().optional().refine(
    (val) => val === null || val === undefined || !isNaN(Date.parse(val)),
    { message: 'Invalid date string' }
  )
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})
