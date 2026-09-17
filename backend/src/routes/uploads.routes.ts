import { Router, Request, Response, RequestHandler } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { generateUploadUrl, generateDownloadUrl, CredentialsExpiredError } from '../services/s3Service.js'
import { getPrisma } from '../config/database.js'
import {
  DOMAIN_ACCESS,
  type Domain,
} from '../middleware/domainAccess.js'
import { logger } from '../config/logger.js'

/**
 * S3 (folder whitelist): the only `folder` values accepted on
 * `POST /uploads/presigned-url`. Curated from the actual `useFileUpload`
 * call sites (certificados-empleado, certificados, nomina,
 * empleado-documentos, novedades, hojas-vida, contratos, contratos-firmados,
 * documents) plus the generic `uploads` default. Anything else → 400.
 * Adding a new folder is an intentional server-side change; clients
 * cannot invent prefixes to push objects into arbitrary paths.
 */
const ALLOWED_UPLOAD_FOLDERS: ReadonlySet<string> = new Set([
  'certificados-empleado',
  'certificados',
  'nomina',
  'empleado-documentos',
  'novedades',
  'hojas-vida',
  'contratos',
  'contratos-firmados',
  'documents',
  'uploads',
])

const DEFAULT_UPLOAD_FOLDER = 'uploads'

const presignedUrlSchema = z.object({
  contentType: z.string().min(1),
  folder: z.string().optional(),
  filename: z.string().optional(),
})

const downloadUrlQuerySchema = z.object({
  // z.string() so ZodError fires on a missing `key`; .min(1) so empty-string
  // keys (e.g. `?key=`) are also rejected. `validate()` turns the ZodError
  // into the standard 400 envelope.
  key: z.string().min(1),
})

// W12 (I1): if presigning is refused because the active STS credentials
// are expired or expiring inside the safety margin, map to a 503 with a
// stable `CREDS_EXPIRED` code and a Spanish user-facing message. The
// service throws a typed `CredentialsExpiredError` carrying `.code` and
// `.status`; any other error keeps the legacy 500 behavior.
//
// Spanish per project convention — single source of truth for the
// user-facing copy so future rotations stay consistent.
export function isCredsExpired(error: unknown): boolean {
  return (
    error instanceof CredentialsExpiredError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'CREDS_EXPIRED')
  )
}

// ---------------------------------------------------------------------------
// S2 (download-url authorization) — corrected 2026-09-17
//
// Original S2 used a `user-{userId}/` key prefix; that broke prod in two
// ways: (a) every EXISTING file (keys stored flat in DB *Url columns) would
// 403 on download, and (b) legitimate cross-user access (admin downloads an
// employee's contrato uploaded by the contratos role) was also blocked.
//
// The corrected gate authorizes by RECORD, not by key prefix:
//   1. Record-existence gate — the key MUST be referenced by at least one
//      row across the known document columns. Not found → 403 (the IDOR
//      protection; without this, a user could presign any guessed key).
//   2. Authorization gate — once we know which model owns the row, enforce
//      the caller's existing RBAC for that domain. We re-use the
//      `DOMAIN_ACCESS` matrix from `middleware/domainAccess.ts` so this
//      stays in lock-step with the rest of the app. ADMIN bypasses;
//      AUDITOR/OPERADOR fall through (per `requireDomain`); EMPLEADO goes
//      through the matrix lookup.
//
// We export the lookup + check as `assertKeyAccessible(key, req)` for
// testing. Tests inject their own request shape; production callers
// pass the Express req.
// ---------------------------------------------------------------------------

/**
 * Where a key was found and which domain the owning row lives in.
 * `empleadoId` is the owning empleado (where applicable) — `null` for
 * system-wide records (CertificadoEmpresa, ArchivoNominaPeriodo).
 */
