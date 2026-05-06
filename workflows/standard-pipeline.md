# Standard Pipeline

Related docs:

- `AGENTS.md`
- `workflows/definition-of-done.md`
- `workflows/client-demo-gate.md`
- `workflows/operating-review.md`
- `workspace/templates/task.md`
- `workspace/templates/bug-report.md`

## Principle

Codex Hub scales process rigor based on actual risk, not task size. Safety gates determine the minimum required rigor for each change. Beyond that minimum, prefer speed, reversibility, and clear verification over unnecessary ceremony.

## 1. Intake And Risk Check

- Clarify scope, target environment, blast radius, rollback expectations, and whether the change affects production behavior.
- Determine whether the change touches code, infrastructure, deployment, data, auth, payments, or public interfaces.
- Route to the narrowest matching skill first. If the change spans security plus deploy, use `secure-devops`.
- Perform a fast risk check before choosing a workflow depth.
- For bug reports: create a task file from `workspace/templates/bug-report.md` and fill in severity, reproduction steps, and expected vs actual before starting any fix.
- For non-trivial tasks, lock `Muc tieu`, `Pham vi`, `Rang buoc`, and `Mode` before implementation.

## 1.1 Scope Confirmation Gate

Apply this gate before implementation for all non-trivial tasks.

- Required fields: `Muc tieu`, `Pham vi`, `Rang buoc`, `Mode`.
- If any field is missing, ambiguous, or conflicting, stay in analysis and resolve it first.
- Do not continue to implementation while scope is unlocked.
- For Standard/Rigorous work with a task note, run `scripts/check-task-gate.ps1 -TaskPath <path>` before editing. If the work is an audit/backfill, run with `-WarnOnly` and label the task as a process exception.

## 2. Safety Gates

Check every task against these four gates:

1. `Business Impact`: Does this affect business-critical flows, production behavior, customer-facing functionality, authentication, payments, sensitive data, or public interfaces?
2. `Rollback`: Can this be reverted safely and quickly if it fails?
3. `Observability`: Will breakage or regression be detected quickly?
4. `Knowledge`: Do we understand the domain, dependencies, and implementation pattern well enough to change it safely?

Rules:

- If a gate is unclear, assume higher risk and move up one mode.
- Do not reduce rigor because the task looks small or the deadline is tight.
- A small change can still require a rigorous path if impact is high or rollback is weak.

## 3. Execution Modes

### Express

Use only when all safety gates pass and the change does not touch schema, auth, payments, public APIs, or production infrastructure.

Flow:

`Implement -> Spot Check -> Ship`

Typical examples:

- typo fix
- text or content change
- safe config value update
- minor CSS or layout adjustment
- small bug fix in a familiar pattern with low blast radius

### Standard

Use when risk is moderate, the change stays within existing patterns, and targeted testing plus review are sufficient.

Flow:

`Scoped Analysis -> Implement -> Targeted Test -> Review -> Ship`

Typical examples:

- add a form field
- add a simple endpoint following an existing pattern
- update UI behavior in an existing component
- integrate with an existing service
- medium-risk change in a familiar module

### Rigorous

Use when impact is high, rollback is hard, observability is weak, uncertainty is high, or the change touches critical systems.

Flow:

`Plan -> Design -> Implement -> Test -> Security/DevOps Review -> Approval -> Ship`

Typical examples:

- payment flow change
- authentication overhaul
- database migration
- production routing or infrastructure change
- high-impact security-sensitive feature

## 4. Acceptance Criteria

Write and lock Acceptance Criteria **before** implementation begins.

- Use `business-analyst` skill to generate AC for Standard and Rigorous tasks.
- AC must be written in observable terms: "When X happens, the system does Y".
- AC must be recorded in the task file (use `workspace/templates/task.md`).
- Do not proceed to implementation until AC is written and agreed upon.
- Express tasks may skip formal AC if scope is trivially clear, but must still define a spot-check expectation.
- Backfilled AC must be labeled as backfill/process exception and must not be treated as proof that the gate passed.

## 5. Context Build

- Inspect the local repo, runtime assumptions, environments, and deployment topology.
- Inspect only the minimum relevant files in `workspace/` when task state, memory, or retained artifacts matter.
- Identify required secrets, configs, ports, domains, state backends, and external dependencies.
- Prefer read-only inspection before proposing changes.
- Scale context-gathering depth to the selected execution mode.
- During exploration, summarize each step as `Action | Evidence | Risk | Next`.

## 6. Implementation

- Apply the smallest change that satisfies the request.
- Keep infra and deploy config modular and reviewable.
- Avoid embedding secrets or broad permissions.
- Prefer highly reversible changes when risk is uncertain.

