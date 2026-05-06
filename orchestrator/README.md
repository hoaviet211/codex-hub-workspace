# Local Coding Orchestrator (LCO)

## Current Role

LCO is a helper pipeline for Codex Hub, not the default executor. Use it to compose briefs, scan context, split work, generate handoff prompts, review diffs, and export draft knowledge. Codex remains the main executor and final integrator.

Avoid `lco task` for daily workflow because it runs the Gemma ReAct loop. Prefer dry-run pipeline commands when LCO is useful:

```bash
lco compose "add login feature" --dry-run
lco scan --tier 1 --dry-run
lco split --dry-run
lco handoff patch-001 --dry-run
```

LCO is a local Gemma 4 agent layer that sits between raw task input and Codex execution. It normalizes task descriptions into structured briefs, scans the workspace to understand the codebase, splits work into small rollback-safe patches, generates Codex-ready handoff prompts, reviews diffs for scope and semantic correctness, and exports project knowledge to an Obsidian vault — all running offline via Ollama.

## Prerequisites

- Node.js 18+
- [Ollama](https://ollama.ai) installed and running
- `gemma4:e4b` model pulled locally
- TypeScript (installed as a devDependency)

## Setup

```bash
cd orchestrator
npm install
npx tsc

# In a separate terminal:
ollama serve

# Pull the model (one-time):
ollama pull gemma4:e4b

# Verify connection:
node dist/cli/index.js ping
```

Expected output from `ping`:

```
Pinging Ollama at http://localhost:11434 (model: gemma4:e4b)...
✓ Ollama is running  (42ms)
✓ Model "gemma4:e4b" is available
```

## Quick Start

Full end-to-end flow:

```bash
# 1. Normalize raw task input into a structured brief
lco compose "add login feature"

# 2. Scan workspace structure (Tier 1 = skeleton scan)
lco scan --tier 1

# 3. Split brief into ordered patches (writes .orchestrator/patches/plan.json)
lco split

# 4. Generate Codex CLI handoff prompt for a patch
lco handoff patch-001

# 5. Review the diff after Codex makes changes
lco review patch-001

# 6. Export project knowledge to Obsidian vault
lco export --vault ~/ObsidianVault
```

## Commands

| Command | Description | Key flags |
|---------|-------------|-----------|
| `lco ping` | Check Ollama connection and model availability | `--model <name>` |
| `lco compose <input>` | Normalize raw task input to structured task brief | `--dry-run` |
| `lco scan` | Scan workspace (Tier 1: skeleton, Tier 2: keyword, Tier 3: deep preview) | `--tier 1\|2\|3`, `--keywords <words>`, `--dry-run` |
| `lco split` | Split current task brief into an ordered patch plan | `--dry-run` |
| `lco handoff <patchId>` | Generate Codex CLI handoff prompt from plan.json | `--mode suggest\|auto-edit\|full-auto`, `--dry-run` |
| `lco review <patchId>` | Review diff: scope, danger, and semantic checks | `--diff <file>`, `--dry-run` |
| `lco export` | Export .orchestrator/ data to an Obsidian vault | `--vault <path>`, `--project <name>`, `--dry-run` |
| `lco status` | Show current brain state: goal, mode, status, patches | |
| `lco plan <goal>` | Plan a new task goal and build initial patch queue | `--mode fast\|safe\|deep` |
| `lco eval <patchId> <outcome>` | Evaluate patch result (success / fail / partial) | |
| `lco memory <sub>` | Log decisions/failures, run learning, show summary | `log-decision`, `log-failure`, `learn`, `show` |
| `lco reset` | Reset brain state to idle | |
| `lco task <goal>` | Legacy/experimental Gemma ReAct loop; do not use for daily workflow | `--context <text>`, `--dry-run` |

## Architecture

LCO is organized as a layered pipeline: the **Strategic Brain** (`brain/`) holds the long-running goal state and coordinates replanning via the Planner, Evaluator, and Strategy modules; the **Agent Core** (`agent-core/`) wraps the Ollama client, handles retries, JSON schema enforcement, and the ReAct loop; and the **Feature Modules** — Context Composer, Workspace Scanner, Patch Engine, Memory Manager, Handoff Generator, Diff Reviewer, and Obsidian Exporter — each handle one stage of the pipeline and write their outputs to `.orchestrator/`. The CLI (`cli/index.ts`) exposes every module as a named command, providing a thin shell around each module's public API with no additional logic.

## Offline-first

Every component runs without an internet connection. The only network call is to `localhost:11434` (Ollama). If Ollama is down, `compose`, `split`, and `task` commands automatically fall back to hardcoded templates — the rest of the pipeline (scan, prioritize, handoff, scope-check, danger-check, export) is fully synchronous and requires no model at all. The `review` command does call Gemma for the semantic dimension; if Ollama is unavailable it returns a `warn` outcome rather than blocking the pipeline.

## File Layout

```
.orchestrator/
  brain-state.json                  Strategic Brain state: goal, mode, status, patch queue
  state.json                        Agent Core runtime state: current task + ReAct tool calls
  current-task.md                   structured task brief from lco compose
  patches/
    plan.json                       ordered patch plan from lco split
    patch-001-replan.md             replan options on failure
    patch-001-diff-review.md        review result from lco review
  memory/
    repo.json                       workspace scan cache (invalidated on git HEAD change)
    decisions.json                  logged decisions (append-only)
    failures.json                   logged failure events (append-only)
    patterns.json                   learned patterns (approval + failure types)
    tasks/task-YYYY-MM-DD.json      task memories, one file per day
    patches/patch-XXX.json          patch completion records
  handoff/
    codex-prompt-patch-001.md       Codex CLI handoff prompt, ready to paste
```

### State files: `brain-state.json` vs `state.json`

Hai file state nằm cạnh nhau trong `.orchestrator/` và dễ nhầm. Phân biệt rõ:

| File | Module | Nội dung | Ghi bởi |
|------|--------|----------|---------|
| `brain-state.json` | `brain/state.ts` | Long-running goal, mode (fast/safe/deep), status (planning/executing/blocked/...), patch queue, evaluation history | `lco plan`, `lco eval`, `lco status` |
| `state.json` | `agent-core/state.ts` | Current agent task: active ReAct tool calls, transient runtime status được `update_status` tool cập nhật | `lco task`, agent-core ReAct loop |

Quy tắc: Brain quản chiến lược nhiều patch; Agent Core quản từng lượt ReAct của một task cụ thể. Không trộn hai file.
