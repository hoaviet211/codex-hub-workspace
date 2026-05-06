---
name: cloudflare-deploy
description: Deploy and secure Cloudflare workloads and edge configuration. Use when working with Workers, Pages, DNS, WAF, rate limiting, HTTPS/TLS, Cloudflare security features, or Terraform Cloudflare provider changes.
---

# Cloudflare Deploy

## Overview

Use this skill when the deployment target or security control sits on Cloudflare. Treat edge config as production infrastructure and review every ruleset, route, and DNS change before apply.

## Workflow

1. Identify the target surface: Workers, Pages, DNS, WAF, rulesets, or Terraform-managed Cloudflare resources.
2. Review bindings, environment variables, routes, domains, zones, and rollout path.
3. Enforce HTTPS, TLS correctness, WAF coverage, and rate limiting for public traffic.
4. Review preview output, Wrangler config, or Terraform plan before deploy.
5. Verify routes, DNS propagation, origin reachability, and edge security after release.

## Security Priorities

- Keep secrets in Wrangler secrets, platform bindings, or managed secret stores.
- Add WAF rules and rate limits for exposed routes.
- Keep DNS changes deliberate and reversible.
- Prefer least privilege API tokens for automation.
- Check cache, redirect, and origin rules for unintended exposure.

## Deployment Rules

- Review Terraform plans and deploy scripts before apply.
- Backup or export critical production config before risky changes.
- Use preview or staged rollout when the product supports it.
- Do not delete routes, records, or rulesets without explicit user confirmation.
