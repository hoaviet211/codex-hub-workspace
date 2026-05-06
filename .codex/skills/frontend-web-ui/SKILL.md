---
name: frontend-web-ui
description: Build production web UI, dashboards, app screens, and reusable frontend components with real behavior. Use when implementing React, Next.js, or web interfaces, translating UI requirements into code, refining layouts, wiring states, or delivering user-facing product surfaces after the UX direction is clear enough to build.
---

# Frontend Web UI

## Overview

Use this skill to implement real product UI in code. Preserve the established design system when one exists; otherwise create a coherent visual direction that feels intentional rather than generic.

`frontend-web-ui` owns implementation of screens and components. It is not the first stop for vague product intent or unsettled visual direction.

## Routing Boundary

- Use `business-analyst` first when the workflow, user value, or acceptance criteria are unclear.
- Use `ui-design` first when layout, visual language, component behavior, or interaction states need to be decided before coding.
- Use `system-design` or `architecture-design` first when frontend work depends on API shape, data ownership, module structure, or cross-layer contracts.
- Use `app-coder` when the task spans backend, frontend, integrations, and shared application logic.
- Use `tester` when the main need is test cases, regression coverage, or browser verification strategy.

## Output Depth

- `Quick`: implement the requested UI path, verify responsive and primary states.
- `Standard`: add state mapping, component boundaries, accessibility, browser/mobile checks.
- `Rigorous`: add cross-browser checks, keyboard flow, visual regression notes, performance and analytics implications.

Default to `Standard` for client-facing screens.

## Workflow

1. Read the existing routing, component conventions, styling system, and data-fetching pattern.
2. Map user flow, screen states, responsive behavior, and component ownership.
3. Build the smallest set of components that covers the interaction.
4. Wire real data, forms, validation, navigation, and state handling when required.
5. Handle loading, empty, error, disabled, hover, active, focus, and responsive states.
6. Verify desktop and mobile behavior with browser or test tooling when available.

## Implementation Rules

- Preserve existing design tokens, typography, spacing, component library, and naming conventions.
- Do not create a landing-page style hero when the request is for an app, dashboard, or work surface.
- Use existing icons/component primitives where available.
- Keep controls stable in size so dynamic labels, hover states, and loading states do not shift layout.
- Avoid decorative visual drift unless the user asked for a redesign.
- Keep user-visible text exact when copy was provided, especially Vietnamese labels and routes.
- Make UI behavior complete enough for the target workflow, not just static.

## Guardrails

- Do not introduce arbitrary visual style drift into an established product.
- Prefer meaningful hierarchy, spacing, and typography over decorative clutter.
- Keep component APIs simple and reusable.
- Ensure UI implementation matches the intended behavior, not just the static layout.
- Verify text fit, responsive layout, and non-overlap on relevant viewports.
- Record what was verified and what remains untested.

## Output Contract

When handing off, include:

```markdown
Changed: ...
Behavior: ...
Files: ...
Verified: ...
Not verified / risk: ...
Next: ...
```

## Validation Checklist

Before returning, check:

- Does the UI support the real workflow?
- Are loading, empty, error, disabled, and responsive states handled when relevant?
- Does it follow existing conventions?
- Does text fit and avoid overlap?
- Was browser or test verification run when useful?