## 6.1 Tool Error Handling During Execution

When a tool, command, or integration fails:

- Log a short failure summary: action, error text, and immediate impact.
- Classify severity:
  - `S1 blocking`: current step cannot continue.
  - `S2 degraded`: can continue with degraded confidence/speed.
  - `S3 recoverable`: minor issue with known workaround.
- Propose one fallback approach.
- Ask user confirmation before retrying with a different method that changes tool/path/workflow.

## 7. Verification Expectations

Verify all Acceptance Criteria before marking any task done. Then apply the DoD checklist for the selected mode. See `workflows/definition-of-done.md`.

### Express Verification

- Perform a direct spot check or tightly scoped manual verification.
- Confirm the changed screen, output, config effect, or local behavior is correct.
- Confirm all AC pass even if informally.
- Do not ship in `Express` mode if breakage cannot be verified quickly.

### Standard Verification

- Run targeted unit, integration, lint, type, build, or manual checks appropriate to the change.
- Verify all AC explicitly.
- Verify nearby regression risk, not just the happy path.
- Confirm there is enough signal to detect failure after shipping.
- Complete DoD Tier 2 checklist before marking done.

### Rigorous Verification

- Use an explicit verification plan.
- Verify all AC explicitly with evidence (test output, screenshot, log).
- Run the relevant automated checks and broader regression validation.
- Include security review, deploy review, or rollout validation when the change profile requires them.
- Confirm rollback steps before shipping.
- Complete DoD Tier 3 checklist before marking done.

## 8. Security Review

- For `Standard` and `Rigorous` work, check input validation, auth/session logic, secret handling, dependency risk, and logging coverage when relevant.
- Confirm least privilege for IAM, API tokens, SSH keys, CI credentials, and service bindings.
- Confirm firewall, SSL/TLS, WAF, rate limiting, backups, and audit logging for internet-facing services when relevant.
- Stop and fix critical issues before deployment.

## 9. DevOps And Deploy Review

- For infra, deploy, or production-affecting changes, review Terraform or OpenTofu plan before apply.
- Review deploy scripts, Dockerfiles, compose files, GitHub Actions, and rollout order when relevant.
- Backup production config before changing production systems.
- Confirm health checks, observability, rollback steps, and zero-downtime strategy when applicable.
- Do not run destructive or production-impacting commands without explicit user confirmation.

## 10. Client Demo Gate

For Standard and Rigorous client-facing tasks, run the Client Demo Gate before deploying to production.

- Deploy to staging or preview environment first.
- Send demo to client and collect feedback.
- Do not deploy to production until approval is recorded.
- See full process in `workflows/client-demo-gate.md`.

Express tasks and non-client-facing tasks may skip this step.

## 11. Deploy

- Confirm DoD checklist passes and client approval is recorded (if required) before deploying.
- Apply changes in the safest available mode: canary, rolling, blue/green, preview, or staged rollout.
- Watch service health, logs, and metrics during rollout.
- Roll back immediately if health checks or key metrics degrade.

## 12. Post-Deploy Verification

- Verify endpoint health, TLS, DNS, auth, and critical user flows as applicable.
- Confirm logs, alerts, and backups remain healthy after deployment.
- Record what changed, what was verified, and any follow-up hardening work when the task warrants retained context.
- If a P0 or P1 incident occurred, or if a QA gate was missed, write a post-mortem using `workspace/templates/post-mortem.md` and save to `workspace/artifacts/`.

## 13. Daily And Operating Review

- When the user asks about work performance today, task/AC gaps, memory behavior, or interaction patterns, use `workflows/operating-review.md`.
- For retained daily summaries, copy `workspace/templates/daily-review.md` or run `scripts/new-daily-review.ps1`.
- If the day reveals a durable behavior/process signal, draft a reviewed candidate from `workspace/templates/memory-candidate.md`; do not write directly to canonical memory.
- If a process gate was missed, record it as a process exception and prefer a reusable guardrail over a chat-only reminder.

## Workspace Hygiene

- Keep `workspace/memory.md` short and current.
- Use `workspace/tasks/` for multi-step or retained work instead of scattering temporary notes.
- Archive durable outputs into `workspace/artifacts/` only when they will be reused.
- Do not let `workspace/` become a dumping ground; prune or consolidate stale notes.

## Shared Operational Interface

- Lifecycle states for task tracking and handoff:
  `Context Ready -> Scope Locked -> Plan Ready -> Execute -> Verify -> Close`
- One-line progress format:
  `Action | Evidence | Risk | Next`
