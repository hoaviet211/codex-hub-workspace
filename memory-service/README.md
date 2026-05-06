# Memory Service

Hybrid memory service for the Codex Hub developer copilot.

## What it does

- stores turns, summaries, facts, decisions, entities, and relations separately
- uses Postgres as the source of truth
- supports pgvector-based retrieval when an embedding provider is configured
- keeps a lightweight in-memory store for tests and local heuristics
- scopes memory by `workspaceId` = customer, `projectId` = project, `sessionId` = task run
- stores memory sources, candidates, review trail, and approved canonical memory items separately
- retrieves approved canonical memory only; proposed/rejected/stale candidates are excluded

## Quick start

```powershell
cd memory-service
npm install
npm run check
npm test
```

## Postgres setup

Set `DATABASE_URL`, then run:

```powershell
npm run db:init
```

The schema uses `pgvector` and a vector column without fixed dimension so the service can work with different embedding providers. If you want ANN indexes, pin one embedding dimension and add an index in Postgres.

## CLI

```powershell
npm run cli -- init
npm run cli -- ingest -- --file .\sample-turn.json
npm run cli -- retrieve -- --workspace demo-workspace --project demo-project --query "what did we decide about caching?"
npm run cli -- summarize -- --workspace demo-workspace --project demo-project --session 11111111-1111-1111-1111-111111111111
npm run cli -- prune -- --workspace demo-workspace --project demo-project
npm run cli -- source:add -- --file .\source.json
npm run cli -- candidate:propose -- --file .\candidate.json
npm run cli -- candidate:review -- --candidate <id> --action approve
npm run cli -- candidate:promote -- --candidate <id>
```

## Candidate review workflow

Canonical memory is written only after review:

```text
source -> proposed candidate -> approve/reject/merge/stale -> promote approved candidate -> memory_items retrieval
```

Rules:

- Gemma or scripts may propose candidates only.
- `candidate:promote` fails unless the candidate status is `approved`.
- Promotion creates a canonical `memory_items` record with scope, evidence, and `sourceCandidateId`.
- Normal retrieval searches active canonical memory items and existing active memory records, not raw candidates.
- Rejected, proposed, merged-only, and stale candidates are not embedded or returned as official memory.

## Environment

- `DATABASE_URL`
- `EMBEDDING_PROVIDER=hash|openai-compatible`
- `EMBEDDING_URL`
- `EMBEDDING_API_KEY`
- `EMBEDDING_MODEL`
