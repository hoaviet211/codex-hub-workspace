# Codex Hub WebOS V1.5

Local Windows dashboard for Codex Hub.

## Scope

- React + Vite + TypeScript UI.
- Node/Fastify API bound to `127.0.0.1`.
- Agent context gateway, read-only workspace monitoring, and approval queue.
- Writes only:
  - `.orchestrator/checks/latest.json`
  - `.orchestrator/events/YYYY-MM-DD.jsonl`
  - `.orchestrator/workspace-digest.md`
  - `.orchestrator/action-queue/*.json`
  - `.orchestrator/memory-candidates/*.json`

## Non-Goals

- No command execution.
- No source file mutation through API.
- No deploy, SSH, DB migration, or server management.
- No auth or multi-user support.
- Gemma is optional and returns fallback responses when unavailable.

## Start

```powershell
npm install
npm start
```

Open:

- UI: `http://127.0.0.1:5173`
- API health: `http://127.0.0.1:8787/health`

## Scripts

```powershell
npm run dev
npm run typecheck
npm run build
npm run test
npm run test:smoke
```

## Endpoints

- `GET /health`
- `POST /api/workspace/scan`
- `GET /api/workspace/overview`
- `GET /api/agent/bootstrap`
- `GET /api/context/brief?scope=workspace|project|task&projectId=&taskId=&verbosity=compact`
- `GET /api/next-step/recommendation?scope=workspace|project|task`
- `GET /api/workspace/source-map`
- `GET /api/projects`
- `GET /api/projects/:projectId`
- `GET /api/projects/context?projectId=&includeDirty=true`
- `GET /api/tasks?status=&project=`
- `GET /api/tasks/:taskId`
- `GET /api/tasks/context?status=active|recent&project=&limit=`
- `GET /api/checks/latest`
- `GET /api/checks/history?limit=`
- `GET /api/actions?status=`
- `PATCH /api/actions/bulk`
- `POST /api/actions/cleanup`
- `POST /api/actions`
- `POST /api/actions/from-finding`
- `GET /api/actions/:actionId`
- `PATCH /api/actions/:actionId`
- `GET /api/memory/candidates?status=`
- `GET /api/memory/candidates/:candidateId`
- `PATCH /api/memory/candidates/:candidateId`
- `GET /api/digest/latest`
- `POST /api/digest/generate`
- `GET /api/gemma/status`
- `POST /api/gemma/summarize`

## Safety Boundary

The API has no execute endpoint and does not import `child_process`. Git status is read through a JavaScript Git library. Approval actions only create or update JSON records in `.orchestrator/action-queue`. Memory candidate review only updates JSON records in `.orchestrator/memory-candidates`.

## Agent Context Gateway

`GET /api/agent/bootstrap` is the first call for Codex or the UI before deciding what to do. It returns compact context, active tasks, deterministic next-step recommendations, source-map hints, and safety limits.

Recommendations are advisory. They include `confidence`, `confidenceReason`, `readyState`, `blockedBy`, `dedupeKey`, `manualOnly`, `risk`, `evidence`, and a structured `primaryAction`. The API does not call an LLM, run commands, or modify project source.

`POST /api/actions/from-finding` converts a recommendation into a pending action record. It is idempotent by `dedupeKey`, so repeated requests return the existing action instead of creating duplicates.

Operator flow:

1. Open the `Agent` tab.
2. Review bootstrap context and recommendations.
3. Use `Create Action` to queue a selected recommendation.
4. Approve or reject the pending action in `Actions`.
5. Use `Reject pending` or `Clear resolved` to keep the queue clean after review.
6. Let Codex execute only after scope is clear.
