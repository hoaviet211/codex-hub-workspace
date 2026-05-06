---
name: secure-coding
description: Harden application code against OWASP Top 10 issues, auth flaws, unsafe input handling, dependency risk, and secret exposure. Use when writing or reviewing backend, frontend, API, or service code for security, validating authentication and session logic, adding input validation, or running dependency and secret scanning.
---

# Secure Coding

## Overview

Use this skill to harden application code before it reaches production. Focus on exploitability, trust boundaries, and controls that fail safely.

## Workflow

1. Identify untrusted inputs, auth boundaries, privileged actions, and data stores.
2. Review for OWASP Top 10 classes relevant to the stack and feature.
3. Add or tighten validation, authorization, output encoding, and safe error handling.
4. Check dependencies, transitive risk, and exposed secrets.
5. Recommend tests or scans that prove the fix.

## Focus Areas

- Enforce server-side validation for all untrusted inputs.
- Verify authentication, session handling, password reset, token rotation, and logout behavior.
- Verify authorization on every privileged read or write path.
- Prevent injection, XSS, SSRF, path traversal, insecure deserialization, and unsafe file handling.
- Avoid leaking stack traces, credentials, tokens, or internal topology in logs and responses.
- Remove hardcoded secrets. Use environment-backed or managed secret stores.
- Run dependency and secret scans when the repository or CI supports them.

## Output Expectations

- Prioritize exploitable findings first.
- State the attack path, affected trust boundary, and concrete remediation.
- Prefer minimal code changes with high security impact.
- Call out missing tests, scans, or observability when they weaken confidence.
