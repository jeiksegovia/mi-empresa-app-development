# W4 (pt-backend-eng) — Aug-17 centro-costos progress

## T9 — schema + seed + contract  ⚠️ GATED (G4)

### Counts (verbatim from DB, 2026-08-18)

```
   tipo   |         nombre          | orden | centro_id
----------+-------------------------+-------+-----------
 INGRESOS | Mensualidades completas |     1 |        17
 INGRESOS | Mensualidades por día   |     2 |        18
 INGRESOS | Transporte              |     3 |        19
 INGRESOS | Ingresos adicionales    |     4 |        20
 INGRESOS | Valoraciones            |     5 |        21
 EGRESOS  | Refrigerios             |     6 |        22
 EGRESOS  | Aseo                    |     7 |        23
 EGRESOS  | Papelería               |     8 |        24
 EGRESOS  | Eventos                 |     9 |        25
 EGRESOS  | Nómina                  |    10 |        26
 EGRESOS  | Mantenimiento           |    11 |        27
(11 rows)

 items
-------
    10
(1 row)
```

### Plan status

- [x] Counts captured
- [ ] Schema edited
- [ ] `npx prisma validate` + `npx prisma generate`
- [ ] `migrate dev --create-only`
- [ ] **G4 — proposed-plan.md + PLAN-APPROVAL** (sent, WAIT)
- [ ] After APPROVED → migrate deploy + data-fix + DEFAULT_CENTROS_COSTOS update
- [ ] Contract updated in place
