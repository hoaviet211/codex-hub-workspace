---
name: iac-best-practices
description: Design and review Terraform or OpenTofu infrastructure safely with modules, remote state, drift detection, and plan-first workflows. Use when creating or auditing IaC repositories, environments, providers, state backends, or deployment changes.
---

# IaC Best Practices

## Overview

Use this skill to keep infrastructure code reviewable, modular, and safe to apply. Favor predictable plans, stable state management, and environment isolation.

## Workflow

1. Inspect provider setup, module boundaries, variables, and environment layout.
2. Confirm remote state, locking, secret handling, and workspace strategy.
3. Review `fmt`, `validate`, and `plan` output before any apply step.
4. Check drift detection, import strategy, and resource ownership boundaries.
5. Confirm rollback or recovery steps for high-impact resources.

## Guardrails

- Never apply unreviewed Terraform or OpenTofu changes.
- Keep modules small, composable, and environment-aware.
- Avoid storing secrets in plaintext variables, state comments, or sample files.
- Treat state access as privileged production access.
- Prefer explicit plan review and drift checks in CI.
