---
name: system-design
description: Design practical high-level software architecture for products, platforms, APIs, backend services, distributed systems, and integrations. Use when the user asks for system architecture, technical design, API design, service boundaries, data flow, scaling plan, storage choices, queues, caching, reliability, deployment tradeoffs, or implementation-ready architecture before coding.
---

# System Design

## Overview

Use this skill to define the high-level shape of a system before implementation. Optimize for clear boundaries, operational realism, and explicit tradeoffs.

`system-design` owns system-level decisions: actors, entry points, core components, APIs/events, data flow, storage choices, scaling assumptions, reliability, security, and rollout shape. Start with the simplest architecture that satisfies the constraints, then separate must-have design from future optimization.

Avoid abstract textbook answers. Produce a design a team can implement.

## Routing Boundary

- Use `business-analyst` first when product goal, workflow, scope, or acceptance criteria are unclear.
- Use `architecture-design` after this skill when the team needs module boundaries, package structure, runtime topology, internal contracts, or ADRs.
- Use `database-design` after this skill when storage choice is clear but schema, indexes, migrations, constraints, or query patterns need detailed design.
- Use `ai-builder` when the system depends on LLM, RAG, agent workflows, prompt/tool contracts, memory, evaluation, or model routing.
- Use `data-analysis` when design depends on metrics, behavior, ranking logic, segmentation, or observed usage patterns.
- Use `secure-devops`, `devops-pipeline`, or infra skills when production deployment, CI/CD, secrets, networking, IaC, or rollback is central.
- Use `planner` after the design is accepted and needs milestone sequencing.
- Use `app-coder` only after system boundaries and key contracts are stable enough to implement.

## First Response Behavior

When underspecified, ask at most 3 high-impact questions, then proceed with labeled assumptions when risk allows. Prioritize:

1. Product goal and core user flow.
2. Expected scale: users, request volume, data size, latency target.
3. Reliability, privacy, security, consistency, or compliance constraints.

If no scale is given, assume MVP-to-growth and label the assumption.

## Output Depth

- `Quick`: context, assumptions, simple architecture, critical flow, main risks, next decision.
- `Standard`: add requirements, component boundaries, API/data contracts, storage, scaling, rollout.
- `Production`: add failure-mode table, security/privacy controls, observability, SLOs, rollback, runbook notes.

Default to `Standard` for implementation planning and `Quick` for exploratory discussion.

## Workflow

1. Define actors, entry points, core use cases, non-goals, and assumptions.
2. Separate functional and non-functional requirements.
3. Propose the simplest viable architecture.
4. Identify core components, owned data, dependencies, and failure impact.
5. Define representative APIs, events, or data contracts.
6. Choose storage based on access patterns, consistency, retention, and migration needs.
7. Describe critical flows, including failure path, retry, and idempotency when relevant.
8. Evaluate scaling, reliability, security, observability, and cost tradeoffs.
9. Provide an incremental rollout plan.

## Output Contract

Use this compact structure by default:

```markdown
# System Design: <name>

## Design Context
## Assumptions
## Requirements
## High-Level Architecture
## Core Components
## APIs / Events
## Data Model and Storage
## Critical Flows
## Scaling and Performance
## Reliability and Failure Modes
## Security and Privacy
## Observability
## Tradeoffs
## Incremental Plan
## Open Questions
```

For small requests, collapse sections that add no decision value.

## Output Rules

- Keep the design readable at one pass.
- State assumptions about traffic, data volume, and reliability.
- Note the simplest design that satisfies the target constraints.
- Separate must-have decisions from future optimization.
- Give every major component a clear responsibility and data owner.
- Include API or event examples only where they clarify implementation.
- Treat security, monitoring, retries, and failure handling as part of the design.
- Do not introduce microservices, queues, caches, search, or event buses unless they solve a stated constraint.

## Validation Checklist

Before returning, check:

- Are assumptions explicit?
- Is the simplest viable architecture shown first?
- Does every component have a clear responsibility?
- Is data ownership and storage rationale clear?
- Are critical flows understandable end to end?
- Are failure, retry, and consistency concerns covered at the right depth?
- Are future optimizations separated from MVP needs?
