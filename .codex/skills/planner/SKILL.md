---
name: planner
description: Break down ambiguous work into phases, milestones, dependencies, and execution steps. Use when a request needs a concrete plan, task decomposition, sequencing, implementation roadmap, execution phases, delivery milestones, or a compact decision structure before coding, migration, deployment, or multi-skill coordination.
---

# Planner

Use this skill to turn broad asks into an execution path with minimal ambiguity. Optimize for clear ordering, dependency awareness, risk visibility, and context efficiency.

## Operating Rules

- Clarify only what materially changes the plan. Do not ask routine questions if a safe assumption is enough.
- Build context from the smallest useful set of files, notes, or requirements.
- Prefer milestone-based plans over long narrative.
- State assumptions explicitly when they affect scope, sequencing, or estimates.
- Put the first actionable step near the top.
- Include verification and rollback thinking whenever execution risk is non-trivial.
- Keep the plan updateable: each milestone should be small enough to mark complete or blocked.

## Workflow

1. Define the target outcome.
2. Bound the scope, constraints, and environment.
3. Separate knowns, assumptions, unknowns, and blocking decisions.
4. Split the work into milestones with clear completion signals.
5. Map dependencies, parallel work, and critical path.
6. Identify validation, security, operational, or rollout checkpoints.
7. Produce the execution plan in a compact, reusable structure.

## Freelancer Extensions

When using this skill in the freelancer workflow, include project-operational steps in the plan:

- set or confirm the current `project-state`
- break implementation work into `task-manager` items
- include a client review or demo gate when the project needs feedback
- include a handover gate when delivery, documentation, or support are part of scope
- include a revision loop when change requests are likely

## Input Contract

Extract these inputs before planning. If one is missing, either infer it safely or mark it as an assumption.

- Objective: what result must exist at the end
- Scope: what is in and out
- Constraints: time, tech, policy, compatibility, approval, dependency limits
- Environment: repo, system, service, runtime, target deployment surface
- Risk profile: low-risk local work vs production-affecting or user-visible change

If the request is too vague to plan responsibly, reduce ambiguity first by routing to `business-analyst`, `system-design`, `architecture-design`, or `ui-design` as appropriate.

## Decision Rules

Use these rules to choose plan depth:

- Use a short plan when the task is narrow, low-risk, and can be completed in one stream.
- Use a phased plan when the task spans multiple domains, teams, or environments.
- Add explicit rollback and approval gates when production traffic, persistent data, infra, billing, auth, or migrations are involved.
- Add parallel tracks only when they are truly independent and integration cost is low.
- Add a discovery milestone before implementation when key facts are still unknown.

Use these rules to decide whether planning alone is enough:

- Stop at planning when the user asks for analysis only.
- Include implementation sequencing when the user clearly wants execution next.
- Escalate to specialist skills before finalizing the plan when the plan depends on domain-specific correctness.

## Routing Guide

Route through other skills first when the plan depends on discipline-specific decisions:

- `business-analyst`: requirement clarity, acceptance criteria, business scope
- `system-design`: service boundaries, APIs, data flow, high-level architecture
- `architecture-design`: module boundaries, contracts, internal interfaces
- `database-design`: schemas, indexes, migrations, constraints, query patterns
- `ai-builder`: LLM, RAG, agent workflows, prompt/tool contracts, evaluation
- `ui-design`: user flows, states, component behavior, layout direction
- `tester`: test strategy, regression scope, acceptance verification
- `secure-coding`: auth, validation, secrets, application-layer risk
- `secure-devops`: infra risk, deployment safety, production hardening
- `devops-pipeline`: CI/CD, release workflow, observability, rollback automation
- `project-state`: when the plan needs a project-level lifecycle status
- `task-manager`: when the plan needs task-level sequencing or status tracking
- `codex-hub-runtime`: when the plan depends on Hub apps, memory-service, orchestrator/LCO, workspace state, or skill execution hooks

Synthesize the specialized outputs into one executable plan after routing.

## Output Contract

Default to this structure unless the user asked for another format:

```markdown
Muc tieu: ...
Pham vi: ...
Rang buoc: ...
Gia dinh: ...

Milestones

1. ...
   Done when: ...
2. ...
   Done when: ...

Dependencies: ...
Song song hoa: ...
Rui ro chinh: ...
Kiem chung: ...
Project state: ...
Task breakdown: ...
Demo / handover: ...
Buoc dau tien: ...
```

Requirements for a good plan:

- Each milestone must be action-oriented and testable.
- Each milestone should have a clear completion signal.
- Dependencies should identify blockers, not restate milestones.
- Risks should focus on what can invalidate the plan or create rework.
- The first step should be executable immediately.
- For freelancer work, the plan should make the client review, demo, and handover gates explicit when applicable.

For richer examples, read [planning-templates.md](./references/planning-templates.md) only when needed.

## Artifact Policy

Write persistent planning artifacts only when the task is multi-step, long-running, or likely to continue across sessions.

- Update `workspace/tasks/<task-name>.md` when the plan will be executed over multiple turns or by multiple agents.
- Write to `workspace/artifacts/` only for reusable checklists, specs, or handoff outputs.
- Avoid creating duplicate task notes when one already exists.
- Keep task notes short and execution-oriented.

## Validation Checklist

Before returning the plan, check that it answers these questions:

- Is the target outcome concrete?
- Is scope bounded?
- Are assumptions explicit?
- Is the critical path visible?
- Are blockers and decisions separated from execution work?
- Are validation and rollback steps present when risk requires them?
- Is the first action immediately executable?

If any answer is no, tighten the plan before returning it.