type KeyOwner =
  | { model: 'Empleado'; empleadoId: number }
  | { model: 'EducacionEmpleado'; empleadoId: number }
  | { model: 'CertificadoEmpleado'; empleadoId: number }
  | { model: 'Contrato'; empleadoId: number }
  | { model: 'ArchivoNovedad'; empleadoId: number }
  | { model: 'ArchivoNominaPeriodo'; empleadoId: number }
  | { model: 'CertificadoEmpresa'; empleadoId: null }
  | { model: 'CertificadoUpdate'; empleadoId: null }

const MATRIX_TIPOS = ['GERONTOLOGA', 'CONTRATOS', 'PROFESORES', 'AUXILIARES'] as const
type MatrixTipo = typeof MATRIX_TIPOS[number]

/**
 * Domain that gates access to a given model. Mirrors how the existing
 * routes use `requireDomain(...)`: empleado-linked records → 'empleados',
 * certificadoEmpresa / certificadoUpdate → 'certificados',
 * archivoNominaPeriodo → 'nomina'.
 */
function domainForModel(model: KeyOwner['model']): Domain {
  switch (model) {
    case 'Empleado':
    case 'EducacionEmpleado':
    case 'CertificadoEmpleado':
    case 'Contrato':
    case 'ArchivoNovedad':
      return 'empleados'
    case 'CertificadoEmpresa':
    case 'CertificadoUpdate':
      return 'certificados'
    case 'ArchivoNominaPeriodo':
      return 'nomina'
  }
}

/**
 * Look up the S3 key across every known document column.
 *
 * Eight parallel `findFirst` queries (one per model) — each model has at
 * most two Url columns combined into a single OR. Returns the first hit
 * (there should be exactly one in a healthy schema) or `null`. We do this
 * in parallel because each is an indexed equality lookup; eight round
 * trips at ~5ms each is still under the typical request budget.
 *
 * Note: the `select` returns enough to map to a `Domain`; we don't fetch
 * full rows.
 */
export async function findRecordForKey(key: string): Promise<KeyOwner | null> {
  const prisma = getPrisma()
  const [
    empleado,
    educacion,
    certificadoEmpleado,
    contrato,
    certificadoEmpresa,
    certificadoUpdate,
    archivoNovedad,
    archivoNominaPeriodo,
  ] = await Promise.all([
    prisma.empleado.findFirst({
      where: { OR: [{ hojaVidaUrl: key }, { documentoIdentificacionUrl: key }] },
      select: { id: true },
    }),
    prisma.educacionEmpleado.findFirst({
      where: { diplomaUrl: key },
      select: { id: true, empleadoId: true },
    }),
    prisma.certificadoEmpleado.findFirst({
      where: { archivoUrl: key },
      select: { id: true, empleadoId: true },
    }),
    prisma.contrato.findFirst({
      where: { OR: [{ archivoUrl: key }, { archivoFirmadoUrl: key }] },
      select: { id: true, empleadoId: true },
    }),
    prisma.certificadoEmpresa.findFirst({
      where: { OR: [{ archivoUrl: key }, { comprobantePagoUrl: key }] },
      select: { id: true },
    }),
    prisma.certificadoUpdate.findFirst({
      where: { OR: [{ archivoUrl: key }, { comprobantePagoUrl: key }] },
      select: { id: true },
    }),
    prisma.archivoNovedad.findFirst({
      where: { url: key },
      select: { id: true, novedad: { select: { empleadoId: true } } },
    }),
    prisma.archivoNominaPeriodo.findFirst({
      where: { url: key },
      select: { id: true, nominaPeriodo: { select: { empleadoId: true } } },
    }),
  ])

  if (empleado) return { model: 'Empleado', empleadoId: empleado.id }
  if (educacion) return { model: 'EducacionEmpleado', empleadoId: educacion.empleadoId }
  if (certificadoEmpleado) return { model: 'CertificadoEmpleado', empleadoId: certificadoEmpleado.empleadoId }
  if (contrato) return { model: 'Contrato', empleadoId: contrato.empleadoId }
  if (certificadoEmpresa) return { model: 'CertificadoEmpresa', empleadoId: null }
  if (certificadoUpdate) return { model: 'CertificadoUpdate', empleadoId: null }
  if (archivoNovedad) return { model: 'ArchivoNovedad', empleadoId: archivoNovedad.novedad.empleadoId }
  if (archivoNominaPeriodo) return { model: 'ArchivoNominaPeriodo', empleadoId: archivoNominaPeriodo.nominaPeriodo.empleadoId }
  return null
}

