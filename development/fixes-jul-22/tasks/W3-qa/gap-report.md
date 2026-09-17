# W3 QA Gap Report — fixes-jul-22

## Product gaps

No confirmed product bugs were found in the tested Jul-22 scope.

## Coverage deepened

- Patient `estado` authorization is enforced by validated-field presence even when the requested value equals the current state; the exact 403 envelope is asserted and the entire mixed update is proven atomic/no-write.
- MNA `cellInput: text` rejects unknown row and column coordinates with the contract error code and field.

## Remaining non-blocking coverage gaps

- Upgrade-script `VERSION_LOCKED` destructive/mutation scenarios were not exercised because they require purpose-built database fixtures and script subprocess isolation; seed activation/highest-version behavior is covered.
- Frontend suites use mocked API sessions. Backend suites independently verify real RBAC and persistence, but no single browser test spans the live frontend and backend together.
- No numeric line/branch coverage percentage is available because this repository's Playwright configuration has no instrumentation provider configured. Behavioral acceptance coverage is reported instead.

## Failure classification

- **BUG:** 0
- **TEST-ENV:** 3 operator/CWD invocation errors, all corrected; none were test-case failures.
- **FLAKE:** 0 observed across authoritative runs.
