# Codex Hub

Codex Hub is my working system for turning daily AI-assisted work into repeatable workflows, task traces, review gates, and reusable tools.

The goal is not to collect AI tools. The goal is to build an operating layer where business work can be described clearly, executed safely, verified, reviewed, and reused.

## What This Repo Is

Codex Hub is a local-first workspace for:

- defining how I work with Codex and other agents
- turning vague work into scoped tasks with Acceptance Criteria
- saving useful outputs as artifacts instead of losing them in chat
- building reusable skills, scripts, templates, and workflow docs
- reviewing memory before it becomes trusted context
- tracking project state across real client and internal projects

The design principle is simple:

```text
User = Brain
Project = Body
Codex = executor / reviewer / integrator
WebOS = local cockpit and review surface
Gemma = bounded curator and context compressor
Memory = approved knowledge only
```

## Why I Am Building It

AI can generate output quickly, but speed alone is not enough.

The real operational problems are:

- work starts without a clear definition of done
- tasks disappear inside chat history
- employees or agents produce output without review trails
- automation is added before the SOP is clear
- memory can become stale or wrong if it is accepted automatically
- business owners cannot see what was done, why it was done, and how it was verified

Codex Hub is my answer to that problem: a practical system for making AI-assisted work traceable, repeatable, and safer to delegate.

## Current Development Focus

The current focus is moving from "AI helps me do tasks" to "AI helps me run a controlled work system."

Active themes:

- **Task discipline**: every non-trivial task should have scope, constraints, Acceptance Criteria, progress, verification, and remaining uncertainty.
- **Public sharing**: development progress should be readable from the GitHub README and selected artifacts, not only from private chat.
- **Workflow proof**: each useful result should leave a reusable artifact, checklist, script, report, or demo.
- **Income direction**: Codex Hub should support sellable workflow/automation services for small businesses, not just internal experimentation.
- **Review-first memory**: extracted memory must go through candidate review before becoming canonical.
- **Local safety**: WebOS and runtime tools stay local-first and must not become unsafe command-execution surfaces.

## Repository Map

```text
Codex hub/
+-- AGENTS.md
+-- QUICK-START.md
+-- config.yaml
+-- .codex/skills/
+-- scripts/
+-- workflows/
+-- workspace/
+-- memory-service/
+-- orchestrator/
+-- projects/
`-- .orchestrator/
```

| Area | Purpose |
|---|---|
| `AGENTS.md` | Main operating policy: workflow, safety gates, skill routing, task rules, memory rules. |
| `QUICK-START.md` | Short daily entrypoint for using the workspace. |
| `config.yaml` | Hub manifest: roles, skills, memory backend, workflow policy, project registry pointers. |
| `.codex/skills/` | Local skills for planning, requirements, coding, UI, testing, security, DevOps, AI workflows, and runtime work. |
| `scripts/` | Reusable PowerShell/CMD helpers for checks, context export, task gates, and memory-aware skill runs. |
| `workflows/` | Process docs: prompt playbook, standard pipeline, definition of done, client demo gate, operating review. |
| `workspace/` | Lightweight operational state: task notes, artifacts, templates, short-lived memory, draft automations. |
| `memory-service/` | Canonical memory backend with source, candidate, review, and approved memory layers. |
| `orchestrator/` | Local Coding Orchestrator helper pipeline. It is helper-only, not the daily execution brain. |
| `projects/` | Project registry area for real internal/client projects managed through this Hub. |
| `.orchestrator/` | Runtime output and generated local state. Not the primary source of truth. |

## How Work Is Supposed To Flow

```text
brief -> task note -> Acceptance Criteria -> execution -> verification -> artifact -> review -> memory candidate if useful
```

For non-trivial work, the agent should decide early whether a task note is required.

A task note is required when the work has any of:

- multiple execution steps
- code, config, or public documentation changes
- client-facing behavior
- auth, security, deploy, data, or production risk
- Acceptance Criteria
- expected continuation across sessions
- verification details that must be remembered

If no task note is created, the agent should state why.

## Development Log

Recent development themes:

- Added stronger operating policy around `Decision mode`, `Failure mode`, and `Efficiency mode`.
- Added `Coach / Pair / Execute` collaboration modes to protect the user's own reasoning skill.
- Added task-gate and daily-review tooling so missing task/AC trace becomes visible.
- Reframed Codex Hub as an income-first workflow system, not a tool showcase.
- Designed public sharing content around proof: task notes, artifacts, reports, SOPs, and review gates.
- Studied Hermes Agent's Kanban model and identified the need for a future Codex Hub task kernel.

## What This Can Become

Codex Hub is moving toward a reusable operating model for small businesses that want employees or agents to use AI without losing control.

The service shape is:

```text
SOP -> checklist -> template -> automation -> review gate -> report
```

Possible business-facing use cases:

- customer support response workflow
- lead follow-up workflow
- content approval workflow
- proposal or quotation workflow
- internal task reporting workflow
- AI usage permission and review checklist
- small dashboard for owner visibility

## Non-Goals

Codex Hub is not trying to be:

- a generic chatbot wrapper
- a replacement for human judgment
- a production control plane that executes arbitrary commands from a browser
- an automatic memory system that trusts every extracted note
- a heavy project-management suite

It is intentionally local-first, review-first, and workflow-first.

## Public Sharing Direction

I am starting to document the build in public through:

- this README
- concise repo maps
- workflow artifacts
- development notes
- practical examples of turning real work into reusable systems

The public narrative is:

> AI becomes useful when it turns repeated work into a controlled workflow with scope, evidence, verification, and reuse.

## Start Here

- [QUICK-START.md](QUICK-START.md)
- [AGENTS.md](AGENTS.md)
- [workflows/prompt-cheatsheet.md](workflows/prompt-cheatsheet.md)
- [workflows/standard-pipeline.md](workflows/standard-pipeline.md)
- [workflows/definition-of-done.md](workflows/definition-of-done.md)
