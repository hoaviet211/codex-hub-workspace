# Codex Hub Workspace

Codex Hub Workspace is a local-first operating workspace for AI-assisted work.

It helps turn vague requests into scoped tasks, acceptance criteria, execution traces, verification notes, reusable workflows, and reviewed memory.

The project is built around one principle:

```text
SOP -> task -> acceptance criteria -> execution -> verification -> reusable artifact
```

## Current Release

This repository is an early development release.

It is usable as a workflow and tooling foundation, but it is not a packaged application yet.

Release status:

| Area | Status |
|---|---|
| Operating policy | Available |
| Workflow docs | Available |
| Workspace skeleton | Available |
| Project registry skeleton | Available |
| Local skills | Available |
| Task gate scripts | Available |
| Memory service | Experimental |
| Orchestrator helper | Experimental |
| WebOS dashboard | Experimental |
| Production deployment | Not included |

## What This Project Provides

- Operating rules for working with Codex and agentic tools
- Reusable skills for planning, requirements, coding, testing, security, DevOps, UI, and AI workflows
- Workflow docs for task intake, definition of done, client demo gates, and operating review
- A `workspace/` area for task notes, artifacts, templates, draft automations, and short-lived memory
- A `projects/` area for registering local projects managed through the workspace
- Scripts for task checks, daily reviews, context export, and memory-aware skill runs
- A local memory-service prototype with reviewed-memory direction
- An orchestrator helper prototype for context composition and handoff workflows
- A local WebOS dashboard prototype for workspace visibility and manual review flows

## Release Definition

A release of this project is not just a pushed commit.

A release is a versioned project state with:

- clear purpose
- included components
- known limitations
- verification result
- upgrade or usage notes
- no confidential workspace data
- no generated runtime state
- no secrets or machine-specific paths

This keeps the public project understandable, reusable, and safe to inspect.

## Repository Map

```text
codex-hub-workspace/
+-- AGENTS.md
+-- QUICK-START.md
+-- config.yaml
+-- .codex/skills/
+-- scripts/
+-- workflows/
+-- workspace/
+-- projects/
+-- memory-service/
+-- orchestrator/
+-- apps/webos/
+-- docs/
`-- README.md
```

| Area | Purpose |
|---|---|
| `AGENTS.md` | Main operating policy for task flow, safety gates, skill routing, and memory rules. |
| `QUICK-START.md` | Short entrypoint for using the workspace. |
| `config.yaml` | Workspace manifest for roles, skills, memory backend, and workflow policy. |
| `.codex/skills/` | Local Codex skills used by the workspace. |
| `scripts/` | PowerShell/CMD helpers for checks, task gates, reviews, and context export. |
| `workflows/` | Operating docs for prompt patterns, pipeline, DoD, demo gates, and reviews. |
| `workspace/` | Operational state: task notes, artifacts, templates, draft automations, and short-lived memory. |
| `projects/` | Local project registry and ignored project folders managed by the workspace. |
| `memory-service/` | Experimental reviewed-memory backend. |
| `orchestrator/` | Experimental helper pipeline for context composition and handoff generation. |
| `apps/webos/` | Experimental localhost dashboard for workspace visibility, checks, actions, and reviewed memory candidates. |
| `docs/` | Product strategy, release notes, architecture notes, and public examples. |

## Core Workflow

```text
brief -> scope -> acceptance criteria -> execute -> verify -> artifact -> review
```

For non-trivial work, the workspace expects a task note or equivalent trace before implementation.

A task trace should capture:

- goal
- scope
- constraints
- acceptance criteria
- progress
- verification
- remaining uncertainty

## How To Use The Workspace

1. Clone the repo.

```bash
git clone <repo-url>
cd codex-hub-workspace
```

2. Add or clone your real work projects under `projects/`.

```text
projects/
+-- my-client-site/
`-- internal-automation/
```

3. Register each project in `projects/registry.md`.

```markdown
| my-client-site | `projects/my-client-site/` | `github.com/me/my-client-site` | private | active | 2026-05-06 |
```

4. Create a task note for non-trivial work.

```powershell
Copy-Item workspace/templates/task.md workspace/tasks/2026-05-06-my-task.md
```

5. Work through the task flow.

```text
scope -> acceptance criteria -> implementation -> verification -> closeout
```

6. Put reusable outputs in `workspace/artifacts/`.

7. Use WebOS when you want a local dashboard.

```powershell
cd apps/webos
npm install
npm start
```

Open `http://127.0.0.1:5173`.

## Important Storage Rules

- `projects/` is for local project source. Project folders are ignored by this repo by default.
- `workspace/tasks/` is for task traces, not product source.
- `workspace/artifacts/` is for reusable outputs worth keeping.
- `.orchestrator/`, `node_modules/`, `dist/`, and runtime output should not be committed.
- Each project inside `projects/` should manage its own git history and remote.

## Why This Exists

AI-assisted work becomes difficult to control when:

- tasks live only in chat history
- the definition of done is unclear
- output has no verification trail
- automation is added before the SOP is stable
- memory is trusted without review
- owners cannot see what changed, why, and how it was checked

Codex Hub Workspace is a practical answer to that problem: make the work traceable, reviewable, reusable, and safer to delegate.

## Non-Goals

This project is not:

- a generic chatbot wrapper
- a hosted SaaS platform
- a browser-based command executor
- an automatic memory system that trusts every extracted note
- a replacement for human judgment
- a heavy project-management suite

## Start Here

- [QUICK-START.md](QUICK-START.md)
- [AGENTS.md](AGENTS.md)
- [workspace/README.md](workspace/README.md)
- [projects/README.md](projects/README.md)
- [workflows/prompt-cheatsheet.md](workflows/prompt-cheatsheet.md)
- [workflows/standard-pipeline.md](workflows/standard-pipeline.md)
- [workflows/definition-of-done.md](workflows/definition-of-done.md)
- [apps/webos/README.md](apps/webos/README.md)
- [docs/public-development-strategy.md](docs/public-development-strategy.md)

## Roadmap

Near-term priorities:

1. Add a public release checklist.
2. Add a public safety scanner for repo checks.
3. Add sanitized example tasks with acceptance criteria.
4. Clarify WebOS, memory-service, and orchestrator integration boundaries.
5. Package the first reusable workflow for small-business AI operations.

## Packaging Strategy

WebOS is included directly in this repository under `apps/webos/`.

This is intentional for the current release: a normal `git clone` gets the workspace docs, scripts, memory-service, orchestrator, and WebOS source together.

Submodules are avoided for now because they require extra clone commands and are easy to miss.
