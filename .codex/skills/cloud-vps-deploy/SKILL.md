---
name: cloud-vps-deploy
description: Deploy and harden applications on Ubuntu VPS infrastructure. Use when configuring Docker, Nginx, systemd, fail2ban, HTTPS, backups, zero-downtime rollout, or operational checks for VM or VPS deployments.
---

# Cloud VPS Deploy

## Overview

Use this skill for traditional VPS deployment where the agent must own both deployment mechanics and host hardening. Prioritize recoverability, least privilege, and stable service operation.

## Workflow

1. Inspect app runtime, ports, domain, process model, and persistence needs.
2. Harden the host with SSH restrictions, firewall rules, automatic security updates, and fail2ban where appropriate.
3. Choose the service pattern: Docker Compose, systemd service, or Nginx reverse proxy in front of the app.
4. Configure secret injection, logs, backups, and restart behavior.
5. Use a staged or zero-downtime rollout where possible.
6. Verify health, TLS, logs, and rollback steps after deploy.

## Deployment Rules

- Run services with the minimum privileges required.
- Terminate TLS correctly and enforce HTTPS.
- Keep Nginx config explicit and versioned.
- Keep systemd units or compose files deterministic and restart-safe.
- Configure log rotation, disk pressure awareness, and backup paths.
- Review deployment scripts before execution.
- Do not run destructive host commands without explicit user confirmation.

## Operational Baseline

- UFW or equivalent firewall enabled.
- Fail2ban or equivalent brute-force protection enabled for exposed admin paths.
- Automatic or scheduled backups defined for config and persistent data.
- Health checks and smoke tests defined for the public endpoint.
