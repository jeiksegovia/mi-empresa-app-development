# aug-31 — CONTRATOS print / recibo (revisited)

## Intended logic (do not ungate)

Print / Recibo is **only** for INGRESOS centros with `habilitarRecibo=true`.
Same UI for ADMIN and CONTRATOS. No role `v-if` on the print button.

`habilitarRecibo` is ADMIN centro config. CONTRATOS cannot PUT centros.

## Did the previous ungate damage ADMIN?

Yes, locally (uncommitted). It changed:

```
v-if="INGRESOS && habilitarRecibo"  →  v-if="INGRESOS"
```

That would show print on centros that did **not** enable recibos. ADMIN's existing gate would have been broken. Reverted.

HEAD `fa30faa` already has the correct button + GET `/empresa` public subset for letterhead.

## Role visibility

| Role | List print | Recibo page | GET item | GET /empresa | Toggle flag |
|---|---|---|---|---|---|
| ADMIN | if `habilitarRecibo` | yes | 200 | 200 full | yes |
| CONTRATOS | if `habilitarRecibo` (same v-if) | yes (`can('centro-costos')`) | 200 (month lock only if F4 ON) | 200 public | no (403 PUT centro) |

If ADMIN sees print on a centro and CONTRATOS does not, it is not a role `v-if`. Check staging flag + whether `fa30faa` is deployed.

## Staging

Check INGRESOS `habilitarRecibo` and CONTRATOS GET `/empresa` + GET `/items/:id`.
If all flags are false, that is configuration, not RBAC.
