---
name: freelancer-assistant
description: Act as the entry-point coordinator for freelancer work by classifying client requests, choosing the next specialist skill, and producing the next action. Use when a client brief arrives and the workflow needs a natural first stop before analysis, planning, design, or implementation.
---

# Freelancer Assistant

## Overview

Use this skill as the front door for freelancer work. It should make the first pass on incoming client requests, decide what kind of request this is, and route it to the right next skill without forcing the user to think about the workflow.

## Core Responsibility

Turn a raw client message into one of these states:

- `raw brief`
- `clarifying brief`
- `requirements ready`
- `planning ready`

Then route to the next best skill:

- `client-intake` for raw or messy input
- `freelancer-requirements` for a clarified brief that still needs buildable requirements
- `planner` for a brief that is ready to become milestones and execution steps
- `system-design` or `ui-design` when the request is already clear enough to specialize

## Workflow

1. Read the client message and identify the project intent.
2. Decide whether the input is raw, partially clarified, or ready for planning.
3. Capture the client, project, objective, constraints, and decision maker if visible.
4. Ask only the questions that materially change scope, cost, timeline, or solution shape.
5. Route to the next specialist skill.
6. If the task will continue across turns, preserve a short note in `workspace/memory.md` or a task file.

## Intake Bridge

When the request is raw or unclear, route to `client-intake` and use its question bank instead of improvising a long question list.

## Routing Rules

- Use `client-intake` when the client message is incomplete, scattered, or still needs basic structuring.
- Use `freelancer-requirements` when the request is understandable but not yet testable or buildable.
- Use `planner` when scope and acceptance are clear enough to split into milestones.
- Use `system-design` when architecture, integrations, or service boundaries are the main unknowns.
- Use `ui-design` when screens, interaction states, or visual hierarchy are the main unknowns.
- Escalate to security or deployment skills when the request already implies auth, payment, data, hosting, or production risk.

## What To Capture

- client identity or org name
- project name or working title
- primary objective
- visible constraints
- confirmed versus assumed information
- open questions
- risk flags
- recommended next skill

## Output Rules

- Keep the output short and direct.
- State the project state explicitly.
- Do not jump into implementation when the request is still ambiguous.
- End with the exact next action.
- Prefer one clear route over several options when the best path is obvious.

## Recommended Output Shape

```markdown
Khach hang: ...
Du an: ...
Trang thai brief: raw brief | clarifying brief | requirements ready | planning ready
Tom tat: ...
Thong tin da ro: ...
Cau hoi con thieu: ...
Rui ro / canh bao: ...
Buoc tiep theo: client-intake | freelancer-requirements | planner | system-design | ui-design
```

## Decision Checklist

Before returning, confirm:

- Did we identify the client and project if visible?
- Did we classify the request state correctly?
- Did we choose the narrowest useful next skill?
- Did we avoid asking unnecessary questions?
- Did we leave a clean handoff?
