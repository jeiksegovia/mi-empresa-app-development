/**
 * Playwright spec-file helper: ensures backend/.env is loaded BEFORE
 * anything from src/config/env.ts is imported. ES module imports are
 * executed top-to-bottom in declaration order, so this file MUST be
 * the first import in any spec that actually calls into src/services
 * or src/config (it sets process.env so that the read-time
 * `config.aws.s3Bucket` and friends see the values).
 *
 * Imports only side effects (dotenv) — no exports.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = resolve(__dirname, '../..')
loadEnv({ path: resolve(BACKEND_ROOT, '.env') })
