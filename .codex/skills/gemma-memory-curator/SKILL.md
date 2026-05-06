---
name: gemma-memory-curator
description: Use local Gemma4 through Ollama as a bounded memory curator and context compressor for Codex Hub. Use when summarizing long docs, transcripts, task notes, or runtime digests into reviewed memory candidates with evidence, scope, confidence, conflict/staleness checks, and suggested destination.
---

# Gemma Memory Curator

## Purpose

Use this skill to turn long Codex Hub materials into memory candidates that a human or Codex can review before anything becomes official memory.

Gemma4 is a local curator, not an executor.

## Trigger Conditions

Use this skill when the user asks to:

- summarize long docs, transcripts, task notes, artifacts, or runtime digests
- propose memory entries from a session or project
- compress context for later retrieval
- detect duplicate, conflicting, or stale project knowledge
- decide whether knowledge belongs in memory-service, Obsidian, policy docs, workflows, config, or nowhere

Do not use this skill for normal implementation, shell execution, deploys, source edits, or task-scope decisions.

## Inputs

Minimum input:

- `workspaceId`
- `projectId`
- `sessionId` or `null`
- source path or pasted source text
- intended review destination, if known

Preferred context:

- source title
- source date
- whether the source is active, stale, archived, or user-approved
- known existing memory entries or policy docs to check for conflicts

## Workflow

1. Confirm the work is memory/context curation only.
2. Read only the provided source or explicitly scoped files.
3. If using Gemma4, call it through Ollama only as a local summarizer/classifier.
4. Ask for strict JSON matching the output contract.
5. Validate the JSON before using it.
6. Reject outputs that are not valid JSON, lack evidence, lack scope, or imply direct mutation.
7. Return candidates for review only.
8. Do not persist candidates to memory-service unless a separate approved workflow handles it.

## Guardrails

The curator must not:

- execute shell commands for the user
- modify source code
- deploy
- write official memory directly
- overwrite Obsidian notes
- perform two-way Obsidian sync
- decide task scope by itself
- invent evidence not present in the source
- promote unapproved candidates into memory-service
- flatten `workspaceId -> projectId -> sessionId`

Allowed outputs:

- JSON candidate list
- conflict report
- stale item report
- suggested review actions
- optional human-readable summary alongside the JSON

## Memory Types

Use exactly one type per candidate:

- `user_preference`: stable operator preference or collaboration rule
- `project_decision`: accepted decision about a project or architecture
- `failure_pattern`: repeated failure, tool issue, risk, or workaround
- `reusable_workflow`: process, checklist, command pattern, or template worth reusing
- `source_summary`: compact summary of a source document or task state

## Suggested Destinations

Use exactly one destination:

- `memory-service`: approved scoped memory that should be retrievable later
- `obsidian`: human-readable draft export only
- `AGENTS.md`: stable repo policy
- `config.yaml`: concise operating metadata or registry/config setting
- `workflows`: durable process guidance
- `ignore`: not useful, too stale, duplicated, unsupported, or unsafe

## Required Output Shape

Return valid JSON with this exact top-level shape:

```json
{
  "candidates": [
    {
      "type": "user_preference | project_decision | failure_pattern | reusable_workflow | source_summary",
      "scope": {
        "workspaceId": "string",
        "projectId": "string",
        "sessionId": "string|null"
      },
      "title": "string",
      "summary": "string",
      "evidence": ["string"],
      "confidence": 0.0,
      "action": "create | update | merge | ignore",
      "conflictsWith": [],
      "suggestedDestination": "memory-service | obsidian | AGENTS.md | config.yaml | workflows | ignore"
    }
  ],
  "conflicts": [],
  "staleItems": [],
  "suggestedActions": []
}
```

Validation rules:

- `candidates` must be an array.
- `evidence` must contain at least one source-grounded item for every non-ignored candidate.
- `confidence` must be between `0.0` and `1.0`.
- `sessionId` may be `null`, but `workspaceId` and `projectId` are required.
- `action` must be one of `create`, `update`, `merge`, or `ignore`.
- `suggestedDestination` must be one of the allowed destinations.
- Any candidate with missing evidence, unclear scope, or unsafe action must be changed to `ignore`.

## Example

Input:

```text
workspaceId: codex-hub
projectId: codex-hub
sessionId: 2026-04-26-gemma-memory-curator
source: workspace/artifacts/codex-hub-strategic-runtime-audit.md
```

Output:

```json
{
  "candidates": [
    {
      "type": "project_decision",
      "scope": {
        "workspaceId": "codex-hub",
        "projectId": "codex-hub",
        "sessionId": "2026-04-26-gemma-memory-curator"
      },
      "title": "Gemma4 is memory curator, not executor",
      "summary": "Gemma4 should summarize, classify, and propose memory/context candidates only. Codex remains the executor and official memory writes require approval.",
      "evidence": [
        "Strategic audit final decision scopes Gemma4 to memory/context work.",
        "Plan constraints prohibit Gemma4 from autonomous execution or direct official memory writes."
      ],
      "confidence": 0.92,
      "action": "create",
      "conflictsWith": [],
      "suggestedDestination": "memory-service"
    }
  ],
  "conflicts": [],
  "staleItems": [],
  "suggestedActions": [
    "Review candidate in WebOS Memory Review before persisting."
  ]
}
```

## Validation Checklist

Before returning:

- The output is valid JSON.
- Every candidate has evidence.
- Scope preserves `workspaceId -> projectId -> sessionId`.
- No candidate writes memory directly.
- Conflicts and stale items are called out.
- Suggested destinations are review suggestions, not automatic actions.
- Gemma4 remains a bounded curator/context compressor.
