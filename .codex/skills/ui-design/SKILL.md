---
name: ui-design
description: Define visual language, layout systems, component behavior, interaction states, responsive rules, and UI direction before implementation. Use when the user needs app screen design, dashboard UX, product UI structure, component rules, visual system decisions, or a coherent UI spec before frontend coding.
---

# UI Design

## Overview

Use this skill to shape how the interface should look and behave before or alongside implementation. Focus on clarity, consistency, and purposeful visual decisions.

`ui-design` owns interface decisions before code: layout, hierarchy, states, controls, navigation, density, and visual rules. It should produce implementation-ready guidance, not generic design advice.

## Routing Boundary

- Use `business-analyst` first when user goals, workflows, or acceptance criteria are unclear.
- Use `system-design` or `architecture-design` when UI decisions depend on API contracts, data flow, roles, or module boundaries.
- Use `frontend-web-ui` after the UI direction is stable enough to implement.
- Use `landing-page-builder` instead when the surface is a marketing page, campaign page, or conversion-focused public site.
- Use `tester` when the main need is UI test cases, acceptance validation, or regression coverage.

## Output Depth

- `Quick`: layout direction, key components, main states, implementation notes.
- `Standard`: add interaction model, responsive rules, content hierarchy, accessibility notes.
- `Rigorous`: add screen-by-screen spec, state matrix, component inventory, edge cases, review checklist.

Default to `Standard` for new app screens or redesigns.

## Workflow

1. Identify core user tasks, frequency of use, and information priority.
2. Define navigation, layout structure, density, and visual hierarchy.
3. Define primary components, controls, and interaction states.
4. Specify typography, color direction, spacing, emphasis, and responsive behavior.
5. Ensure empty, error, loading, success, disabled, hover, focus, and destructive states are covered when relevant.
6. Produce guidance that `frontend-web-ui` can implement without guessing.

## Output Contract

Use this compact structure by default:

```markdown
UI Goal: ...
Primary Workflow: ...
Layout: ...
Components:
- ...
States:
- ...
Responsive Rules:
- ...
Visual Rules:
- ...
Accessibility / UX Risks:
- ...
Implementation Notes:
- ...
Next skill: frontend-web-ui
```

## Output Rules

- Design for actual usage, not a static mockup only.
- Keep visual rules consistent across screens and states.
- Distinguish primary, secondary, and destructive actions clearly.
- Prefer deliberate style systems over generic UI patterns.
- Match density to domain: operational tools should be scannable and efficient; editorial or marketing surfaces can be more expressive.
- Do not use visible in-app text to explain how the UI works unless that copy is part of the product experience.
- Preserve existing product language, labels, and route names when provided.

## Validation Checklist

Before returning, check:

- Is the primary workflow visible?
- Are component states explicit?
- Are responsive rules clear?
- Are action priorities clear?
- Can `frontend-web-ui` implement from this spec without inventing major behavior?
