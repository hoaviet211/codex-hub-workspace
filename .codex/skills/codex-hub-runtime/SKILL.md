---
name: codex-hub-runtime
description: Operate and connect Codex Hub runtime apps and local services such as codex-hub-webos, memory-service, orchestrator/LCO, Continue configuration, workspace state, and skill execution hooks. Use when the user asks how Hub apps talk to each other, how to wire skills into local runtime tools, how to use memory retrieval, how to route work through orchestrator flows, or how to debug/extend Codex Hub automation.
---

# Codex Hub Runtime

## Overview

Use this skill for the operational layer that connects reusable skills to built Hub apps and local services. It owns runtime integration, not product requirements, system architecture, or feature coding.

Think of this skill as the bridge between:

- skill contracts in `.codex/skills/`
- runtime app surfaces such as `codex-hub-webos`
- `memory-service` retrieval and ingestion
- `orchestrator` / LCO task planning, handoff, scan, review, and export
- workspace state under `workspace/` and `.orchestrator/`
- Continue / local operator configuration

## Routing Boundary

- Use `planner` when the user needs execution phases or multi-skill sequencing.
- Use `ai-builder` when the main problem is LLM, RAG, prompt, tool, memory, or evaluator design.
- Use `system-design` or `architecture-design` when runtime app integration requires new architecture or module boundaries.
- Use `app-coder` when implementation changes are needed after the runtime contract is clear.
- Use `database-design` when changing memory schema, pgvector setup, indexes, or persistence rules.
- Use `devops-pipeline` or `secure-devops` when runtime work touches CI/CD, production deploy, secrets, or infrastructure.

## Runtime Map

- `codex-hub-webos`: operator UI and app surface. Treat it as the control panel when present.
- `memory-service`: persistent scoped memory. Uses `workspaceId`, `projectId`, and `sessionId` isolation.
- `scripts/run-skill-with-memory.ps1`: current memory-aware skill packet hook. Tries DB retrieval when `DATABASE_URL` exists, then falls back to `workspace/memory.md`.
- `orchestrator/`: Local Coding Orchestrator. Handles compose, scan, split, handoff, review, status, task, memory, and export flows.
- `.orchestrator/`: runtime state and generated artifacts. Do not treat it as source code unless debugging the runtime.
- `config.yaml`: canonical registry for skills, orchestrator, MCP recommendations, workflow policy, and workspace contract.
- `workspace/`: lightweight operational state, task notes, artifacts, templates, and short-lived memory.

## Default Workflow

1. Identify which runtime surface is involved: WebOS, memory, orchestrator, Continue, workspace, or skill registry.
2. Read the narrow local source of truth: `config.yaml`, relevant README, script, or current state file.
3. Define the integration contract: inputs, outputs, command/API boundary, state written, and failure behavior.
4. Decide whether the work is usage guidance, config update, skill update, script change, or app code change.
5. Prefer dry-run, preview, status, or read-only commands before mutating runtime state.
6. Keep the handoff token-light: command, expected output, state file touched, fallback.

## Common Commands

Memory-aware skill packet:

```powershell
.\scripts\run-skill-with-memory.ps1 -SkillName <skill> -WorkspaceId <customer> -ProjectId <project> -SessionId <task-run> -Query "<task>"
```

Memory service:

```powershell
cd memory-service
npm run check
npm test
npm run cli -- retrieve -- --workspace <workspace> --project <project> --query "<query>"
```

Local orchestrator:

```powershell
cd orchestrator
node dist/cli/index.js ping
node dist/cli/index.js scan --tier 1
node dist/cli/index.js status
node dist/cli/index.js handoff <patchId>
```

## Output Contract

```markdown
Runtime Surface: ...
Goal: ...
Source of Truth Checked:
- ...

Integration Contract:
- Input: ...
- Output: ...
- State touched: ...
- Failure behavior: ...

Recommended Skill Flow:
- ...

Command / Change:
- ...

Verification:
- ...

Risk / Fallback:
- ...
```

## Guardrails

- Do not mutate `.orchestrator/`, memory DB, deployment config, or app runtime state without clear intent.
- Do not bypass scope isolation for memory. Preserve `workspaceId -> projectId -> sessionId`.
- Do not turn runtime state into a permanent source of truth; promote stable rules to `AGENTS.md`, `config.yaml`, `workflows/`, or skills.
- Prefer one canonical bridge over many ad hoc wrappers.
- Keep local-model work bounded. Gemma/LCO can classify, scan, split, summarize, and hand off; Codex owns integration and final implementation unless the user decides otherwise.

## Validation Checklist

Before returning, check:

- Is the runtime surface named?
- Was the narrow source of truth checked?
- Are input, output, and state boundaries clear?
- Is memory scope preserved?
- Is the next skill or command explicit?
- Is fallback behavior visible?
