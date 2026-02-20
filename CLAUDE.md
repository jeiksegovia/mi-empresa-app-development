# global Instructions

# Rules
- always think and reasoning in english, even if the final output is in Spanish or UI/UX elements are in Spanish.
- Respect UI/UX language, the interface is in spanish, but you can use english for programming logic, classes etc, internal communication and reasoning.
- ALWAYS keep output on agent, sub-agents task, under 127000 tokens. Break Down Large output/work into two or three sub-agents, then consolidate, or just spawn sub-agents secuentially to complete the task: e.g Task( Initialize backend Express project ): Large configuration files possibly there, so break this task in chunks: Task 1 "Initialize backend Express project: phase A - ...." Task 2 "Initialize backend Express project: phase B - ...." Task3 "Initialize backend Express project: phase C consolite - ...."
- You must REPORT task completion progress on context/implementation-plan/{task-name or id}.md considering task definition, plan and output of the task.
- Use playwright and bash scripts as main testing artifacts.
- Mandatory to writedown each test on its corresponding directory: backend/tests/{test-set}/** could be bash or playwright spect.ts scripts and frontend/test/{test-set}/** bash or playwright spect.ts After each task completion or implementation. only use bash when its necesary to test artifacts like docker, build commands, network setup, setup script etc. NEVER FORGET TO WRITE TESTS.
