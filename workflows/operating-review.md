# Operating Review Workflow

Use this workflow when the user asks whether Codex Hub is working correctly, or asks about:

- work performance today
- missing tasks or Acceptance Criteria
- memory behavior
- how the user asked questions or corrected the assistant
- whether the agent followed Codex Hub rules
- daily summary, process gaps, or handoff quality

## Goal

Turn operational friction into reusable improvements without pretending that backfilled evidence existed before the work.

## Inputs

Read the narrowest sources first:

1. Relevant task note in `workspace/tasks/`
2. Today's artifact in `workspace/artifacts/`
3. Git log/status for the impacted repo
4. Today's session files under `%USERPROFILE%\.codex\sessions\YYYY\MM\DD` when interaction evidence is needed
5. `MEMORY.md` and rollout summaries only when checking memory behavior

Do not scan all of `workspace/` or all memories by default.

## Output

Use this structure:

```text
Finding:
Evidence:
Impact:
Fix:
Owner:
Next step:
```

## Required Checks

- Was a task note created before implementation?
- Were AC written before implementation?
- Was the selected mode recorded?
- Was verification evidence captured?
- Were process exceptions labeled as backfill?
- Does the interaction contain durable behavior signals worth a memory candidate?

## Correction Rules

- If task/AC was missing, create a backfill task and label it as `process exception`.
- If the issue is repeated or likely to recur, prefer a script/template/workflow update over a chat-only reminder.
- If memory should learn from the interaction, create a memory candidate artifact for review; do not write canonical memory directly.
- If the user is auditing Codex Hub itself, answer in operating-review mode, not generic assistant mode.

## Closeout

Before closing, record:

- what was checked
- what changed
- how it was verified
- what remains uncertain

