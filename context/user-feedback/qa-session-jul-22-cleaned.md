# QA Session Jul 22 — Cleaned insights

Source: `qa-session-jul-22-raw.md` (voice transcript + note; filler removed).

## Insights (deduped)

### I1 — Patient estado vs CONTRATOS (clarified 2026-07-22)
- On **patient create only**, **Activo/Inactivo must NOT appear** for role EMPLEADO+CONTRATOS.
- After valuation, only **EMPLEADO+GERONTOLOGA** (and **ADMIN**) may set Activo/Inactivo via **edit patient** view.
- CONTRATOS remains create-only on pacientes domain (existing RBAC) — they never own estado on edit.

### I2 — Unsaved form guard (PWA / navigation)
- Before leaving a page (route change or browser/PWA close) while filling a form, show a **confirm dialog** so data is not lost.
- Applies broadly to forms (patients, instruments, etc.).

### I3 — Mini nutricional / Cuadro de alimentos — frequency matrix
- Section **frecuencia de consumo por grupo de alimentos** (MNA_CUADRO `cuadro_alimentos` / `frecuencia_grupos`).
- Today: `group-info` matrix with columns Diario/Semanal/Mensual/Nunca (select-style cells).
- Desired: **plain text fields** per food-group row for daily / weekly / monthly (and never if kept) — informative free text, not dropdowns. Result = matrix of food groups × text cells.

### I4 — Tinetti item 8 (360° turn)
- Metadata currently split **8a** (`eq_vuelta_360_pasos`) and **8b** (`eq_vuelta_360_estabilidad`), 2 options each.
- Desired: **single item 8** — "Vuelta a 360°" with **four options** (single select, not multi):
  1. Pasos discontinuos  
  2. Continuos  
  3. Inestable  
  4. Estable  
- Score scale must match table (needs product confirmation for points).

### I5 — Tinetti item 11 (step)
- Currently split **11a/11b** for pie derecho (`ma_pd_sobrepasa`, `ma_pd_separa`) and similarly pie izquierdo (`ma_pi_*`), 2 options each.
- Desired: **remove a/b subdivision**; each foot (or single Q11) is **one item with four options**, single selection. Clarification needed: one global Q11 vs pie derecho + pie izquierdo each with 4 options.

### I6 — Instrumento valoración integral (IN SCOPE)
- Create instrument + JSON from `FORMATOS DE INGRESO.xlsx` sheet **VALORACIÓN INTEGRAL** (first tab only).
