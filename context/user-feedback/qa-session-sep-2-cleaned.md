# QA session 2026-09-02 — cleaned features (mi-empresa-app)

**Source**: `qa-centro-costos-feedback-sep-2-raw.md` → `qa-session-sep-2-raw-extracted.md`  
**Speakers**: Jake (developer) + Paola (ADMIN / product)  
**Roles**: ADMIN = Paola · CONTRATOS = Carolina · GERONTOLOGA = Eli / Eliana

**Filtered out**: lunch/meeting scheduling, "prendan el asistente", search-by-patient-name confusion (Jake explained, they found the path).

**Deferred by Paola (not this drop)**: recibo visual header redesign ("el encabezado ya ese sí ahorita lo hacemos"). F5 still ships the **empresa nombre** used as letterhead so the ticket can say "En Casa".

---

## F1 — GERONTOLOGA certificados empresa: create / upload, then lock

**Module**: Certificados empresa  
**Status**: Live bug vs product. Aug-27 F1 set GERONTOLOGA to **read-only**. Paola now: Eli **must load** documents; she must **not edit** after create.

**Logic**
- GERONTOLOGA: **Añadir documento** (POST / create + file upload). Once created, lock. No PUT/PATCH/DELETE.
- ADMIN: still full write (unlock / edit).
- CONTRATOS: stays read-only (aug-27 F1, not reopened here).
- Jake restated: create (e.g. 2027 cert) yes; "modificarlos" no. Paola: "se genera candado."

**FE**: `frontend/app/pages/certificados/index.vue`, `certificados/crear.vue` — hide write CTAs when `isReadOnly('certificados')`. Need create-only: show Añadir, hide edit/delete.  
**BE**: `DOMAIN_ACCESS.GERONTOLOGA.certificados` today `'read-only'` in `backend/src/middleware/domainAccess.ts` + FE `useDomainAccess.ts`. Flip to `'create-only'`. Routes already use `requireDomain('certificados')`. Upload/create endpoints must allow POST for GERONTOLOGA.

**Insight**: create-only ≠ full write. Do not give GERONTOLOGA PUT.

---

## F2 — Valoración integral: drop repeated patient PII (cédula … sexo)

**Module**: Pacientes → Fichas y evaluaciones → Valoración integral (dynamic instrument)  
**Status**: Regression. Eli: those fields were already removed; they are back on staging.

**Logic**
- Patient already has tipo/número documento, sexo, etc. on the patient profile.
- Instrument version on staging still renders **cédula through sexo**. Keep **fecha de ingreso onward**.
- Jake: likely old instrument version after a backup. Ship / activate the version that does **not** repeat personal data.

**FE**: `frontend/app/pages/pacientes/[id]/index.vue` ficha dialog + instrument renderer (fields come from API definition, not hardcoded).  
**BE**: instrument definition / active version (`instrumentos` + `instrument_versions` / seed). Confirm staging active version of "Valoración integral" vs local latest. May be data-only (activate newer version) plus a test that those field keys are absent.

---

## F3 — CONTRATOS types `valorUnitario` on every ítem (ingresos + egresos)

**Module**: Centro de costos ítem dialog  
**Status**: Highest operational change this session. Paola approved Jake's restatement.

**Problem**
Carolina enrolls a client on the 15th. Default "mensualidad completa" / transporte price is the full-month tarifa. They cut at day 30, so amounts are 300.000 / 250.000 / etc. Default price is wrong.

**Logic (Jake + Paola, turn 031–033)**
- Remove **precio unitario por defecto** on the INGRESOS **centro** as the source copied into ítems.
- Each ítem (INGRESOS and EGRESOS): `valorUnitario` is a **required numeric field**, empty on create, typed every time. No pre-fill from `centro.precioUnitario`.
- EGRESOS already typed; INGRESOS today is read-only from centro (aug-17 R26). Change that.
- ADMIN centro dialog: drop or ignore `precioUnitario` as the ítem default (can keep column nullable for history).

**FE**: `frontend/app/pages/centro-costos/index.vue` — INGRESOS dialog: InputNumber for valor unitario (same as EGRESOS). Stop blocking save on missing centro precio. CONTRATOS must see the field (already can open Añadir ítem).  
**BE**: `POST/PUT /centro-costos/:id/items` in `centroCostosService.createItem` / `updateItem`: INGRESOS must **use client `valorUnitario`**, 400 if missing/≤0. Stop copying `centro.precioUnitario`. Stop 400 `field=precioUnitario` when centro has no price.

**Insight**: mid-month enrollments make a centro-level default a lie. Price lives on the ítem.

---

## F4 — Valoraciones ítem form = same fields as mensualidad

**Module**: Centro de costos → Valoraciones (INGRESOS) add-ítem dialog  
**Status**: Overrides aug-28 `ocultarBeneficiario` default for Valoraciones.

**Logic**
Mensualidad form: fecha, pagador, **beneficiario**, concepto (centro name), detalle (ítem nombre), cantidad, valor unitario, total, medio de pago, notas.  
Valoraciones today (flag on): only pagador (beneficiario hidden). Paola: **same format**. Beneficiario required again.

**FE**: item dialog already has those fields when `!ocultarBeneficiario`. Turn the flag **off** for Valoraciones (seed + staging UPDATE). ADMIN checkbox remains.  
**BE**: `createItem` required `beneficiarioClienteId` when `ocultarBeneficiario=false`. Seed `applyValoracionesOcultarBeneficiario` currently forces **true** — invert to false / stop forcing.

**Insight**: hide-beneficiario was a Valoraciones shortcut; product wants one ingreso form.

---

## F5 — Recibo letterhead = "En Casa" (empresa nombre)

**Module**: Recibo de caja (`/centro-costos/recibo/:itemId`)  
**Status**: Config + verify. Paola cannot find ADMIN empresa edit. Header redesign deferred.

**Logic**
Recibo reads `GET /empresa` `nombre` / `nit` / `direccion`. Staging today: "Mi Empresa S.A.S." Ticket should say **En Casa**. ADMIN PUT `/empresa/:id` `{ nombre: "EN CASA", … }` (nombre is uppercased). Confirm CONTRATOS public GET returns the new nombre. If UI still shows old string, bug in recibo page (cache / wrong field).

**FE**: `frontend/app/pages/centro-costos/recibo/[itemId].vue` (`recibo-empresa`). Empresa edit: `frontend/app/pages/empresa/editar.vue`.  
**BE**: `GET /empresa` (public subset for non-ADMIN), `PUT /empresa/:id` ADMIN.

---

## Not this session

Recibo layout/header redesign. Prod. Changing CONTRATOS certificados. Restoring centro-level default prices.
