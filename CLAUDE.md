# Global Instructions
## Language & Communication Rules
- Always think and reason in **English**, even if the final output is in Spanish or UI/UX elements are in Spanish.
- Respect UI/UX language: the interface is in Spanish, but use English for programming logic, class names, internal communication, and reasoning.
## Agent & Sub-Agent Output Rules
- **ALWAYS** keep output per agent/sub-agent under **127,000 tokens**.
- Break down large tasks into 2–3 sequential sub-agents, then consolidate. Example:
    - `Task: Initialize backend Express project`
        - `Task 1: Initialize backend Express project — Phase A: folder structure & package.json`
        - `Task 2: Initialize backend Express project — Phase B: middleware & routes setup`
        - `Task 3: Initialize backend Express project — Phase C: consolidate & validate`
## Task Reporting
- **Mandatory**: Report task completion progress in `context/implementation-plan/{task-name-or-id}.md`, including:
    - Task definition
    - Plan
    - Output summary

## Testing Rules
- Use **Playwright** and **Bash scripts** as the primary testing artifacts.
- Write every test in its corresponding directory:
    - Backend: `backend/tests/{test-set}/**` — bash or Playwright `*.spec.ts`
    - Frontend: `frontend/tests/{test-set}/**` — bash or Playwright `*.spec.ts`
- Only use Bash scripts when testing infrastructure-level artifacts (Docker, build commands, network setup, setup scripts, etc.).
- **NEVER skip writing tests** after each task completion or implementation.

# Plan completion Rules
- **Mandatory**: After entire plan completion, write a consice summary of keypoint about the actual implementation including any deviations or changes and fixes while implementing, saved to: `context/plan-implemented/{ plan title }-implemented.md` with:
    - High-level overview
    - Key decisions, issues resolved from Tasks reports
    - optimize for regrex grep searchability

# local development
backend: http://localhost:3101
frontend: http://localhost:3100
db: localhost:15432 (docker)
Make sure the frontend url: external IP vs localhost, and CORs configuration across IaC and env vars