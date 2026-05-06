# Agent Context Gateway

## Purpose

WebOS V1.5 exposes a deterministic context gateway for Codex. It helps Codex and the operator decide what to review next without scanning registry, tasks, checks, and dirty files manually.

## Boundary

- Localhost only.
- No command execution.
- No LLM calls.
- No source, task, registry, config, or git mutation through the API.
- Runtime mutation is limited to `.orchestrator`.
- Recommendations are `manualOnly` by default.

## Main Flow

1. `GET /api/agent/bootstrap`
2. UI shows brief, active tasks, source-map hints, stale metadata, and next steps.
3. Operator reviews a recommendation.
4. `POST /api/actions/from-finding` queues a pending action by `dedupeKey`.
5. Operator approves or rejects the action in `Actions`.
6. Codex executes only after scope is clear.

## Important Contracts

All agent endpoints include:

```json
{
  "generatedAt": "ISO",
  "sourceScanAt": "ISO",
  "stale": false,
  "staleReason": null,
  "dataCompleteness": "complete"
}
```

Every recommendation includes:

```json
{
  "confidence": 0.82,
  "confidenceReason": "Deterministic severity/action mapping was applied from the latest scan.",
  "readyState": "needs_review",
  "blockedBy": [],
  "dedupeKey": "finding:process:task-one:missing-ac:create_task_note",
  "manualOnly": true,
  "risk": "medium",
  "evidence": ["workspace/tasks/task-one.md has no testable Acceptance Criteria checklist."],
  "primaryAction": {
    "type": "prepare",
    "target": "workspace/tasks/task-one.md",
    "actionType": "create_task_note",
    "reason": "workspace/tasks/task-one.md has no testable Acceptance Criteria checklist.",
    "dedupeKey": "finding:process:task-one:missing-ac:create_task_note"
  }
}
```

## Dedupe Rule

`POST /api/actions/from-finding` accepts either:

```json
{ "findingId": "process:task-one:missing-ac" }
```

or:

```json
{ "dedupeKey": "finding:process:task-one:missing-ac:create_task_note" }
```

If an action with the same `dedupeKey` already exists, the API returns it with `created: false`.
