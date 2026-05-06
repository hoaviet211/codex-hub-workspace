---
name: architecture-design
description: Define implementation-oriented architecture: module boundaries, package structure, service responsibilities, runtime topology, internal contracts, dependency direction, and technical decision records. Use after requirements or system shape are clear and the team needs a maintainable codebase structure before implementation or refactor work.
---

# Architecture Design

## Overview

Use this skill when the system exists or is about to exist and the main question is how to structure it cleanly. Favor cohesion, testability, and maintainable ownership boundaries.

`architecture-design` owns "how the code and runtime should be organized." It sits between `system-design` and `app-coder`: translate system-level choices into modules, packages, interfaces, ownership rules, and ADR-style decisions.

## Routing Boundary

- Use `business-analyst` first when product scope or acceptance criteria are not stable.
- Use `system-design` first when the architecture still needs high-level services, APIs, data flow, storage, or scaling choices.
- Use `database-design` when the main question is schema, indexing, migrations, constraints, or query patterns.
- Use `frontend-web-ui` or `ui-design` when the main problem is screen behavior, component UX, or visual system.
- Use `app-coder` after boundaries, contracts, and decision records are clear enough to implement.
- Use `secure-coding` for auth, authorization, input trust boundaries, secrets, or sensitive data paths.

## Output Depth

- `Quick`: proposed modules, ownership, dependency direction, risks, next coding step.
- `Standard`: add internal contracts, file/package map, data flow, testing approach, ADR bullets.
- `Rigorous`: add migration plan, compatibility constraints, rollout strategy, failure boundaries, review checklist.

Default to `Standard` for refactors or new multi-module features.

## Workflow

1. Inspect existing structure, conventions, dependency direction, and extension points.
2. Identify core domains, modules, and runtime responsibilities.
3. Define boundaries between frontend, backend, worker, storage, shared logic, and integrations.
4. Clarify interfaces, contracts, DTOs, events, and ownership.
5. Decide dependency direction and what must not import what.
6. Capture key tradeoffs as short technical decisions.
7. Define testing, migration, rollout, and operational implications.

## Output Contract

Use this compact structure by default:

```markdown
Architecture Goal: ...
Current Context: ...
Proposed Boundaries:
- Module: responsibility, owns, exposes, depends on

Dependency Rules:
- ...

Contracts:
- ...

Decisions:
- Decision: ...
  Why: ...
  Tradeoff: ...

Implementation Map:
- ...

Verification:
- ...

Risks / Open Questions:
- ...
```

## Output Rules

- Prefer explicit boundaries over vague layering.
- Show what belongs where and why.
- Minimize circular dependencies and hidden coupling.
- Record irreversible or expensive decisions clearly.
- Respect existing repo conventions unless changing them solves a real maintainability problem.
- Keep the design implementation-ready, not just conceptual.
- Prefer incremental migration over big-bang rewrites.

## Validation Checklist

Before returning, check:

- Are module/service responsibilities unambiguous?
- Is ownership of data, contracts, and shared logic clear?
- Are dependency rules enforceable?
- Are expensive decisions captured with tradeoffs?
- Is there a path from current code to target structure?
- Can `app-coder` implement from this without guessing core boundaries?
