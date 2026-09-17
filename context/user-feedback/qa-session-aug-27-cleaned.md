# QA session 2026-08-27 — cleaned features (mi-empresa-app only)

**Source**: `raw feedback aug 27.md` (Google Meet captions) → `qa-session-aug-27-raw-extracted.md`  
**Speakers**: Developer (Jake) + Paola (ADMIN / product owner)  
**Roles in the product**: ADMIN = Paola · CONTRATOS = Carolina · GERONTOLOGA = Liliana/Eliana · PROFESORES = new, not specified here

**Filtered out (not product)**: Rafa / Grok / AI models · bathroom / child · login copy-paste glitch · remote support scheduling · “borrar data mañana” as a *deploy ops* ask (listed separately as ops, not a feature)

**Approved as-is (no change)**: certificados UI look · employee lock/unlock by ADMIN works · hoja de vida upload visible for CONTRATOS (they found it) · patient notes · empleados list defaults to Activos · ADMIN can create centros de costos

---

## F1 — Certificados: CONTRATOS + GERONTOLOGA = read / print / download only

**Module**: Certificados empresa (and employee certs if the same matrix applies)  
**Status**: Behavior was being *validated*, not invented. Paola **approved** the UI; the remaining work is **corroborate permissions**.

**Logic**
- **Create / edit / delete (“manipular”)** = ADMIN only (Paola). Updates are rare (~yearly).
- **CONTRATOS and GERONTOLOGA**: view, print, download. No create, no edit.
- Eliana (GERONTOLOGA) needs download to attach certs to audit/report packets.
- Earlier line “esto iba a estar a cargo de Liliana” was **overruled**: create stays with Paola; Liliana *accesses*.

**Insight**: Split “access” vs “create” is the whole point. If CONTRATOS currently has `certificados: true` (full write) in `DOMAIN_ACCESS`, that is **too open** vs this decision.

---

## F2 — CONTRATOS must create/update contrato laboral (when employee is unlocked)

**Module**: Empleados → tab Contrato laboral  
**Status**: **Bug / RBAC hole found live.** Paola could not add a contract as Carolina. “Ella lo tiene que [cargar].” “Sí debe permitirle crear actualizar todo del contrato laboral. Cuando esté desbloqueado.”

**Logic**
- Carolina **enters** employees (personal data already works when unlocked — they edited cédula and saved).
- She must also **create and update** labor contracts (upload included) while the employee is **unlocked**.
- ADMIN is the only one who **locks**. Lock already works.
- Current code: contratos API is ADMIN-only (ago-5 lock notes said guarding contratos was redundant because the route was `requireRole('ADMIN')`). That no longer matches the product.

**Insight**: Unlock is the gate for CONTRATOS write, not “never write contracts.” Hoja de vida was OK; contract tab is the gap.

---

## F3 — CONTRATOS cargos: create + read, no delete

**Module**: Empresa cargos (used from contratos / empleados)  
**Status**: Explicit decision after a short debate.

**Logic**
- Jake: can she create cargos? Paola: **sí**.
- Jake: then also edit and delete? Paola: **No borrar, no.**
- Final: **leer y crear**. Delete stays ADMIN so Carolina must ask Paola to remove a cargo.
- Edit was in Jake’s first proposal; after “no borrar” they locked **solo leer y crear**. Treat **edit as ADMIN-only** unless you reopen it.

**Insight**: Orphan cargos are harmless; only cargos *on a contract* are legally meaningful. Create-only is enough for tomorrow’s data load.

---

## F4 — Centro de costos: CONTRATOS date window + ADMIN override

**Module**: Centro de costos ítems  
**Status**: **Highest-priority product rule** in the second half. Paola: “otra cosa importantísima.”

**Problem she described**
Carolina reports two payments today, then on 20 Aug books another payment **as if it were the 1st**. That must be impossible in normal operation.

**Default rule (CONTRATOS)**
- Can **create** ítems.
- Cannot **delete** (Jake: same pattern as other roles — “pueden crear. No pueden borrar”).
- **Fecha on Añadir ítem** cannot be an arbitrary past date.
- Allowed: **today** and **previous business day** (`día hábil anterior`).
- Weekend / holiday: Monday after a Friday holiday → Friday is allowed.
- Cannot invent “ingresó el primero” when today is the 20th.

**ADMIN toggle (required before tomorrow’s July/August backfill)**
Paola: do **not** turn the restriction on yet — tomorrow they will load **julio y agosto**.

Jake’s design, Paola agreed:
- Option A: limit CONTRATOS to **día hábil anterior**
- Option B: **sin limitación** (backfill)
- ADMIN switches this like a lock: “lo desbloquea o lo bloquea”

**Insight**: This is **not** the current D14 “whole current Bogotá month” rule. It is **tighter** (business-day window) **plus** an ADMIN override so historical load is possible. Implement the toggle first if they load July/August tomorrow; then flip to business-day lock.

Also confirmed: **ADMIN can create centros**; CONTRATOS cannot (already shipped).

---

## F5 — Auto-lock what CONTRATOS creates (ambiguous)

**Module**: Empleados lock  
**Quote**: “Aquí quiero que nos vaya bloqueando, o sea, lo que ella va creando, se vaya bloqueando.” Jake: “en el rol de contratos.” Paola then: “Que no. Sí que ya no.” — conversation jumped to centro de costos.

**Insight**: Possible intent = after Carolina finishes an employee, auto-lock so she cannot keep editing. **Not settled.** Do not implement without a yes.

---

## F6 — Employee create form: drop “todo eso” in datos personales

**Module**: Empleados / nuevo  
**Quote**: Jake mentions the step-by-step create format in datos personales. Paola: **“Ya no quiero todo eso.”** Then they moved on. No field list.

**Insight**: UX slimming, unspecified. Needs a field-by-field pass before a ticket.

---

## F7 — Review GERONTOLOGA + PROFESORES (not specified)

Jake: still need Eliana’s module and the **new profesores** role. No rules in this dump. Notes were “perfecta.” Parking lot.

---

## Ops (not a product feature)

Paola asked to **wipe** employee (and related) data so tomorrow they load real people. Developer wanted **fixes first**. Not a schema/feature; a staging reset when you say so.

---

## Suggested implementation order (if you do not pick)

1. **F2** — unblocks Carolina loading contracts tomorrow  
2. **F4 toggle** — unblocks July/August caja load, then tighten dates  
3. **F3** — cargos create for CONTRATOS  
4. **F1** — tighten certificados matrix if it is still full-write  
5. F6 / F5 / F7 only after a clarifying pass