/**
 * Shape the route hands to `assertKeyAccessible` — kept minimal so tests
 * can construct a stub without spinning up a real Express req.
 */
export interface AccessRequest {
  userId?: number
  user?: {
    rol?: string
    tipoEmpleado?: string | null
    empleadoId?: number | null
  }
}

/**
 * S2 (corrected) — `true` iff the key is referenced by a record AND the
 * caller is authorized to read that record's domain.
 *
 * Failure modes:
 *   - Key not in any record → `false` (blocks guessed/swapped keys).
 *   - Caller lacks the domain/RBAC → `false` (matrix lookup returns
 *     `false` or GET-forbidden mode).
 *   - Otherwise → `true`.
 */
export async function assertKeyAccessible(
  key: unknown,
  req: AccessRequest,
): Promise<{ ok: true; owner: KeyOwner } | { ok: false; reason: 'not-found' | 'forbidden' }> {
  if (typeof key !== 'string' || !key) return { ok: false, reason: 'not-found' }
  const owner = await findRecordForKey(key)
  if (!owner) return { ok: false, reason: 'not-found' }

  const rol = req.user?.rol
  // ADMIN bypass (matches requireDomain step 2).
  if (rol === 'ADMIN') return { ok: true, owner }

  // AUDITOR / OPERADOR — fall through per requireDomain step 3.
  // Existing app convention: these roles aren't restricted by requireDomain
  // and we keep the same behavior here so audit/operator roles still get
  // file download access they had before this fix.
  if (rol !== 'EMPLEADO') return { ok: true, owner }

  // EMPLEADO branch: apply the DOMAIN_ACCESS matrix for the row's domain.
  // For employee-scoped records we ALSO require the caller's `empleadoId`
  // to match the record's owning `empleadoId` — otherwise a GERONTOLOGA
  // could read any empleado's hoja de vida just because the matrix says
  // `empleados: true`. This is the cheapest correct policy that mirrors
  // the existing record-scoped GETs (employees see their own data; the
  // CONTRATOS / GERONTOLOGA sub-roles see the data their domain grants,
  // but the row still has to belong to an empleado they cover).
  const domain = domainForModel(owner.model)
  const tipoEmpleado = (req.user?.tipoEmpleado ?? null) as string | null
  const access = tipoEmpleado && (MATRIX_TIPOS as readonly string[]).includes(tipoEmpleado)
    ? DOMAIN_ACCESS[tipoEmpleado as MatrixTipo][domain]
    : true // legacy zero-regression for unknown / null tipoEmpleado

  // 'create-only' includes GET; 'read-only' is GET; `true` is everything.
  if (access === false) return { ok: false, reason: 'forbidden' }
  if (access === 'create-only' || access === 'read-only' || access === true) {
    // GET is always allowed for these modes.
  }

  // Ownership gate: an EMPLEADO can only download records for their own
  // empleadoId. ADMIN bypassed above; AUDITOR/OPERADOR fall through.
  if (owner.empleadoId !== null) {
    const callerEmpleadoId = req.user?.empleadoId ?? null
    if (callerEmpleadoId === null || callerEmpleadoId !== owner.empleadoId) {
      return { ok: false, reason: 'forbidden' }
    }
  }
  // For system records (empleadoId === null) the matrix already gated
  // access; matrix returns false → forbidden above, otherwise ok.
  return { ok: true, owner }
}

