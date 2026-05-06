---
name: client-intake
description: Turn raw client messages into a structured project brief, scope, open questions, and a clean handoff for planning. Use when the user first receives a customer request and needs to decide what the project actually is before analysis or coding.
---

# Client Intake

## Overview

Use this skill as the first stop when a freelancer receives an unstructured request from a client. The goal is to convert messy input into a buildable brief with clear goals, constraints, risks, and next steps.

## Workflow

1. Read the client message and identify the real request.
2. Capture the actor, goal, desired outcome, and business value.
3. Extract constraints such as deadline, budget, platform, scope, and approval process.
4. Separate what is confirmed from what is assumed.
5. List the minimum questions that unblock planning or design.
6. Produce a concise intake summary that can be handed to `business-analyst` or `planner`.

## Question Strategy

Use [question-bank.md](./references/question-bank.md) as the source of truth for intake questions.

- Start with the fast triage pack when the brief is very raw.
- Add only the conditional pack that matches the project type.
- Never ask every question at once.
- If the first answer already clarifies scope, stop and route forward.

## What To Capture

- client objective
- target users or stakeholders
- deliverables
- success criteria
- timeline and deadline
- budget or effort constraints
- platform, stack, or deployment surface
- integrations and dependencies
- content, brand, or legal constraints
- approval workflow and decision maker

## Output Rules

- Prefer a short, structured brief over a long narrative.
- Ask only questions that change scope, architecture, timeline, or cost.
- Distinguish client facts from assumptions.
- Mark scope risk early if the request is underspecified or contradictory.
- End with the next skill to route to, usually `business-analyst` or `planner`.

## Recommended Output Shape

```markdown
Muc tieu: ...
Khach hang / nguoi dung: ...
Deliverables: ...
Pham vi da xac nhan: ...
Gia dinh tam thoi: ...
Cau hoi can hoi: ...
Rui ro / diem mo: ...
Buoc tiep theo: business-analyst | planner | system-design | ui-design
```

## Decision Rules

- Use this skill before `business-analyst` when the input is raw, incomplete, or scattered across messages.
- Use `business-analyst` after intake when the goal is to turn the clarified brief into requirements and acceptance criteria.
- Use `planner` after intake when the goal is to turn the clarified brief into milestones and execution steps.
- Escalate immediately if the request implies production risk, unclear ownership, or major budget/scope ambiguity.

## Validation Checklist

Before returning, confirm:

- Did we identify the actual project objective?
- Did we capture the confirmed scope and key constraints?
- Did we separate assumptions from facts?
- Did we ask only the questions that matter?
- Did we leave a clear handoff to the next skill?
