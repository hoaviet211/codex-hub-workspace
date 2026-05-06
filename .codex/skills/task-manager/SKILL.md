---
name: task-manager
description: Track, update, and sequence individual tasks within a project, including dependencies, blockers, owners, and completion status. Use when work needs to be broken down or monitored at task level.
---

# Task Manager

## Overview

Use this skill to manage the granular work inside a project. It answers: which tasks exist, what status each task has, what depends on what, and which task should happen next.

## Core Responsibility

Maintain task-level visibility so a project can move from planning into execution without losing track of dependencies or blockers.

Typical task states:

- `pending`
- `in_progress`
- `blocked`
- `review`
- `done`

## Workflow

1. Read the project goal, milestones, and current task list.
2. Identify each task and its current status.
3. Assign dependencies between tasks if needed.
4. Find blocked tasks and what is needed to unblock them.
5. Recommend the next task to work on.
6. If the task list will continue across turns, store a short note in `workspace/tasks/` or `workspace/memory.md`.

## What To Capture

- task name
- task owner or skill
- task status
- dependency
- blocker
- priority
- next action
- verification needed

## Output Rules

- Keep tasks small and specific.
- Do not use project state labels for task state.
- Highlight blocked tasks clearly.
- Preserve ordering when dependencies matter.
- Use the minimum number of tasks needed to make progress visible.

## Recommended Output Shape

```markdown
Project: ...

| Task | Status | Depends on | Blocker | Next action |
| --- | --- | --- | --- | --- |
| ... | pending | ... | ... | ... |

Next task: ...
Risks: ...
Notes: ...
```

## Decision Rules

- Use this skill when the question is about individual tasks or task sequencing.
- Use `project-state` when the question is about the project lifecycle as a whole.
- Use `planner` when the task list is not yet defined and needs milestones first.
- Route task work to `app-coder`, `ui-design`, `tester`, or deployment skills once the next task is clear.

## Validation Checklist

Before returning, confirm:

- Are the tasks distinct and minimal?
- Are blockers and dependencies visible?
- Is the next task obvious?
- Is the output task-level, not project-level?
- Is there a clean handoff to the executing skill?

