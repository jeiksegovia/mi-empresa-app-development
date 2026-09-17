# sep-11 cert attach + patient email — implemented

**Date**: 2026-09-11
**HEAD**: `36f27f2` (API/matrix) · FE later `68b534b`
**Staging**: CodeDeploy `d-OCR24VENL` · Amplify `d1nsxjyualdzdu` job 31
**Prod**: CodeDeploy `d-6TMYLEHNL` group `miempresa-prod` · Amplify `dodgibcmo1870` job 2

## High-level

Closed two prod holes from 2026-09-11 logs:

1. GERONTOLOGA created certificates empty: POST `/certificates` 201 then POST `/:id/updates` 403 (`requireRole('ADMIN')`). Matrix was already create-only; leftover ADMIN gate on updates.
2. CONTRATOS could not save pacientes: POST `/patients` 400 Zod `email` on leftover `"correo"` / blank (not DOMAIN_FORBIDDEN).

## Key decisions

- Keep POST `/updates` on create (do not invent a new attach path). Drop ADMIN on POST only; PUT/DELETE stay ADMIN. CONTRATOS remains 403.
- Email coerce: trim, blank/no-@ omitted; valid emails still `.email()`.
- FE: child-owned `draft` + `getValue()` because `v-model` on `const reactive()` dropped child emits (staging SPA skipped `/updates` even with visible notas).
- Staging first, then prod after explicit yes. Profile `disruptive`. Zip excludes `generated/` and `prisma/prod-db/`. Group `miempresa-prod` only (Environment=prod tag).

## Issues resolved while implementing

- Staging UI false negative until `waitForResponse` on POST `/certificates/:id/updates`.
- Vite overlay from leftover `</invoke>` XML in vue files; stripped.
- Prod GET `/certificates/:id` does not embed updates; list is GET `/:id/updates` (smoke id=1 on cert 3).
- Historical prod CD `d-85ZG7B1NL` HEALTH_CONSTRAINTS from OR tag filter; current group is Environment=prod only. Rollback id `d-EYN1OE0NL`.

## Smoke (prod founders, CloudFront)

gerontologa@ POST cert **201** id=3, POST updates **201** id=1, PUT **403**. contratos@ POST cert/updates **403**, POST patients email=`correo` **201** email omitted then ADMIN DELETE 200. Staging health still 200.

## Grep

```
sep-11 geronto-updates patient-email DOMAIN_FORBIDDEN correo
d-6TMYLEHNL d-OCR24VENL 36f27f2 68b534b
```
