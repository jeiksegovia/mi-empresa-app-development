---
description: Generate comprehensive implementation plans using multi-pass research, synthesis, and validation
allowed-tools:
  - Task
  - Read
  - Write
  - Glob
  - Grep
  - TodoWrite
---

# /plan-dev Command - Implementation Planning System

## Command Usage

```bash
/plan-dev <description> [--depth quick|deep-research]
```

**Examples:**
```bash
/plan-dev Build user authentication system with JWT tokens and OAuth2. Research alternatives and best practices. --depth deep-research

/plan-dev Add payment processing with Stripe integration --depth quick

/plan-dev Refactor database layer to use Prisma ORM. Consider migration strategy and existing data.
```

## What This Command Does

This command orchestrates a comprehensive planning process using multiple specialized subagents to:

1. **Intake & Understanding** (00-intake)
   - Parse and structure your request
   - Identify requirements, constraints, and goals
   - Determine project type and scope

2. **Research Coordination** (01-research)
   - Search web for best practices, documentation, alternatives
   - Analyze existing codebase for patterns
   - Gather source materials from referenced docs

3. **Multi-Pass Analysis** (02-passes)
   - **Pass A**: Technical research tecnologies, current examples, or related techical topics
   - **Pass B**: Technical/Architecture (stack, examples, APIs, data models)
   - **Pass C**: Another aproaches Technical/Architecture, alternatives, new frameworks, libs, example apps on community
   - **Pass D**: UX/Workflow proposal, whats already build, libs, example apps on community (user experience, screens, flows)
   - **Pass E**: Implementation/Deployment (setup, testing, CI/CD)
3.1 **Meaninful index.md files for Multi-Pass Analysis** (03-passes)
   - Create index.md files for each pass summarizing key findings
   - regex optimized format for easy reference with bash grep tool
   - use subaget to handle large content and split into multiple files if needed
4. **Synthesis & Confidence Analysis** (04-synthesis)
   - Consolidate findings from all passes
   - Analyze confidence levels and gaps
   - Identify technology choices and framework decisions
   - Perform additional research if needed

5. **Plan Generation** (05-plan)
   - Generate comprehensive implementation plan
   - key artifacts needed for implementation: base on reserach, technology choices, new alternatives or frameworks
   - Include architecture diagrams, phases, checklists
   - Create API specs, data schemas, user flows

6. **Executive Summary** (06-executive-summary)
   - High-level overview for stakeholders
   - Key decisions and trade-offs
   - Timeline and resource complexity estimates, Not colude "days or weeks" just complexity level "in points. (1,2,3,5,8,13)" 1 simple, 5 require multiple steps 13 is an spike.

7. **Validation & Feedback** (validate)
   - Automated eval committee scoring
   - Present results to user for feedback
   - Iterate if needed

## Output Structure

All artifacts are saved to:
```
research/<task-slug>/
├── 00-intake.md              # Requirements and scope
├── 01-research.md            # Research findings
├── 02-passes/
│   ├── pass-Pass A.md      # Findings from Pass A
│   ├── pass-Pass B.md      # Findings from Pass B
│   ├── pass-Pass C.md      # Findings from Pass C
│   ├── pass-Pass D.md      # Findings from Pass D
│   └── pass-Pass E.md      # Findings from Pass E
├── 04-synthesis.md           # Consolidated findings + confidence
├── 05-plan.md                # Comprehensive implementation plan
├── 06-executive-summary.md   # High-level summary
├── validate.md               # Validation scores and feedback
└── sources/                  # Referenced documents and research
```

## Depth Levels

### `--depth quick` (Default)
- Single-pass analysis
- Web search: 5-8 sources per topic
- Codebase scan: Pattern matching only
- Plan output: 800-1200 lines
- Duration: 10-20 minutes

### `--depth deep-research`
- Multi-pass analysis with validation
- Web search: 8-10 sources per topic
- Codebase scan: Deep pattern analysis + anti-patterns
- Multiple research angles (A, B, C, D, E)
- Synthesis with confidence scoring
- Plan output: 2000-3000+ lines
- Duration: 30-60 minutes

## How It Works

The command invokes the **plan-dev-orchestrator** subagent which:

1. Creates task directory structure
2. Spawns temporary specialized subagents for each phase
3. Manages data flow between phases
4. Tracks progress with TODO lists
5. Produces markdown artifacts at each stage
6. Validates outputs with eval committee
7. Presents final plan to user

## After Planning

Once you approve the plan, use standard Claude Code workflow:
- `/commit` - Commit the plan
- Start implementation following the phases in `05-plan.md`
- Use `/iterate-plan` if you need to refine (future command)

## Integration with Existing Context

The orchestrator automatically:
- Detects project type (web app, API, CLI, mobile)
- Reads existing docs (README, CLAUDE.md, package.json)
- Searches for patterns in codebase
- Respects `.claude/settings.json` permissions
- References docs in `research/*/sources/` and `development/*/sources/`

## Research Sources Priority

1. **Official documentation**: AWS, GCP, Azure, Anthropic, OpenAI, GitHub
2. **Codebase patterns**: Existing implementations in your project
3. **Best practices**: Industry standards, well-known open source projects
4. **Referenced docs**: Files you've explicitly provided in sources/

---

## Execution

Now initiating the plan-dev orchestrator...

$ARGUMENTS
