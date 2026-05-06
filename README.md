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
| Local skills | Available |
| Task gate scripts | Available |
| Memory service | Experimental |
| Orchestrator helper | Experimental |
| Web dashboard | Not included |
| Production deployment | Not included |

## What This Project Provides

- Operating rules for working with Codex and agentic tools
- Reusable skills for planning, requirements, coding, testing, security, DevOps, UI, and AI workflows
- Workflow docs for task intake, definition of done, client demo gates, and operating review
- Scripts for task checks, daily reviews, context export, and memory-aware skill runs
- A local memory-service prototype with reviewed-memory direction
- An orchestrator helper prototype for context composition and handoff workflows

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
+-- memory-service/
+-- orchestrator/
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
| `memory-service/` | Experimental reviewed-memory backend. |
| `orchestrator/` | Experimental helper pipeline for context composition and handoff generation. |
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
- [workflows/prompt-cheatsheet.md](workflows/prompt-cheatsheet.md)
- [workflows/standard-pipeline.md](workflows/standard-pipeline.md)
- [workflows/definition-of-done.md](workflows/definition-of-done.md)
- [docs/public-development-strategy.md](docs/public-development-strategy.md)

## Roadmap

Near-term priorities:

1. Add a public release checklist.
2. Add a public safety scanner for repo checks.
3. Add sanitized example tasks with acceptance criteria.
4. Clarify which runtime components are experimental.
5. Package the first reusable workflow for small-business AI operations.
