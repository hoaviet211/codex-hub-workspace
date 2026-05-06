# Public Development Strategy

Codex Hub Workspace is developed as a public product project.

The purpose of the public repository is to make the workflow model inspectable, reusable, and release-ready.

## Product Definition

Codex Hub Workspace is a local-first operating workspace for controlled AI-assisted work.

It provides:

- operating policy
- task discipline
- acceptance criteria flow
- review gates
- reusable skills
- helper scripts
- reviewed-memory direction
- experimental runtime components

It does not try to expose implementation history. Public development should focus on reusable project assets.

## Release Model

A release is a named project state that can be understood and reused by someone outside the original working context.

Every release should define:

- what problem it addresses
- which components are included
- which components are experimental
- what changed since the previous release
- how the release was verified
- known limitations
- next planned improvements

Release readiness requires:

- no confidential task notes
- no generated runtime folders
- no local machine paths
- no credentials, tokens, or secrets
- no raw client artifacts
- clear README entrypoint
- clear workflow or usage path

## Release Boundary

Publish:

- reusable workflow docs
- reusable skills
- task templates
- checklists
- scanner scripts
- public-safe examples
- release notes
- architecture notes

Keep out of releases:

- real client task notes
- raw workspace artifacts
- personal machine paths
- phone numbers and emails
- credentials and project secrets
- unreviewed memory candidates
- generated runtime state

Decision rule:

```text
Publish the reusable pattern, not the confidential situation that produced it.
```

## Development Pillars

### 1. Product Clarity

The repo should explain what the project is, what release state it is in, and what a user can safely use today.

Done when:

- README describes the current release, not implementation history
- experimental components are labeled clearly
- Start Here points to usable docs

### 2. Task Discipline

Every non-trivial project change should have a traceable goal, scope, acceptance criteria, verification, and remaining uncertainty.

Done when:

- task gate rules are documented
- task templates are available
- missing task traces can be detected

### 3. Reusable Workflow Assets

The repo should grow through reusable artifacts instead of one-off explanations.

Priority assets:

- task templates
- operating checklists
- prompt playbooks
- definition of done
- public-safe example reports
- scanner scripts
- handoff formats

### 4. Release Safety

Public releases must be safe to inspect.

Release checks should catch:

- local machine paths
- generated folders
- runtime state
- obvious secret patterns
- confidential task and artifact folders
- client identifiers

### 5. Business Usefulness

The project should support sellable workflow services.

Target service pattern:

```text
SOP -> checklist -> template -> automation -> review gate -> report
```

Initial service directions:

- AI task workflow setup for small teams
- client intake to task/AC system
- customer support response workflow
- lead follow-up workflow
- content approval workflow
- owner visibility reporting

## Roadmap

### Phase 1: Release Baseline

Purpose: make the project understandable and safe to share.

Work:

- rewrite README around product and release state
- add release checklist
- add public safety scanner
- label experimental components

Done when:

- a new reader understands the project in 5 minutes
- release boundary is explicit
- safety scan can run before push

### Phase 2: Workflow Proof

Purpose: show concrete workflows, not only policy.

Work:

- add sanitized example task notes
- add acceptance criteria examples
- add verification report examples
- show before -> process -> output -> verification

Done when:

- at least 3 public examples demonstrate the workflow

### Phase 3: Tooling

Purpose: make the process enforceable.

Work:

- improve task-gate checker
- add release scanner
- add command wrappers
- document common usage commands

Done when:

- a contributor can run a small release check before committing

### Phase 4: Runtime Direction

Purpose: clarify active runtime architecture.

Work:

- document memory-service direction
- document reviewed memory flow
- document orchestrator helper role
- separate experimental and supported behavior

Done when:

- public docs show which components are stable, experimental, or planned

### Phase 5: Service Packaging

Purpose: turn the project into reusable business offerings.

Work:

- write service briefs
- map each service to repo artifacts
- define delivery checklist
- define demo and handover gates

Done when:

- the repo can support client conversations without custom explanation each time

## Public Update Format

Use this format for development logs:

```text
Release goal:
Change:
Artifact:
Verification:
Known limitation:
Next:
```

This keeps public updates tied to project progress instead of implementation history.
