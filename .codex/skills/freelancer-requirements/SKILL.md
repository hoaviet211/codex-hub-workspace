---
name: freelancer-requirements
description: Turn a clarified client brief into buildable requirements, scope boundaries, acceptance criteria, and decision points. Use after client intake when the goal is to lock what will actually be built before design or implementation.
---

# Freelancer Requirements

## Overview

Use this skill after client intake when the request is still business-facing but needs to become a buildable requirement set. The output should let a freelancer confirm scope, estimate work, and hand off cleanly to design or planning.

## Workflow

1. Read the intake summary and identify the actual product goal.
2. Translate the goal into functional requirements and user stories.
3. Define in-scope and out-of-scope behavior.
4. Write acceptance criteria in observable terms.
5. Identify dependencies, constraints, and unresolved decisions.
6. Produce a brief that can go to `planner`, `system-design`, or `ui-design`.

## What To Capture

- business objective
- user problem and desired outcome
- core use cases
- required features
- excluded features
- data or content dependencies
- integration dependencies
- timeline or budget constraints
- approval and sign-off needs
- edge cases that affect scope

## Output Rules

- Keep requirements concrete and testable.
- Separate must-have from nice-to-have.
- Flag ambiguity before implementation starts.
- Prefer short bullets over long prose.
- End with the next routing skill and any blocking questions.

## Recommended Output Shape

```markdown
Muc tieu kinh doanh: ...
Nguoi dung / actor: ...
Yeu cau chuc nang: ...
Khong thuoc pham vi: ...
Acceptance criteria: ...
Cau hoi con mo: ...
Rui ro / rang buoc: ...
Buoc tiep theo: planner | system-design | ui-design
```

## Decision Rules

- Use this skill when the client brief is understandable but not yet testable or buildable.
- Use `planner` next when the requirements are clear enough to break into milestones.
- Use `system-design` next when the solution shape or integration boundaries matter.
- Use `ui-design` next when screens, states, or interaction behavior need definition before coding.
- Escalate if the request touches auth, payments, migrations, or other high-risk behavior.

## Validation Checklist

Before returning, confirm:

- Are the requirements unambiguous enough to estimate?
- Are scope boundaries explicit?
- Are acceptance criteria observable?
- Are assumptions and open questions separated?
- Is the next skill route obvious?
