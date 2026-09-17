# QA sep-2 proof report (2026-09-02)

**Local stack**: backend :3101, frontend :3100, QA seed users.  
**Specs**: `backend/tests/qa-sep-2/qa-sep-2-proof.spec.ts` **5/5**. `frontend/tests/qa-sep-2/qa-sep-2-proof.spec.ts` **6/6**.  
**Iteration**: none. No failures.

## Staging instruments (DB)

Read-only `instrumentos_versiones`. **No write.** Every catalog codigo already has the highest template `activo=true`:

| codigo | active | highest template |
|---|---|---|
| BARTHEL | 1 | 1 |
| BOLETIN_ANUAL | 2 | 2 |
| FICHA_NUTRICIONAL | 1 | 1 |
| MINI_MENTAL | 1 | 1 |
| MNA_CUADRO | 2 | 2 |
| SIGNOS_VITALES | 2 | 2 |
| TINETTI | 5 | 5 |
| VALORACION_INTEGRAL | **2** | 2 |
| YESAVAGE | 1 | 1 |

API `GET /instruments/{codigo}/definition` matches. VALORACION v1 still exists with 2 old fichas (pinned). New fills use v2.

## F1 certificados (Eli create, lock after)

| Check | Result |
|---|---|
| GERONTOLOGA POST `/certificates` | 201 |
| GERONTOLOGA PUT/DELETE | 403 DOMAIN_FORBIDDEN |
| CONTRATOS POST | 403 |
| SPA: Eli sees `cert-nuevo` | pass |
| SPA: Carolina no `cert-nuevo` | pass |
| SPA: ADMIN still sees create | pass |

## F2 Valoración integral PII

Active v2. `datos_generales` = `fecha_ingreso`, `rhgs`, `observacion_ingreso`. Banned ids absent.

## F3 typed valorUnitario

CONTRATOS POST mensualidades `250000.00` stored (not centro default). SPA: InputNumber visible, no read-only price.

## F4 Valoraciones same form

`ocultarBeneficiario=false`. Missing beneficiario → 400. With patient → 201. SPA: fecha, pagador, beneficiario, valor unitario, medio, notas.

## F5 letterhead

ADMIN PUT nombre → `EN CASA`. CONTRATOS GET `/empresa` same. Recibo page shows that `nombre`. Local test restored original empresa nombre in afterAll.

## Staging already live (prior deploy)

CodeDeploy `d-3IBR2MMHL`, Amplify job 22, empresa **EN CASA**.
