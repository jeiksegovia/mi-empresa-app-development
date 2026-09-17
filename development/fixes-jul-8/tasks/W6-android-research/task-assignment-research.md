# task-assignment-android-research

## Plan File
`development/fixes-jul-8/orchestration-ctx/team-plan-fixes-jul-8.md`

## Task Type
RESEARCH

## Your Task
Deep-analyze the following reported behavior and propose a code-level fix:

> **User report (verbatim)**: "when user tries to Actualizar Estado and selecting a file, android browser goes to the background when user pick the file and browser comeback the page reloads, developer wants a deep analysis over this issue since it could interrupt user experience so research about this nuxt behavior, identify the hook or nuxt app cycle that is triggered and use step by step thinking to understand why is happening then a fix proposal."

W3 already applied sessionStorage form persistence on the ficha dialog, so **the draft survives**, but the user says **the page itself still reloads** — meaning the perceived page reload is real, not just state loss. The user wants root-cause identification (the specific Nuxt/browser mechanism) + a step-by-step reasoning trail + a concrete fix proposal.

## Task ID
Your task ID is `25`. Call `TaskUpdate(taskId: "25", status: "in_progress")` on start.

## Scope

You must produce a research document that answers ALL of these questions with evidence + citations:

1. **What is technically happening when Android Chrome backgrounds a tab (during file picker)?**
   - The lifecycle events fired: `pagehide` / `visibilitychange` / `freeze` / `resume` / `pageshow`
   - Which of these Android Chrome fires and in what order
   - When the tab is **discarded** vs **frozen** vs **cached** — the memory reclamation modes
   - What triggers reload on resume: BFCache (BackForward Cache) miss? Discarded tab? Something else?

2. **How does the Nuxt 4 SPA lifecycle interact with this?**
   - `ssr: false` mode — pure client-render — what happens when the SPA re-mounts?
   - Which Nuxt hooks fire in what order when the tab is restored: `app:mounted`, `app:created`, `app:beforeMount`, plugin execution, middleware, route load
   - Does `<NuxtPage>` / `<NuxtLayout>` re-mount or is state preserved?
   - Auth middleware `frontend/app/middleware/auth.ts` — does it fetch user again on re-mount?
   - Do stores (`stores/auth.ts` Pinia) survive tab restore or reset?
   - **Is there a Nuxt-specific behavior that causes a full re-hydration on tab restore that we could disable or intercept?**

3. **Root cause identification**:
   - Confirm whether the "reload" is a **full page reload** (URL fetches HTML again + hydrates) OR just an **SPA re-mount** (JS still running but Vue tree recreated)
   - Cite specific spec/reference: Chrome BFCache eligibility rules for file inputs, W3C page lifecycle spec, Nuxt 4 client entry code
   - If it's BFCache-related: which pattern in our code is blocking BFCache eligibility? Common blockers: WebSocket, IndexedDB open, `beforeunload` handler, `unload` handler, cross-origin iframes.

