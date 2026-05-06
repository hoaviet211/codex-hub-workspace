# Workspace

Use this folder for operational state while working.

It is not the product source tree and not a database. Keep it lean, text-first, and reviewable.

## Folders

```text
workspace/
+-- tasks/
+-- artifacts/
+-- templates/
+-- automations/
`-- memory.md
```

| Area | Purpose |
|---|---|
| `tasks/` | One Markdown note per non-trivial task. |
| `artifacts/` | Reusable outputs: specs, reports, checklists, handoffs, sanitized examples. |
| `templates/` | Starting templates. Copy them before use. |
| `automations/` | Draft notes for recurring workflows before they become real automations. |
| `memory.md` | Short-lived working assumptions and decisions. Reviewed durable memory should use the memory-service flow. |

## When To Create A Task Note

Create a task note when work has any of:

- multiple steps
- code/config/docs changes
- acceptance criteria
- client-facing behavior
- security, data, deployment, or production risk
- expected continuation across sessions
- verification details worth preserving

For tiny one-step work, a task note is optional. If skipped, the agent should state why.

## Basic Flow

```text
brief -> workspace/tasks/<task>.md -> acceptance criteria -> execute -> verify -> artifact -> review
```

