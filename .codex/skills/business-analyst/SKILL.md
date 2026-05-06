---
name: business-analyst
description: Turn product intent, client requests, or vague feature ideas into buildable requirements, user stories, acceptance criteria, scope boundaries, and decision points. Use before system design, UI design, planning, or coding when the problem, user value, workflow, success criteria, or in/out scope is not yet explicit.
---

# Business Analyst

## Overview

Use this skill to translate intent into a buildable product requirement. Focus on user value, scope control, and unambiguous acceptance criteria.

`business-analyst` owns the "what and why" of the work. It should not choose detailed architecture, implementation structure, UI styling, or task sequencing unless the request only needs a lightweight recommendation.

## Routing Boundary

- Use `client-intake` first when the input is a raw client message and basic project facts are missing.
- Use `system-design` after requirements are stable and the main question is system shape, APIs, data flow, or storage.
- Use `ui-design` after user flows are clear and the main question is screen behavior, visual hierarchy, or component states.
- Use `planner` after requirements are accepted and the work needs milestones or execution sequencing.
- Use `app-coder` only after acceptance criteria and scope are clear enough to implement.
- Use `tester` when acceptance criteria need explicit test cases, regression coverage, or bug reproduction detail.

## Output Depth

- `Quick`: goal, users, scope, assumptions, acceptance criteria, next decision.
- `Standard`: add user stories, functional and non-functional requirements, open questions, dependency notes.
- `Rigorous`: add stakeholder map, workflow variants, compliance or data constraints, release acceptance, and sign-off gates.

Default to `Quick` unless the task is client-facing, ambiguous, high-risk, or explicitly asks for a spec.

## Workflow

1. Identify actors, jobs-to-be-done, pain points, and business outcomes.
2. Map the core workflow and important variants.
3. Convert the request into user stories or functional requirements.
4. Define in-scope and out-of-scope behavior.
5. Write acceptance criteria that can be tested.
6. Surface open questions, assumptions, and decision points.

## Output Contract

Use this compact structure by default:

```markdown
Muc tieu: ...
Nguoi dung / actor: ...
Pham vi: ...
Ngoai pham vi: ...
Gia dinh: ...

Yeu cau chuc nang:
- ...

Acceptance Criteria:
- Given ..., when ..., then ...

Quyet dinh can chot:
- ...

Next skill: ...
```

## Output Rules

- Prefer concise requirement bullets over broad prose.
- Separate business need from implementation detail.
- Write acceptance criteria in observable terms.
- Flag dependency on external teams, policy, data, or compliance when relevant.
- Do not hide ambiguity. If a requirement cannot be verified, mark it as an assumption or decision point.
- Preserve exact user/client wording for labels, flows, pricing, policy, or content when it is provided.

## Validation Checklist

Before returning, check:

- Is the business outcome explicit?
- Are users or actors named?
- Is scope separated from out-of-scope?
- Are acceptance criteria observable and testable?
- Are unresolved decisions visible?
- Is the correct next specialist skill identified?