/**
 * Build the upload routes router. Accepts an auth middleware so the
 * router is unit-testable with a stub auth (bypassing DB lookups).
 * Production usage in `routes/index.ts` passes the real `authMiddleware()`.
 */
export function createUploadRoutes(authMw: RequestHandler = authMiddleware()): Router {
  const router = Router()
  router.use(authMw)

  // POST /uploads/presigned-url
  router.post('/presigned-url', validate(presignedUrlSchema), async (req: Request, res: Response): Promise<void> => {
    try {
      const { contentType, folder } = req.body as z.infer<typeof presignedUrlSchema>
      // S3: server picks the folder from the whitelist. The client
      // requests a folder name; we either accept it or 400. There is no
      // way for the client to inject a different prefix into the final key.
      const requestedFolder = folder ?? DEFAULT_UPLOAD_FOLDER
      if (!ALLOWED_UPLOAD_FOLDERS.has(requestedFolder)) {
        res.status(400).json({
          success: false,
          message: `folder no permitido: ${requestedFolder}`,
          field: 'folder',
        })
        return
      }
      const ext = contentType.split('/')[1] || 'bin'
      // S2 (corrected): keys stay FLAT — `{folder}/{uuid}.{ext}`. The
      // pre-fix `user-{id}/` prefix broke prod (existing flat keys in DB
      // *Url columns + legitimate cross-user access). Authorization now
      // lives on download-url via `assertKeyAccessible` (record lookup).
      const key = `${requestedFolder}/${crypto.randomUUID()}.${ext}`
      const presigned = await generateUploadUrl(key, contentType)
      // S4: return both the POST URL and the policy `fields` the browser
      // must submit alongside the file. `uploadUrl` is kept as the URL
      // alias so older clients reading the URL by that name keep working.
      res.json({
        success: true,
        data: {
          uploadUrl: presigned.url,
          url: presigned.url,
          fields: presigned.fields,
          key,
        },
      })
    } catch (error) {
      if (isCredsExpired(error)) {
        logger.error('Presign denied: AWS credentials expired (CREDS_EXPIRED):', error)
        res.status(503).json({
          success: false,
          message: 'Servicio de archivos temporalmente no disponible',
          code: 'CREDS_EXPIRED',
        })
        return
      }
      logger.error('Generate presigned URL error:', error)
      res.status(500).json({ success: false, message: 'Error generating upload URL' })
    }
  })

  // GET /uploads/download-url?key=...
  // S2 (corrected): validate the query (require non-empty `key`) and
  // authorize by `assertKeyAccessible` — record-existence gate + RBAC.
  router.get('/download-url', validate(downloadUrlQuerySchema, 'query'), async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.query as unknown as z.infer<typeof downloadUrlQuerySchema>
      const access = await assertKeyAccessible(key, req as AccessRequest)
      if (!access.ok) {
        logger.warn(
          `download-url denied: userId=${(req as Request & { userId?: number }).userId} key=${key} reason=${access.reason}`,
        )
        res.status(403).json({
          success: false,
          message: 'No tiene permisos para descargar este archivo',
        })
        return
      }
      const downloadUrl = await generateDownloadUrl(key)
      res.json({ success: true, data: { downloadUrl } })
    } catch (error) {
      if (isCredsExpired(error)) {
        logger.error('Presign denied: AWS credentials expired (CREDS_EXPIRED):', error)
        res.status(503).json({
          success: false,
          message: 'Servicio de archivos temporalmente no disponible',
          code: 'CREDS_EXPIRED',
        })
        return
      }
      logger.error('Generate download URL error:', error)
      res.status(500).json({ success: false, message: 'Error generating download URL' })
    }
  })

  return router
}

// Default instance — used by `routes/index.ts` in production.
const router = createUploadRoutes()

export { router as uploadRoutes }