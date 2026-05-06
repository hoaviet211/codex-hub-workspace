---
name: devops-pipeline
description: Build and review CI/CD pipelines, Docker workflows, release automation, monitoring, and rollback plans. Use when working with GitHub Actions, container builds, deployment jobs, observability setup, or production release process design.
---

# DevOps Pipeline

## Overview

Use this skill to make delivery pipelines repeatable, observable, and reversible. Optimize for build reliability, safe rollout, and short recovery time.

## Workflow

1. Map build, test, package, release, deploy, and rollback stages.
2. Check CI isolation, caching, secret handling, and artifact integrity.
3. Review Dockerfiles and runtime images for size, security, and reproducibility.
4. Add health checks, metrics, logs, and alerts around deployment.
5. Confirm rollback triggers and operational ownership.

## Best Practices

- Keep CI stages explicit: lint, test, build, scan, package, deploy.
- Use pinned actions, minimal permissions, and masked secrets.
- Prefer multi-stage Docker builds and non-root containers where possible.
- Fail fast on tests and security scans before deploy.
- Expose deployment health through logs, metrics, and alerts.
