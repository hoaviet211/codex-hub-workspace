---
name: database-design
description: Design practical database schemas, migrations, indexes, constraints, query patterns, retention rules, and data-access boundaries. Use when the user asks for relational or document data modeling, PostgreSQL/MySQL/SQLite schema design, D1/Supabase design, indexing, normalization tradeoffs, multi-tenant data, audit fields, migrations, or database performance before implementation.
---

# Database Design

## Overview

Use this skill when the main risk is data shape, query behavior, migration safety, or long-term data ownership. Optimize for correctness, simple access patterns, safe evolution, and operational visibility.

`database-design` owns schema-level decisions. It can support `system-design` and `architecture-design`, but should stay focused on storage contracts, not full product architecture or application code.

## Routing Boundary

- Use `business-analyst` first when entities, workflows, or acceptance rules are unclear.
- Use `system-design` first when storage choice itself is not yet decided.
- Use `architecture-design` when schema ownership must align with modules, services, repositories, or runtime boundaries.
- Use `app-coder` after schema, migration, and access patterns are clear enough to implement.
- Use `secure-coding` when data contains PII, credentials, auth/session state, tenant boundaries, or regulated data.
- Use `data-analysis` when the question depends on reporting, metrics, funnels, cohorts, or analytical workloads.

## Output Depth

- `Quick`: entities, key fields, relationships, indexes, migration notes.
- `Standard`: add access patterns, constraints, lifecycle, multi-tenant or audit needs, migration plan.
- `Rigorous`: add performance risks, retention, backfill strategy, rollback, privacy/security, observability.

Default to `Standard` for production-facing schema work.

## Workflow

1. Identify entities, ownership, lifecycle, and business rules.
2. List read/write access patterns and expected data volume.
3. Choose database/storage model based on access patterns and consistency needs.
4. Define tables/collections, relationships, constraints, indexes, and uniqueness rules.
5. Define migration, backfill, rollback, and compatibility strategy.
6. Address retention, auditability, privacy, tenant isolation, and data deletion.
7. Define verification queries or tests.

## Output Contract

```markdown
Data Goal: ...
Storage Choice: ...
Entities:
- ...

Schema:
- table/collection: fields, constraints, indexes

Access Patterns:
- ...

Migration Plan:
- ...

Data Safety:
- retention, audit, privacy, tenant isolation

Verification:
- ...

Risks / Open Questions:
- ...
```

## Design Rules

- Start with normalized relational design for transactional data unless access patterns justify otherwise.
- Do not add indexes without naming the query they support.
- Prefer explicit constraints for business invariants that must never drift.
- Separate transactional models from reporting/search projections when their access patterns conflict.
- Treat migrations as production changes: include compatibility, backfill, rollback, and verification when risk requires it.
- Preserve existing ORM, naming, migration, and ID conventions.

## Validation Checklist

Before returning, check:

- Are access patterns explicit?
- Does each index support a real query?
- Are constraints and uniqueness rules clear?
- Is data ownership clear?
- Are migration and rollback risks visible?
- Are PII, retention, audit, and tenant concerns handled when relevant?
