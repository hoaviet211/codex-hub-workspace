# Public Development Strategy

Codex Hub Workspace is moving from a private working system into a public product project.

The goal is not to expose every private task. The goal is to show a clear operating model for AI-assisted work: scope first, task trace, acceptance criteria, verification, reusable artifact, and reviewed memory.

## Strategic Position

Codex Hub Workspace should be developed publicly as an operating system for controlled AI work.

Core message:

```text
AI is useful when repeated work becomes a controlled workflow with scope, evidence, verification, and reuse.
```

This repo should prove that message through docs, workflows, scripts, examples, and small runtime components.

## Project Ownership Model

Codex Hub Workspace is a managed project inside the private Codex Hub operating workspace.

```text
private Codex Hub
  -> projects/codex-hub-workspace
      -> public product repo
```

The private Hub remains the working environment for real client context, private task notes, and internal artifacts.

The public project contains the reusable product core: policies, workflows, skills, scripts, public-safe examples, and architecture notes.

This separation lets the project develop in public without exposing the operational instance that produced it.

## Private To Public Boundary

Keep private:

- real client task notes
- raw workspace artifacts
- personal machine paths
- phone numbers, emails, account names, credentials, and project-specific secrets
- unfinished commercial strategy with sensitive context
- unreviewed memory candidates
- generated runtime state

Publish:

- reusable skills
- workflow docs
- task templates
- checkers and helper scripts
- sanitized example tasks
- architecture notes
- public development logs
- small demos that prove the workflow

Decision rule:

```text
If it teaches the workflow without exposing private context, it can be public.
If it proves only one private client situation, keep it private or sanitize it into a generic example.
```

## Development Pillars

### 1. Task Discipline

Every non-trivial public change should show:

- goal
- scope
- constraints
- acceptance criteria
- verification result
- remaining uncertainty

Done when:

- public docs explain the rule
- templates support the rule
- scripts can warn when the task gate is missing

### 2. Reusable Workflow Assets

The repo should grow by adding reusable assets, not chat-only advice.

Priority assets:

- task templates
- operating checklists
- prompt playbooks
- review gates
- public-safe example reports
- scanner scripts
- handoff formats

Done when:

- a new user can copy one workflow and apply it to their own work
- examples show input, process, and verified output

### 3. Public Proof, Not Tool Hype

Public updates should show operational proof:

- what was broken
- what rule or tool fixed it
- what artifact remains
- how it was verified

Avoid:

- generic AI productivity claims
- private client stories without sanitization
- unexplained screenshots
- large architecture claims without a runnable or readable artifact

### 4. Local-First Safety

Codex Hub should stay local-first and review-first.

Public repo rules:

- no browser-triggered command execution
- no secrets in config
- no generated runtime state committed
- no automatic memory promotion
- no public task notes with private client data

Done when:

- `.gitignore` blocks runtime state
- docs state the safety boundary
- scanners run before public commits

### 5. Income Direction

Public development should support sellable workflow services.

Target service shape:

```text
SOP -> checklist -> template -> automation -> review gate -> report
```

Initial service offers:

- AI task workflow setup for small teams
- client intake to task/AC system
- customer support response workflow
- lead follow-up workflow
- content approval workflow
- owner visibility reporting

Done when:

- repo has 2-3 public examples that map a business problem to a repeatable workflow
- README explains the business value without overselling

## Roadmap

### Phase 1: Public Project Baseline

Purpose: make the repo safe, readable, and credible.

Work:

- keep clean public history
- add strategy doc
- link strategy from README
- keep private workspace out of the public repo
- add public-safe contribution and scanning checklist

Done when:

- repo can be shared without explaining the cleanup story
- public reader understands what Codex Hub Workspace is in 5 minutes
- private Hub registry tracks this repo as an active public project

### Phase 2: Workflow Proof

Purpose: show concrete workflows, not only policy.

Work:

- add sanitized example task notes
- add example acceptance criteria
- add example verification reports
- add a public-safe daily review example
- document how task notes become reusable artifacts

Done when:

- at least 3 examples show before -> process -> output -> verification

### Phase 3: Tooling

Purpose: make the workflow enforceable.

Work:

- improve task-gate checker
- add public-repo safety scanner
- add example command wrappers
- document how scripts should be used
- keep tools small and inspectable

Done when:

- a contributor can run one or two commands before committing
- scanner catches local paths, runtime folders, and obvious secrets

### Phase 4: Runtime Model

Purpose: explain and harden the local runtime components.

Work:

- document `memory-service`
- document reviewed memory flow
- document orchestrator helper role
- separate deprecated helper ideas from active runtime direction
- add architecture diagrams only where they clarify behavior

Done when:

- public reader understands what is production direction and what is experimental

### Phase 5: Business Packaging

Purpose: turn the public proof into service offers.

Work:

- write 2-3 service briefs
- map each service to repo artifacts
- define delivery checklist
- define demo and handover gates
- publish selected case-study style examples without private data

Done when:

- Codex Hub can support outreach or client explanation without custom re-explaining each time

## Public Content Cadence

Weekly public update format:

```text
Problem:
Workflow gap:
Change made:
Artifact:
Verification:
Next:
```

Good update topics:

- task/AC traceability improvement
- public safety scan
- memory review flow
- workflow template improvement
- small tool that removes repeated manual work
- sanitized business workflow example

Avoid posting:

- raw client data
- unreviewed memory
- private repo paths
- long technical claims without an artifact link

## Release Gate For Public Changes

Before every public push:

- run `git status --short`
- scan for local paths and known private identifiers
- confirm no generated runtime folders are staged
- confirm no real client task note is included
- confirm README or docs explain any new public-facing concept

Minimum scan categories:

```text
Windows user-profile paths
cloud-sync personal paths
phone numbers
emails
GitHub token prefixes
OpenAI/API key prefixes
private key headers
database connection strings
generated dependency folders
runtime state folders
private workspace task folders
private workspace artifact folders
private project registry folders
```

## Success Metrics

Operational metrics:

- number of reusable workflows
- number of public-safe examples
- number of checks/scripts that prevent repeated mistakes
- number of task notes with clear acceptance criteria

Business metrics:

- number of service offers derived from repo artifacts
- number of public posts that link to proof artifacts
- number of client conversations supported by this repo
- number of repeated manual processes converted into checklist/template/tool

Quality metrics:

- no private data in public commits
- clear boundary between active and experimental components
- docs stay short enough to read and specific enough to execute

## Near-Term Action Plan

1. Keep the new public repo as the only public-facing history.
2. Manage the public repo from `projects/codex-hub-workspace` inside the private Hub.
3. Make the old repo private or treat it as contaminated history.
4. Add a public safety checklist and scanner script.
5. Add one sanitized example task with acceptance criteria.
6. Add one public development log entry per week.
7. Package the first service offer around task/AC workflow setup.

## Working Rule

Develop in private when the work contains real client context.

Publish only the reusable pattern, sanitized artifact, checker, workflow, or lesson.
