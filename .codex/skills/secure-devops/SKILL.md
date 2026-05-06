---
name: secure-devops
description: Combine secure coding, security review, IaC review, and deployment safety in one workflow. Use when a task spans application security plus infrastructure or deployment, or when preparing a production release that needs security scanning and safe rollout controls.
---

# Secure DevOps

## Overview

Use this skill as the umbrella workflow for changes that cross code, infrastructure, and deployment boundaries. Optimize for secure delivery, not just successful delivery.

## Workflow

1. Split the change into application, pipeline, infrastructure, and runtime surfaces.
2. Route each surface to the most specific supporting skill.
3. Run code-level security checks before deployment checks.
4. Review IaC plans, deploy scripts, and production config backups before apply.
5. Verify monitoring, rollback, and post-deploy security posture.

## Required Checks

- OWASP and auth review for changed code paths.
- Dependency and secret scanning where supported.
- Terraform or OpenTofu plan review for infra changes.
- CI/CD permission and secret hygiene review.
- Firewall, TLS, WAF, rate limiting, logging, and backup posture review.

## Decision Rule

- Block deploy if critical security or rollback gaps remain unresolved.
- Escalate destructive actions, production changes, and privilege expansion for explicit confirmation.
