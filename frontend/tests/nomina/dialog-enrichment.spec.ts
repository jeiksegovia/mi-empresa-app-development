/**
 * dialog-enrichment.spec.ts — alias of registrar-dialog-enrichment
 * (kept so older run commands still work).
 *
 * See registrar-dialog-enrichment.spec.ts for the authoritative suite.
 */
export {}

// Re-export by requiring the same file path is not needed; Playwright discovers
// both specs. This file intentionally duplicates nothing to avoid double-runs.
// Prefer: npx playwright test tests/nomina/registrar-dialog-enrichment.spec.ts