4. **Fix proposal** (must be code-level, not "user education"):
   - Best-case: keep the tab BFCache-eligible so no reload happens
   - Fallback: sessionStorage persistence PLUS restoring the file (if possible via IndexedDB File API since File objects can't go in sessionStorage but can go in IndexedDB)
   - Alternative: use Web File System Access API for file staging (Android Chrome support?)
   - Consider: preventing `beforeunload` handlers, removing `visibilitychange` listeners, using PWA `install: false` (already), disabling any experimental Nuxt flag that opts out of BFCache
   - Provide specific code changes for the fix: file paths, before/after diffs (as plain text — do NOT modify code in this task)

## Implementation Location (research output only)
- Research report: `development/fixes-jul-8/tasks/W6-android-research/result.md`
- Fix proposal document: `development/fixes-jul-8/tasks/W6-android-research/fix-proposal.md`

## Recommended Approach

1. **Read the current SPA setup**:
   - `frontend/nuxt.config.ts`
   - `frontend/app/app.vue`
   - `frontend/app/plugins/*.ts`
   - `frontend/app/middleware/auth.ts`
   - `frontend/app/composables/useApi.ts`, `useFileUpload.ts`
   - `frontend/app/stores/auth.ts`
   - `frontend/app/pages/pacientes/[id]/index.vue` — the specific ficha dialog + `<input type="file">` used
   - Any listener registered on `pagehide`, `pageshow`, `visibilitychange`, `beforeunload`, `unload`, `freeze`, `resume`
2. **External research** (use `mcp__google-search__search` + `mcp__google-search__read_webpage` sub-agents):
   - "Android Chrome BFCache file input" — Chrome dev site + web.dev spec
   - "Nuxt 4 client re-hydration tab restore" — Nuxt 3/4 docs + issues
   - "Vue SPA visibilitychange reload workaround"
   - "IndexedDB File object persistence Android"
   - Reference: https://web.dev/articles/bfcache, https://developer.chrome.com/docs/web-platform/page-lifecycle-api, https://nuxt.com/docs/api/composables/use-nuxt-app
3. **Cross-check**:
   - Does the user's frontend/nuxt.config.ts have `experimental.emitRouteChunkError` or `experimental.viewTransition` or similar that could force re-mount?
   - Any `@vueuse/core` `useDocumentVisibility` used anywhere (W1 said no — verify again in the fresh code)
   - Auth store: does `authStore.fetchUser()` get called on app:mounted every time?
4. **Reason step-by-step through the reload trigger**:
   - Step A: user taps file input → Android system file picker opens → Chrome tab goes to background
   - Step B: `pagehide` fires with `persisted: true` (BFCache eligible?) or `persisted: false` (evicted)
   - Step C: user picks file → returns to Chrome tab
   - Step D: `pageshow` fires OR full page reload
   - Which branch actually happens on Android Chrome for THIS site's tab? Explain why with evidence.

## Deliverables
1. `development/fixes-jul-8/tasks/W6-android-research/result.md` — full research including:
   - §1 Web page lifecycle background
   - §2 Android Chrome specifics
   - §3 Nuxt 4 SPA re-hydration mechanics
   - §4 Root cause with specific step-by-step reasoning trail
   - §5 Evidence citations (URLs + code line refs)
2. `development/fixes-jul-8/tasks/W6-android-research/fix-proposal.md` — concrete file-by-file diff proposal:
   - Which files to change
   - Exact changes (before/after)
   - Priority order
   - Risk assessment for each change
   - Confidence level (HIGH/MED/LOW) that the fix will actually stop the reload
3. `development/fixes-jul-8/tasks/W6-android-research/completion-report.md` — summary + hand-off notes to W7

## Progress Reporting
`development/fixes-jul-8/tasks/W6-android-research/progress-report.md`

## Acceptance Criteria
1. Root cause named specifically (e.g., "BFCache miss because of X" OR "SPA re-mount triggered by Nuxt hook Y")
2. Step-by-step reasoning traceable — reader can verify each step from evidence
3. At least 2 fix options proposed (best-case + fallback)
4. Each fix option has confidence level + code-level detail (file paths, exact edits)
5. Report is ≤ 500 lines (be tight)

## Constraints
- **Read-only research** — do NOT modify source code
- Do NOT git-commit
- Cite web sources by URL when using external research (Chrome docs, Nuxt docs, MDN, W3C specs)
- Use web-search sub-agents for external research per project CLAUDE.md pattern
- The proposed fix must be code-level and testable — no "user should not background the tab"

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "25", status: "in_progress")`
2. **Progress**: append sections to progress-report.md as each phase completes (read code / external search / cross-check / reasoning / draft fixes)
3. **On completion**:
   - Write result.md + fix-proposal.md + completion-report.md
   - `TaskUpdate(taskId: "25", status: "completed")`
   - `SendMessage(to: "main", message: "COMPLETE: Android research done. Root cause: {one-liner}. See tasks/W6-android-research/result.md + fix-proposal.md", summary: "Android research complete")`
4. After COMPLETE: ignore further messages unless NEW-ASSIGNMENT or NEW-APPROACH

## Tools Available
Read, Write, Bash (curl/grep). Web search + read_webpage via `mcp__google-search__*`. `TaskUpdate` and `SendMessage` are native.
