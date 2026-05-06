---
name: project-state
description: Track and update the lifecycle state of a client project, including phase, blockers, milestones, demo readiness, and release readiness. Use when you need to know where the overall project currently stands and what gate comes next.
---

# Project State

## Overview

Use this skill to manage the status of the whole project, not individual tasks. It answers: where is the project now, what is blocking it, what is the next gate, and is it ready for demo, revision, launch, or handoff.

## Core Responsibility

Maintain a single, current project state that is easy to read and update across turns.

Typical project states:

- `new`
- `clarifying`
- `confirmed`
- `designed`
- `building`
- `testing`
- `demo-ready`
- `revising`
- `ready-to-launch`
- `done`
- `blocked`
- `on-hold`

## Workflow

1. Read the current project brief, decisions, and recent progress.
2. Identify the current lifecycle stage of the project.
3. Find the main blocker, if any.
4. Identify the next gate that must be passed.
5. Summarize what changed since the last state update.
6. If the project will continue across turns, store a short note in `workspace/memory.md` or a task file.

## What To Capture

- project name
- client name
- current project state
- last completed milestone
- current blocker
- next gate
- expected owner or skill
- release or demo readiness

## Output Rules

- Keep the state machine small and readable.
- Do not mix task-level detail into project-level state.
- State the blocker explicitly if the project is not moving.
- Make the next action concrete.
- Prefer one canonical current state over multiple competing labels.

## Recommended Output Shape

```markdown
Project: ...
Client: ...
State: new | clarifying | confirmed | designed | building | testing | demo-ready | revising | ready-to-launch | done | blocked | on-hold
Last milestone: ...
Current blocker: ...
Next gate: ...
Next action: ...
Notes: ...
```

## Decision Rules

- Use this skill when the question is about the project as a whole.
- Use `task-manager` when the question is about individual tasks inside the project.
- Use `planner` when the project needs to be broken into milestones.
- Escalate to `tester`, `secure-devops`, or deployment skills when the next gate is verification, security, or release.

## Validation Checklist

Before returning, confirm:

- Is the current project stage explicit?
- Is the main blocker explicit if the project is not moving?
- Is the next gate clear?
- Is the output at project level, not task level?
- Is there a clean handoff to the next skill?

