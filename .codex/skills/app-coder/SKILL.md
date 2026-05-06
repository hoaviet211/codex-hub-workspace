---
name: app-coder
description: Implement application features across backend, frontend, integrations, and shared app logic. Use when the user wants code written for product functionality, CRUD flows, auth integration, service logic, API handlers, or cross-layer feature delivery.
---

# App Coder

## Overview

Use this skill for implementation work that should ship real behavior, not just analysis. The goal is to implement the smallest viable change that satisfies the request, preserve existing conventions, and update operational artifacts at the right level for the size of the feature.

`app-coder` is the default implementation skill, not the default design skill. If the request is vague, changes architecture, data model, AI workflow, or carries high product or technical risk, route through `planner`, `business-analyst`, `system-design`, `architecture-design`, `database-design`, or `ai-builder` before implementation. If a high-risk feature does not yet have a clear design note or equivalent decision record, do not jump straight into code.

## When To Use / When Not To Use

Use this skill when:

- the user wants code implemented
- the request spans backend, frontend, shared logic, or integrations
- the task needs explicit implementation discipline rather than just a component tweak

Do not use this skill as the first stop when:

- the requirement is still ambiguous
- the main problem is product clarification or acceptance criteria
- the change is primarily architectural
- the change is primarily database schema, migration, or query design
- the change is primarily AI workflow, prompt contract, model/tool routing, retrieval, memory, or evaluation design
- the task is really an infra, deploy, or security review problem

In those cases, route first and come back to `app-coder` only after the implementation path is clear.

## Required Inputs

Prefer prompts that include:

- `Muc tieu`
- `Pham vi`
- `Rang buoc`
- `Che do`
- `Context can doc`
- `Output can cap nhat`

Rules:

- If scope or impacted area is missing and the feature is not clearly small, inspect the repo first and infer the likely implementation surface.
- If the task remains ambiguous after a short repo scan and the risk is non-trivial, stop at analysis and route to a planning or design skill.
- Do not guess through high-risk ambiguity just to start coding sooner.

## Sizing Gate

Before editing, classify the change as `small`, `medium`, or `large`.

### `small`

- affects 1-2 files or modules
- does not change core business logic
- does not add a new API or schema change
- estimated effort under 4 hours

### `medium`

- affects 3-8 files or modules
- may add an API, service, or component
- may change validation, state management, or a light integration
- may affect 1-2 adjacent flows
- estimated effort 4-16 hours

### `large`

- affects multiple layers or many modules
- changes schema, auth flow, major business rules, or architecture
- has complex edge cases or rollout concerns
- may require migration, phased delivery, or multiple PRs
- estimated effort above 16 hours

If you cannot classify the change after a short repo scan:

1. stay in analysis mode
2. record the assumption or ambiguity
3. route back through planning or design before implementation

## Small Feature Workflow

1. Requirement and quick check
2. Small design note and quick mapping
3. Implement directly
4. Quick verify
5. Handover and update

Rules:

- understand the use case and happy path
- inspect only the minimum relevant files
- create a minimal design note or equivalent operational note before implementation
- include the use case, impacted files or modules, intended approach, and any assumption worth preserving
- apply the smallest viable change
- preserve conventions for validation, state, naming, and data access
- test the happy path and any directly related unit tests when available
- record a short mapping of what was touched so later updates do not need to rediscover the path
- leave the note in an impact file, task note, or equivalent operational artifact used by the repo

## Medium Feature Workflow

1. Requirement and use case analysis
2. Quick system mapping
3. Short design note
4. Implementation
5. Verification and testing
6. Documentation update and handover

Rules:

- inspect impact notes, memory/project notes, architecture docs, and nearby modules before editing
- create a short design note or equivalent artifact before implementation
- include use case summary, impacted files or modules, proposed approach, assumptions, risks, and test strategy
- preserve conventions strictly while keeping the change incremental
- verify logic, happy path, important edge cases, and regression on directly impacted paths
- update `workspace/tasks/` or a reusable artifact when the work spans multiple steps

## Large Feature Workflow

1. Requirement and use case analysis
2. Deep system mapping
3. Detailed design note
4. Incremental implementation
5. Strong verification
6. Documentation update
7. Handover and review

Rules:

- do not implement directly from a vague request
- inspect dependencies across layers and identify all major entry points
- write a detailed design note before substantial edits
- include summary, high-level solution, impacted modules, key decisions, risks, mitigation, test strategy, and rollout thinking
- break work into safe increments or phases
- call out backend/frontend/integration order when sequencing matters
- include explicit regression, security, and performance considerations when relevant
- prefer multiple contained changes over one opaque rewrite

## Verification Rules

Verification depth depends on feature size.

### `small`

- test happy path
- run directly related unit tests when available
- inspect obvious adjacent breakage
- record the exact verification depth in the handover note, even if it is intentionally light

### `medium`

- test logic and happy path
- test primary edge cases
- run unit or integration tests for impacted paths
- inspect regression on nearby flows

### `large`

- run unit and integration tests
- test important edge cases and failure paths
- run broader regression for impacted flows
- run end-to-end tests when the repo supports them
- include non-functional checks when the feature touches performance, security, or rollout risk

If you cannot run a needed test:

- say exactly what was not verified
- say why it was not verified
- do not hide behind vague statements like "unable to test"

## Artifacts And Handover

Output and handover depth depends on feature size.

### `small`

- small design note or equivalent artifact is required
- short impact update, task note update, or equivalent
- concise PR description or handoff note
- capture what changed, why this shape was chosen, what was verified, and any residual follow-up

### `medium`

- short design note
- impact or memory update
- detailed PR description or handoff note
- capture what changed, why this shape was chosen, what was verified, and residual risks

### `large`

- full design note
- memory, architecture, or impact updates
- rollout notes when applicable
- review-ready PR or phased handoff material
- capture what changed, why this shape was chosen, what was verified, and follow-up risks or rollout constraints

Prefer `workspace/tasks/` for live multi-step state and `workspace/artifacts/` for reusable notes. Follow the repo's `task-first` workspace policy and do not read or update workspace broadly without a concrete need.

## Escalation Rules

Escalate before implementation or pause implementation when the change involves:

- schema changes
- AI workflow changes with uncertain evaluation or tool permissions
- auth flow changes
- large cross-layer refactors
- breaking API changes
- unclear ownership between modules
- unrelated dirty changes that create real integration risk

Route to the most relevant companion skill:

- `architecture-design` or `system-design` for structure and interfaces
- `database-design` for schema, indexes, migrations, and query patterns
- `ai-builder` for LLM, RAG, agent, tool, prompt, memory, and eval workflows
- `planner` or `business-analyst` for ambiguity and scope control
- `secure-coding` for security-sensitive flows
- `devops-pipeline` for rollout or CI/CD implications

## Output Rules

- Prefer incremental delivery over broad rewrites.
- Keep interfaces explicit and easy to test.
- Preserve established conventions unless the task explicitly requires changing them.
- Size the feature before coding and pick the workflow that matches.
- Record assumptions, verification, and residual risks at the level appropriate to the feature size.
- Escalate instead of guessing when the implementation path is not yet defensible.
