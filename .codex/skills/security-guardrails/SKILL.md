---
name: security-guardrails
description: Apply baseline security controls across projects, services, and environments. Use when defining or reviewing firewall rules, SSL/TLS, HTTPS enforcement, rate limiting, logging, monitoring, backup posture, or general production security checklists.
---

# Security Guardrails

## Overview

Use this skill to apply a consistent minimum security baseline across any project. Treat it as the default checklist before exposing a service to the internet.

## Checklist

- Restrict inbound access with firewall or security group rules.
- Enforce HTTPS, valid certificates, secure headers, and TLS-only endpoints.
- Add rate limiting, abuse controls, and WAF protection for public traffic.
- Enable structured logging, security-relevant audit events, and alerting.
- Confirm backups exist, are recent, and have a restore path.
- Minimize privileges for operators, CI, workloads, and machine identities.

## Guardrails

- Default-deny where practical.
- Log enough to investigate incidents without leaking secrets.
- Prefer managed security controls over custom ad hoc scripts.
- Escalate risky gaps before deployment.
