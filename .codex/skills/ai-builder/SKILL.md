---
name: ai-builder
description: Design and implement practical AI, LLM, RAG, agent, tool-calling, prompt, evaluation, and automation workflows. Use when the user asks to build AI features, chat assistants, agent systems, retrieval pipelines, prompt workflows, model/tool routing, memory, evaluators, cost/latency optimization, or AI product behavior before coding.
---

# AI Builder

## Overview

Use this skill to turn AI ideas into working, observable, replaceable systems. Think in workflows: planner, executor, tools, memory, retrieval, evaluator, guardrails, and feedback loops.

`ai-builder` owns AI product behavior and LLM workflow architecture. It should keep models replaceable, context small, cost visible, and evaluation concrete.

## Routing Boundary

- Use `business-analyst` first when the user value, task scope, or acceptance criteria are unclear.
- Use `system-design` when the AI feature is part of a broader platform architecture.
- Use `architecture-design` when the implementation needs module boundaries, service contracts, or runtime topology.
- Use `database-design` when memory, vector storage, logs, embeddings, or retrieval schemas are central.
- Use `codex-hub-runtime` when AI workflow needs to connect with Codex Hub apps, `memory-service`, orchestrator/LCO, workspace state, or skill execution hooks.
- Use `app-coder` after the AI workflow and contracts are stable enough to implement.
- Use `secure-coding` when prompts include private data, untrusted tool calls, authorization, tenant data, or secret handling.
- Use `tester` when the main need is eval cases, regression prompts, failure scenarios, or quality gates.

## Output Depth

- `Quick`: AI workflow, model/tool choices, data needed, risks, first implementation step.
- `Standard`: add prompt contracts, retrieval/memory shape, tool boundaries, eval plan, cost/latency notes.
- `Rigorous`: add guardrails, abuse cases, observability, human review, fallback behavior, rollout and monitoring.

Default to `Standard` for buildable AI features.

## Workflow

1. Define the user task, success criteria, and failure cost.
2. Decide whether the feature needs prompt-only, tool use, RAG, memory, workflow orchestration, or agents.
3. Define inputs, context sources, retrieval filters, tools, outputs, and handoff points.
4. Choose model strategy based on quality, latency, cost, privacy, and replaceability.
5. Define prompt contracts, structured outputs, validation, retries, and fallback behavior.
6. Define evaluation cases, regression prompts, metrics, and human review needs.
7. Define observability: traces, prompts, tool calls, token/cost tracking, user feedback, and error categories.

## Output Contract

```markdown
AI Goal: ...
User Workflow: ...
Architecture:
- planner / executor / tools / memory / evaluator

Model Strategy:
- ...

Context and Retrieval:
- ...

Tools and Contracts:
- ...

Prompt / Output Contract:
- ...

Evaluation:
- ...

Safety / Privacy:
- ...

Cost / Latency:
- ...

Implementation Plan:
- ...
```

## Design Rules

- Do not use an agent loop when a deterministic workflow or single model call is enough.
- Keep model choice replaceable through clear interfaces and structured outputs.
- Use retrieval only when the model needs external or changing knowledge.
- Treat memory as scoped state, not a dumping ground. Prefer workspace, project, and session boundaries.
- Validate structured outputs before acting on them.
- Gate destructive, external, privileged, or paid tool calls behind explicit approval or policy.
- Prefer eval cases and traces over subjective claims of quality.
- Keep small local models on bounded tasks such as classification, shallow scanning, patch hints, and summaries unless proven otherwise.

## Validation Checklist

Before returning, check:

- Is the AI task actually necessary, or would deterministic logic work?
- Are inputs, context, tools, and outputs explicit?
- Is the model replaceable?
- Are evaluation cases defined?
- Are cost, latency, privacy, and failure behavior visible?
- Are tool permissions and human approval boundaries clear?
