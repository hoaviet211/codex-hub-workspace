import { Pool, type PoolConfig } from "pg";
import type {
  MemoryDecisionRecord,
  MemoryEntityRecord,
  MemoryCandidateListOptions,
  MemoryCandidateRecord,
  MemoryFactRecord,
  MemoryItemRecord,
  MemoryKind,
  MemoryPrunePolicy,
  MemoryPromoteInput,
  MemoryRelationRecord,
  MemoryReviewInput,
  MemoryReviewRecord,
  MemorySourceInput,
  MemorySourceRecord,
  MemoryStatus,
  MemorySummaryRecord,
  MemoryTurnRecord,
} from "./types.js";
import { nowIso, uuid } from "./utils.js";
import { loadSchemaSql } from "./schema.js";

export interface MemoryStore {
  init(): Promise<void>;
  upsertSession(input: {
    workspaceId: string;
    projectId?: string;
    sessionId: string;
    userId?: string;
    title?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  addTurn(turn: MemoryTurnRecord): Promise<MemoryTurnRecord>;
  addFact(fact: MemoryFactRecord): Promise<MemoryFactRecord>;
  addDecision(decision: MemoryDecisionRecord): Promise<MemoryDecisionRecord>;
  addEntity(entity: MemoryEntityRecord): Promise<MemoryEntityRecord>;
  addRelation(relation: MemoryRelationRecord): Promise<MemoryRelationRecord>;
  addSummary(summary: MemorySummaryRecord): Promise<MemorySummaryRecord>;
  addSource(source: MemorySourceRecord): Promise<MemorySourceRecord>;
  addCandidate(candidate: MemoryCandidateRecord): Promise<MemoryCandidateRecord>;
  listCandidates(options: MemoryCandidateListOptions): Promise<MemoryCandidateRecord[]>;
  getCandidate(candidateId: string): Promise<MemoryCandidateRecord | null>;
  reviewCandidate(input: MemoryReviewInput): Promise<MemoryCandidateRecord>;
  addReview(review: MemoryReviewRecord): Promise<MemoryReviewRecord>;
  promoteCandidate(input: MemoryPromoteInput & { item: MemoryItemRecord }): Promise<MemoryItemRecord>;
  search(options: {
    workspaceId: string;
    projectId?: string;
    sessionId?: string;
    queryEmbedding: number[];
    limit: number;
    kinds?: MemoryKind[];
  }): Promise<StoredSearchHit[]>;
  recentTurns(sessionId: string, limit: number, projectId?: string): Promise<MemoryTurnRecord[]>;
  countSessionTurns(sessionId: string, projectId?: string): Promise<number>;
  prune(policy: MemoryPrunePolicy): Promise<number>;
}

export interface StoredSearchHit {
  kind: MemoryKind;
  id: string;
  title: string;
  text: string;
  confidence: number;
  score: number;
  source: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly sessions = new Map<string, {
    workspaceId: string;
    projectId?: string;
    userId?: string;
    title?: string;
    summary?: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    lastSeenAt: string;
  }>();

  private readonly turns: MemoryTurnRecord[] = [];
  private readonly facts: MemoryFactRecord[] = [];
  private readonly decisions: MemoryDecisionRecord[] = [];
  private readonly entities: MemoryEntityRecord[] = [];
  private readonly relations: MemoryRelationRecord[] = [];
  private readonly summaries: MemorySummaryRecord[] = [];
  private readonly sources: MemorySourceRecord[] = [];
  private readonly candidates: MemoryCandidateRecord[] = [];
  private readonly reviews: MemoryReviewRecord[] = [];
  private readonly items: MemoryItemRecord[] = [];

  async init(): Promise<void> {
    return;
  }

  async upsertSession(input: {
    workspaceId: string;
    projectId?: string;
    sessionId: string;
    userId?: string;
    title?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const existing = this.sessions.get(input.sessionId);
    const now = nowIso();
    this.sessions.set(input.sessionId, {
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? existing?.projectId,
      userId: input.userId ?? existing?.userId,
      title: input.title ?? existing?.title,
      summary: input.summary ?? existing?.summary,
      metadata: { ...(existing?.metadata ?? {}), ...(input.metadata ?? {}) },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastSeenAt: now,
    });
  }

  async addTurn(turn: MemoryTurnRecord): Promise<MemoryTurnRecord> {
    this.turns.push(turn);
    return turn;
  }

  async addFact(fact: MemoryFactRecord): Promise<MemoryFactRecord> {
    this.facts.push(fact);
    return fact;
  }

  async addDecision(decision: MemoryDecisionRecord): Promise<MemoryDecisionRecord> {
    this.decisions.push(decision);
    return decision;
  }

  async addEntity(entity: MemoryEntityRecord): Promise<MemoryEntityRecord> {
    this.entities.push(entity);
    return entity;
  }

  async addRelation(relation: MemoryRelationRecord): Promise<MemoryRelationRecord> {
    this.relations.push(relation);
    return relation;
  }

  async addSummary(summary: MemorySummaryRecord): Promise<MemorySummaryRecord> {
    this.summaries.push(summary);
    return summary;
  }

  async addSource(source: MemorySourceRecord): Promise<MemorySourceRecord> {
    this.sources.push(source);
    return source;
  }

  async addCandidate(candidate: MemoryCandidateRecord): Promise<MemoryCandidateRecord> {
    this.candidates.push(candidate);
    return candidate;
  }

  async listCandidates(options: MemoryCandidateListOptions): Promise<MemoryCandidateRecord[]> {
    return this.candidates
      .filter((candidate) =>
        matchesScope(candidate.workspaceId, candidate.projectId, options.workspaceId, options.projectId)
        && matchesSession(candidate.sessionId, options.sessionId)
        && (options.status === undefined || candidate.status === options.status))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getCandidate(candidateId: string): Promise<MemoryCandidateRecord | null> {
    return this.candidates.find((candidate) => candidate.id === candidateId) ?? null;
  }

  async reviewCandidate(input: MemoryReviewInput): Promise<MemoryCandidateRecord> {
    const candidate = await this.requireCandidate(input.candidateId);
    const now = nowIso();
    candidate.status = reviewActionToStatus(input.action);
    candidate.reviewedAt = now;
    candidate.reviewedBy = input.reviewer;
    candidate.reviewNote = input.note ?? null;
    await this.addReview({ id: uuid(), candidateId: input.candidateId, action: input.action, reviewer: input.reviewer, note: input.note ?? null, createdAt: now });
    return candidate;
  }

  async addReview(review: MemoryReviewRecord): Promise<MemoryReviewRecord> {
    this.reviews.push(review);
    return review;
  }

  async promoteCandidate(input: MemoryPromoteInput & { item: MemoryItemRecord }): Promise<MemoryItemRecord> {
    const candidate = await this.requireCandidate(input.candidateId);
    if (candidate.status !== "approved") {
      throw new Error(`Candidate ${input.candidateId} must be approved before promotion`);
    }
    this.items.push(input.item);
    candidate.status = "merged";
    candidate.destinationRecordId = input.item.id;
    candidate.reviewedAt = nowIso();
    candidate.reviewedBy = input.reviewer;
    candidate.reviewNote = input.note ?? candidate.reviewNote;
    await this.addReview({ id: uuid(), candidateId: input.candidateId, action: "promote", reviewer: input.reviewer, note: input.note ?? null, createdAt: candidate.reviewedAt });
    return input.item;
  }

  async search(options: {
    workspaceId: string;
    projectId?: string;
    sessionId?: string;
    queryEmbedding: number[];
    limit: number;
    kinds?: MemoryKind[];
  }): Promise<StoredSearchHit[]> {
    const now = new Date();
    const kinds = options.kinds ?? ["item", "decision", "fact", "summary", "entity", "relation", "turn"];
    const items: StoredSearchHit[] = [];

    if (kinds.includes("item")) {
      for (const item of this.items.filter((record) => matchesScope(record.workspaceId, record.projectId, options.workspaceId, options.projectId) && matchesSession(record.sessionId, options.sessionId) && record.status === "active")) {
        items.push(toHit("item", item.id, item.title, item.body, item.confidence, "approved-memory", item.createdAt, { ...item.metadata, evidence: item.evidence, sourceCandidateId: item.sourceCandidateId }, now));
      }
    }

    if (kinds.includes("turn")) {
      for (const turn of this.turns.filter((item) => matchesScope(item.workspaceId, item.projectId, options.workspaceId, options.projectId) && matchesSession(item.sessionId, options.sessionId) && item.status === "active")) {
        items.push({
          kind: "turn",
          id: turn.id,
          title: `Turn ${turn.turnIndex}`,
          text: turn.content,
          confidence: turn.confidence,
          score: turn.confidence * 0.5 + recencyScore(turn.createdAt, now) * 0.5,
          source: turn.source,
          createdAt: turn.createdAt,
          metadata: turn.metadata,
        });
      }
    }

    if (kinds.includes("fact")) {
      for (const fact of this.facts.filter((item) => matchesScope(item.workspaceId, item.projectId, options.workspaceId, options.projectId) && matchesSession(item.sessionId, options.sessionId) && item.status === "active")) {
        items.push(toHit("fact", fact.id, fact.statement, fact.statement, fact.confidence, fact.source, fact.createdAt, fact.metadata, now));
      }
    }

    if (kinds.includes("decision")) {
      for (const decision of this.decisions.filter((item) => matchesScope(item.workspaceId, item.projectId, options.workspaceId, options.projectId) && matchesSession(item.sessionId, options.sessionId) && item.status === "active")) {
        items.push(toHit("decision", decision.id, decision.title, decision.decision, decision.confidence, decision.source, decision.createdAt, decision.metadata, now));
      }
    }

    if (kinds.includes("summary")) {
      for (const summary of this.summaries.filter((item) => matchesScope(item.workspaceId, item.projectId, options.workspaceId, options.projectId) && matchesSession(item.sessionId, options.sessionId) && item.status === "active")) {
        items.push(toHit("summary", summary.id, "Session summary", summary.summary, summary.confidence, summary.source, summary.createdAt, summary.metadata, now));
      }
    }

    if (kinds.includes("entity")) {
      for (const entity of this.entities.filter((item) => matchesScope(item.workspaceId, item.projectId, options.workspaceId, options.projectId) && matchesSession(item.sessionId, options.sessionId) && item.status === "active")) {
        items.push(toHit("entity", entity.id, entity.canonicalName, entity.aliases.join(", "), entity.confidence, entity.source, entity.createdAt, entity.metadata, now));
      }
    }

    if (kinds.includes("relation")) {
      for (const relation of this.relations.filter((item) => matchesScope(item.workspaceId, item.projectId, options.workspaceId, options.projectId) && matchesSession(item.sessionId, options.sessionId) && item.status === "active")) {
        items.push(toHit("relation", relation.id, relation.relationType, relation.relation, relation.confidence, relation.source, relation.createdAt, relation.metadata, now));
      }
    }

    return items.sort((left, right) => right.score - left.score).slice(0, options.limit);
  }

  async recentTurns(sessionId: string, limit: number, projectId?: string): Promise<MemoryTurnRecord[]> {
    return this.turns
      .filter((turn) => turn.sessionId === sessionId && turn.status === "active" && (projectId === undefined || turn.projectId === projectId))
      .sort((left, right) => right.turnIndex - left.turnIndex)
      .slice(0, limit);
  }

  async countSessionTurns(sessionId: string, projectId?: string): Promise<number> {
    return this.turns.filter((turn) => turn.sessionId === sessionId && turn.status === "active" && (projectId === undefined || turn.projectId === projectId)).length;
  }

  async prune(policy: MemoryPrunePolicy): Promise<number> {
    const now = Date.now();
    const archiveOlderThanDays = policy.archiveOlderThanDays ?? 30;
    const lowConfidenceThreshold = policy.lowConfidenceThreshold ?? 0.45;
    const keepRecentDays = policy.keepRecentDays ?? 7;
    let changed = 0;

    for (const turn of this.turns) {
      if (turn.status !== "active") continue;
      if (!matchesScope(turn.workspaceId, turn.projectId, policy.workspaceId ?? turn.workspaceId, policy.projectId)) continue;
      const ageDays = (now - new Date(turn.createdAt).getTime()) / 86_400_000;
      if (ageDays > keepRecentDays) {
        turn.status = "archived";
        changed += 1;
      }
    }

    for (const item of [...this.facts, ...this.decisions, ...this.entities, ...this.relations, ...this.summaries]) {
      if (item.status !== "active") continue;
      if (!matchesScope(item.workspaceId, item.projectId, policy.workspaceId ?? item.workspaceId, policy.projectId)) continue;
      const ageDays = (now - new Date(item.createdAt).getTime()) / 86_400_000;
      if (item.confidence < lowConfidenceThreshold || ageDays > archiveOlderThanDays) {
        item.status = "archived";
        changed += 1;
      }
    }

    return changed;
  }

  snapshot() {
    return {
      sessions: this.sessions,
      turns: this.turns,
      facts: this.facts,
      decisions: this.decisions,
      entities: this.entities,
      relations: this.relations,
      summaries: this.summaries,
      sources: this.sources,
      candidates: this.candidates,
      reviews: this.reviews,
      items: this.items,
    };
  }

  private async requireCandidate(candidateId: string): Promise<MemoryCandidateRecord> {
    const candidate = await this.getCandidate(candidateId);
    if (!candidate) throw new Error(`Candidate ${candidateId} not found`);
    return candidate;
  }
}

export class PostgresMemoryStore implements MemoryStore {
  private readonly pool: Pool;

  constructor(config: string | PoolConfig) {
    this.pool = new Pool(typeof config === "string" ? { connectionString: config } : config);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async init(): Promise<void> {
    const schemaSql = await loadSchemaSql();
    await this.pool.query(schemaSql);
  }

  async upsertSession(input: {
    workspaceId: string;
    projectId?: string;
    sessionId: string;
    userId?: string;
    title?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO memory_sessions (id, workspace_id, project_id, user_id, title, summary, metadata, updated_at, last_seen_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now())
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        project_id = EXCLUDED.project_id,
        user_id = COALESCE(EXCLUDED.user_id, memory_sessions.user_id),
        title = COALESCE(EXCLUDED.title, memory_sessions.title),
        summary = COALESCE(EXCLUDED.summary, memory_sessions.summary),
        metadata = memory_sessions.metadata || EXCLUDED.metadata,
        updated_at = now(),
        last_seen_at = now();
      `,
      [input.sessionId, input.workspaceId, input.projectId ?? null, input.userId ?? null, input.title ?? null, input.summary ?? null, JSON.stringify(input.metadata ?? {})],
    );
  }

  async addTurn(turn: MemoryTurnRecord): Promise<MemoryTurnRecord> {
    await this.pool.query(
      `
      INSERT INTO memory_turns (id, workspace_id, project_id, session_id, turn_index, role, content, embedding, confidence, source, metadata, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9, $10, $11::jsonb, $12, $13)
      `,
      [turn.id, turn.workspaceId, turn.projectId ?? null, turn.sessionId, turn.turnIndex, turn.role, turn.content, toVectorLiteral(turn.embedding), turn.confidence, turn.source, JSON.stringify(turn.metadata), turn.status, turn.createdAt],
    );
    return turn;
  }

  async addFact(fact: MemoryFactRecord): Promise<MemoryFactRecord> {
    await this.pool.query(
      `
      INSERT INTO memory_facts (id, workspace_id, project_id, session_id, subject, predicate, object, statement, embedding, confidence, source_turn_id, valid_from, valid_to, source, metadata, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18)
      `,
      [
        fact.id,
        fact.workspaceId,
        fact.projectId ?? null,
        fact.sessionId ?? null,
        fact.subject,
        fact.predicate,
        fact.object ?? null,
        fact.statement,
        toVectorLiteral(fact.embedding),
        fact.confidence,
        fact.sourceTurnId ?? null,
        fact.validFrom,
        fact.validTo,
        fact.source,
        JSON.stringify(fact.metadata),
        fact.status,
        fact.createdAt,
        fact.updatedAt,
      ],
    );
    return fact;
  }

  async addDecision(decision: MemoryDecisionRecord): Promise<MemoryDecisionRecord> {
    await this.pool.query(
      `
      INSERT INTO memory_decisions (id, workspace_id, project_id, session_id, task_id, title, decision, embedding, confidence, source_turn_id, valid_from, valid_to, source, metadata, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17)
      `,
      [
        decision.id,
        decision.workspaceId,
        decision.projectId ?? null,
        decision.sessionId ?? null,
        decision.taskId ?? null,
        decision.title,
        decision.decision,
        toVectorLiteral(decision.embedding),
        decision.confidence,
        decision.sourceTurnId ?? null,
        decision.validFrom,
        decision.validTo,
        decision.source,
        JSON.stringify(decision.metadata),
        decision.status,
        decision.createdAt,
        decision.updatedAt,
      ],
    );
    return decision;
  }

  async addEntity(entity: MemoryEntityRecord): Promise<MemoryEntityRecord> {
    await this.pool.query(
      `
      INSERT INTO memory_entities (id, workspace_id, project_id, session_id, canonical_name, entity_type, aliases, embedding, confidence, source_turn_id, source, metadata, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::vector,$9,$10,$11,$12::jsonb,$13,$14,$15)
      `,
      [
        entity.id,
        entity.workspaceId,
        entity.projectId ?? null,
        entity.sessionId ?? null,
        entity.canonicalName,
        entity.entityType,
        JSON.stringify(entity.aliases),
        toVectorLiteral(entity.embedding),
        entity.confidence,
        entity.sourceTurnId ?? null,
        entity.source,
        JSON.stringify(entity.metadata),
        entity.status,
        entity.createdAt,
        entity.updatedAt,
      ],
    );
    return entity;
  }

  async addRelation(relation: MemoryRelationRecord): Promise<MemoryRelationRecord> {
    await this.pool.query(
      `
      INSERT INTO memory_relations (id, workspace_id, project_id, session_id, from_entity_id, relation_type, to_entity_id, relation, embedding, confidence, source_turn_id, valid_from, valid_to, source, metadata, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18)
      `,
      [
        relation.id,
        relation.workspaceId,
        relation.projectId ?? null,
        relation.sessionId ?? null,
        relation.fromEntityId,
        relation.relationType,
        relation.toEntityId,
        relation.relation,
        toVectorLiteral(relation.embedding),
        relation.confidence,
        relation.sourceTurnId ?? null,
        relation.validFrom,
        relation.validTo,
        relation.source,
        JSON.stringify(relation.metadata),
        relation.status,
        relation.createdAt,
        relation.updatedAt,
      ],
    );
    return relation;
  }

  async addSummary(summary: MemorySummaryRecord): Promise<MemorySummaryRecord> {
    await this.pool.query(
      `
      INSERT INTO memory_summaries (id, workspace_id, project_id, session_id, summary, embedding, confidence, source, metadata, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6::vector,$7,$8,$9::jsonb,$10,$11,$12)
      `,
      [
        summary.id,
        summary.workspaceId,
        summary.projectId ?? null,
        summary.sessionId,
        summary.summary,
        toVectorLiteral(summary.embedding),
        summary.confidence,
        summary.source,
        JSON.stringify(summary.metadata),
        summary.status,
        summary.createdAt,
        summary.updatedAt,
      ],
    );
    return summary;
  }

  async addSource(source: MemorySourceRecord): Promise<MemorySourceRecord> {
    await this.pool.query(
      `
      INSERT INTO memory_sources (id, workspace_id, project_id, session_id, source_type, source_path, source_hash, metadata, captured_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
      `,
      [source.id, source.workspaceId, source.projectId ?? null, source.sessionId ?? null, source.sourceType, source.sourcePath, source.sourceHash, JSON.stringify(source.metadata), source.capturedAt],
    );
    return source;
  }

  async addCandidate(candidate: MemoryCandidateRecord): Promise<MemoryCandidateRecord> {
    await this.pool.query(
      `
      INSERT INTO memory_candidates (
        id, source_id, workspace_id, project_id, session_id, type, title, summary, evidence,
        confidence, suggested_destination, conflicts_with, status, model, metadata,
        created_at, reviewed_at, reviewed_by, review_note, destination_record_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb,$13,$14,$15::jsonb,$16,$17,$18,$19,$20)
      `,
      [
        candidate.id,
        candidate.sourceId,
        candidate.workspaceId,
        candidate.projectId ?? null,
        candidate.sessionId ?? null,
        candidate.type,
        candidate.title,
        candidate.summary,
        JSON.stringify(candidate.evidence),
        candidate.confidence,
        candidate.suggestedDestination,
        JSON.stringify(candidate.conflictsWith),
        candidate.status,
        candidate.model ?? null,
        JSON.stringify(candidate.metadata),
        candidate.createdAt,
        candidate.reviewedAt,
        candidate.reviewedBy,
        candidate.reviewNote,
        candidate.destinationRecordId,
      ],
    );
    return candidate;
  }

  async listCandidates(options: MemoryCandidateListOptions): Promise<MemoryCandidateRecord[]> {
    const result = await this.pool.query(
      `
      SELECT *
      FROM memory_candidates
      WHERE workspace_id = $1
        AND ($2::text IS NULL OR project_id = $2)
        AND ($3::uuid IS NULL OR session_id = $3::uuid)
        AND ($4::text IS NULL OR status = $4)
      ORDER BY created_at DESC
      `,
      [options.workspaceId, options.projectId ?? null, options.sessionId ?? null, options.status ?? null],
    );
    return result.rows.map(rowToCandidateRecord);
  }

  async getCandidate(candidateId: string): Promise<MemoryCandidateRecord | null> {
    const result = await this.pool.query(`SELECT * FROM memory_candidates WHERE id = $1`, [candidateId]);
    return result.rows[0] ? rowToCandidateRecord(result.rows[0]) : null;
  }

  async reviewCandidate(input: MemoryReviewInput): Promise<MemoryCandidateRecord> {
    const now = nowIso();
    const status = reviewActionToStatus(input.action);
    const result = await this.pool.query(
      `
      UPDATE memory_candidates
      SET status = $2, reviewed_at = $3, reviewed_by = $4, review_note = $5
      WHERE id = $1
      RETURNING *
      `,
      [input.candidateId, status, now, input.reviewer, input.note ?? null],
    );
    if (!result.rows[0]) throw new Error(`Candidate ${input.candidateId} not found`);
    await this.addReview({ id: uuid(), candidateId: input.candidateId, action: input.action, reviewer: input.reviewer, note: input.note ?? null, createdAt: now });
    return rowToCandidateRecord(result.rows[0]);
  }

  async addReview(review: MemoryReviewRecord): Promise<MemoryReviewRecord> {
    await this.pool.query(
      `
      INSERT INTO memory_reviews (id, candidate_id, action, reviewer, note, created_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [review.id, review.candidateId, review.action, review.reviewer, review.note, review.createdAt],
    );
    return review;
  }

  async promoteCandidate(input: MemoryPromoteInput & { item: MemoryItemRecord }): Promise<MemoryItemRecord> {
    const candidate = await this.getCandidate(input.candidateId);
    if (!candidate) throw new Error(`Candidate ${input.candidateId} not found`);
    if (candidate.status !== "approved") {
      throw new Error(`Candidate ${input.candidateId} must be approved before promotion`);
    }

    await this.pool.query(
      `
      INSERT INTO memory_items (id, workspace_id, project_id, session_id, type, title, body, evidence, source_candidate_id, embedding, confidence, status, metadata, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::vector,$11,$12,$13::jsonb,$14,$15)
      `,
      [
        input.item.id,
        input.item.workspaceId,
        input.item.projectId ?? null,
        input.item.sessionId ?? null,
        input.item.type,
        input.item.title,
        input.item.body,
        JSON.stringify(input.item.evidence),
        input.item.sourceCandidateId,
        toVectorLiteral(input.item.embedding),
        input.item.confidence,
        input.item.status,
        JSON.stringify(input.item.metadata),
        input.item.createdAt,
        input.item.updatedAt,
      ],
    );
    const now = nowIso();
    await this.pool.query(
      `
      UPDATE memory_candidates
      SET status = 'merged', destination_record_id = $2, reviewed_at = $3, reviewed_by = $4, review_note = COALESCE($5, review_note)
      WHERE id = $1
      `,
      [input.candidateId, input.item.id, now, input.reviewer, input.note ?? null],
    );
    await this.addReview({ id: uuid(), candidateId: input.candidateId, action: "promote", reviewer: input.reviewer, note: input.note ?? null, createdAt: now });
    return input.item;
  }

  async search(options: {
    workspaceId: string;
    projectId?: string;
    sessionId?: string;
    queryEmbedding: number[];
    limit: number;
    kinds?: MemoryKind[];
  }): Promise<StoredSearchHit[]> {
    const kinds = new Set(options.kinds ?? ["item", "decision", "fact", "summary", "entity", "relation", "turn"]);
    const query = toVectorLiteral(options.queryEmbedding);
    const limitPerTable = Math.max(options.limit * 2, 10);
    const hits: StoredSearchHit[] = [];

    if (kinds.has("item")) {
      const result = await this.pool.query(
        `
        SELECT id, title, body AS text, confidence, created_at, 'approved-memory' AS source,
               metadata || jsonb_build_object('evidence', evidence, 'sourceCandidateId', source_candidate_id) AS metadata,
               1 - (embedding <=> $4::vector) AS semantic_score
        FROM memory_items
        WHERE workspace_id = $1 AND ($2::text IS NULL OR project_id = $2) AND ($3::uuid IS NULL OR session_id = $3::uuid) AND status = 'active'
        ORDER BY embedding <=> $4::vector ASC NULLS LAST, created_at DESC
        LIMIT $5
        `,
        [options.workspaceId, options.projectId ?? null, options.sessionId ?? null, query, limitPerTable],
      );
      hits.push(...result.rows.map((row: Record<string, unknown>) => rowToHit("item", row)));
    }

    if (kinds.has("decision")) {
      const result = await this.pool.query(
        `
        SELECT id, title, decision AS text, confidence, created_at, source, metadata,
               1 - (embedding <=> $4::vector) AS semantic_score
        FROM memory_decisions
        WHERE workspace_id = $1 AND ($2::text IS NULL OR project_id = $2) AND ($3::uuid IS NULL OR session_id = $3::uuid) AND status = 'active'
        ORDER BY embedding <=> $4::vector ASC NULLS LAST, created_at DESC
        LIMIT $5
        `,
        [options.workspaceId, options.projectId ?? null, options.sessionId ?? null, query, limitPerTable],
      );
      hits.push(...result.rows.map((row: Record<string, unknown>) => rowToHit("decision", row)));
    }

    if (kinds.has("fact")) {
      const result = await this.pool.query(
        `
        SELECT id, statement AS title, statement AS text, confidence, created_at, source, metadata,
               1 - (embedding <=> $4::vector) AS semantic_score
        FROM memory_facts
        WHERE workspace_id = $1 AND ($2::text IS NULL OR project_id = $2) AND ($3::uuid IS NULL OR session_id = $3::uuid) AND status = 'active'
        ORDER BY embedding <=> $4::vector ASC NULLS LAST, created_at DESC
        LIMIT $5
        `,
        [options.workspaceId, options.projectId ?? null, options.sessionId ?? null, query, limitPerTable],
      );
      hits.push(...result.rows.map((row: Record<string, unknown>) => rowToHit("fact", row)));
    }

    if (kinds.has("summary")) {
      const result = await this.pool.query(
        `
        SELECT id, 'Session summary' AS title, summary AS text, confidence, created_at, source, metadata,
               1 - (embedding <=> $4::vector) AS semantic_score
        FROM memory_summaries
        WHERE workspace_id = $1 AND ($2::text IS NULL OR project_id = $2) AND ($3::uuid IS NULL OR session_id = $3::uuid) AND status = 'active'
        ORDER BY embedding <=> $4::vector ASC NULLS LAST, created_at DESC
        LIMIT $5
        `,
        [options.workspaceId, options.projectId ?? null, options.sessionId ?? null, query, limitPerTable],
      );
      hits.push(...result.rows.map((row: Record<string, unknown>) => rowToHit("summary", row)));
    }

    if (kinds.has("entity")) {
      const result = await this.pool.query(
        `
        SELECT id, canonical_name AS title, canonical_name AS text, confidence, created_at, source, metadata,
               1 - (embedding <=> $4::vector) AS semantic_score
        FROM memory_entities
        WHERE workspace_id = $1 AND ($2::text IS NULL OR project_id = $2) AND ($3::uuid IS NULL OR session_id = $3::uuid) AND status = 'active'
        ORDER BY embedding <=> $4::vector ASC NULLS LAST, created_at DESC
        LIMIT $5
        `,
        [options.workspaceId, options.projectId ?? null, options.sessionId ?? null, query, limitPerTable],
      );
      hits.push(...result.rows.map((row: Record<string, unknown>) => rowToHit("entity", row)));
    }

    if (kinds.has("relation")) {
      const result = await this.pool.query(
        `
        SELECT id, relation_type AS title, relation AS text, confidence, created_at, source, metadata,
               1 - (embedding <=> $4::vector) AS semantic_score
        FROM memory_relations
        WHERE workspace_id = $1 AND ($2::text IS NULL OR project_id = $2) AND ($3::uuid IS NULL OR session_id = $3::uuid) AND status = 'active'
        ORDER BY embedding <=> $4::vector ASC NULLS LAST, created_at DESC
        LIMIT $5
        `,
        [options.workspaceId, options.projectId ?? null, options.sessionId ?? null, query, limitPerTable],
      );
      hits.push(...result.rows.map((row: Record<string, unknown>) => rowToHit("relation", row)));
    }

    if (kinds.has("turn")) {
      const result = await this.pool.query(
        `
        SELECT id, role AS title, content AS text, confidence, created_at, source, metadata,
               1 - (embedding <=> $4::vector) AS semantic_score
        FROM memory_turns
        WHERE workspace_id = $1 AND ($2::text IS NULL OR project_id = $2) AND ($3::uuid IS NULL OR session_id = $3::uuid) AND status = 'active'
        ORDER BY embedding <=> $4::vector ASC NULLS LAST, created_at DESC
        LIMIT $5
        `,
        [options.workspaceId, options.projectId ?? null, options.sessionId ?? null, query, limitPerTable],
      );
      hits.push(...result.rows.map((row: Record<string, unknown>) => rowToHit("turn", row)));
    }

    return hits.sort((left, right) => right.score - left.score).slice(0, options.limit);
  }

  async recentTurns(sessionId: string, limit: number, projectId?: string): Promise<MemoryTurnRecord[]> {
    const result = await this.pool.query(
      `
      SELECT *
      FROM memory_turns
      WHERE session_id = $1 AND ($3::text IS NULL OR project_id = $3) AND status = 'active'
      ORDER BY turn_index DESC, created_at DESC
      LIMIT $2
      `,
      [sessionId, limit, projectId ?? null],
    );
    return result.rows.map(rowToTurnRecord);
  }

  async countSessionTurns(sessionId: string, projectId?: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT count(*)::int AS count FROM memory_turns WHERE session_id = $1 AND ($2::text IS NULL OR project_id = $2) AND status = 'active'`,
      [sessionId, projectId ?? null],
    );
    return result.rows[0]?.count ?? 0;
  }

  async prune(policy: MemoryPrunePolicy): Promise<number> {
    const archiveOlderThanDays = policy.archiveOlderThanDays ?? 30;
    const lowConfidenceThreshold = policy.lowConfidenceThreshold ?? 0.45;
    const keepRecentDays = policy.keepRecentDays ?? 7;
    const workspaceCondition = policy.workspaceId ? "AND workspace_id = $4" : "";
    const projectCondition = policy.projectId ? `AND project_id = $${policy.workspaceId ? 5 : 4}` : "";
    const params: Array<string | number> = [archiveOlderThanDays, lowConfidenceThreshold, keepRecentDays];
    if (policy.workspaceId) {
      params.push(policy.workspaceId);
    }
    if (policy.projectId) {
      params.push(policy.projectId);
    }

    const result = await this.pool.query(
      `
      WITH archived_turns AS (
        UPDATE memory_turns
        SET status = 'archived'
        WHERE status = 'active'
          AND created_at < now() - ($3 || ' days')::interval
          ${workspaceCondition}
          ${projectCondition}
        RETURNING 1
      ),
      archived_facts AS (
        UPDATE memory_facts
        SET status = 'archived'
        WHERE status = 'active'
          AND (confidence < $2 OR created_at < now() - ($1 || ' days')::interval)
          ${workspaceCondition}
          ${projectCondition}
        RETURNING 1
      ),
      archived_decisions AS (
        UPDATE memory_decisions
        SET status = 'archived'
        WHERE status = 'active'
          AND (confidence < $2 OR created_at < now() - ($1 || ' days')::interval)
          ${workspaceCondition}
          ${projectCondition}
        RETURNING 1
      ),
      archived_entities AS (
        UPDATE memory_entities
        SET status = 'archived'
        WHERE status = 'active'
          AND (confidence < $2 OR created_at < now() - ($1 || ' days')::interval)
          ${workspaceCondition}
          ${projectCondition}
        RETURNING 1
      ),
      archived_relations AS (
        UPDATE memory_relations
        SET status = 'archived'
        WHERE status = 'active'
          AND (confidence < $2 OR created_at < now() - ($1 || ' days')::interval)
          ${workspaceCondition}
          ${projectCondition}
        RETURNING 1
      ),
      archived_summaries AS (
        UPDATE memory_summaries
        SET status = 'archived'
        WHERE status = 'active'
          AND (confidence < $2 OR created_at < now() - ($1 || ' days')::interval)
          ${workspaceCondition}
          ${projectCondition}
        RETURNING 1
      )
      SELECT
        (SELECT count(*) FROM archived_turns)
        + (SELECT count(*) FROM archived_facts)
        + (SELECT count(*) FROM archived_decisions)
        + (SELECT count(*) FROM archived_entities)
        + (SELECT count(*) FROM archived_relations)
        + (SELECT count(*) FROM archived_summaries) AS changed
      `,
      params,
    );
    return result.rows[0]?.changed ?? 0;
  }
}

function toHit(
  kind: MemoryKind,
  id: string,
  title: string,
  text: string,
  confidence: number,
  source: string,
  createdAt: string,
  metadata: Record<string, unknown>,
  now: Date,
): StoredSearchHit {
  return {
    kind,
    id,
    title,
    text,
    confidence,
    score: confidence * 0.65 + recencyScore(createdAt, now) * 0.35,
    source,
    createdAt,
    metadata,
  };
}

function rowToHit(kind: MemoryKind, row: Record<string, unknown>): StoredSearchHit {
  return {
    kind,
    id: String(row.id),
    title: String(row.title),
    text: String(row.text),
    confidence: Number(row.confidence),
    score: Number(row.semantic_score ?? 0) * 0.7 + Number(row.confidence) * 0.2 + recencyScore(String(row.created_at), new Date()) * 0.1,
    source: String(row.source),
    createdAt: String(row.created_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function recencyScore(createdAt: string, now: Date): number {
  const ageDays = Math.max((now.getTime() - new Date(createdAt).getTime()) / 86_400_000, 0);
  return 1 / (1 + ageDays);
}

function toVectorLiteral(vector: number[] | null): string | null {
  if (!vector) return null;
  return `[${vector.map((value) => (Number.isFinite(value) ? value.toFixed(8) : "0")).join(",")}]`;
}

function rowToTurnRecord(row: Record<string, unknown>): MemoryTurnRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: row.project_id == null ? undefined : String(row.project_id),
    sessionId: String(row.session_id),
    turnIndex: Number(row.turn_index),
    role: row.role as MemoryTurnRecord["role"],
    content: String(row.content),
    embedding: null,
    confidence: Number(row.confidence),
    source: String(row.source),
    status: row.status as MemoryStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

function rowToCandidateRecord(row: Record<string, unknown>): MemoryCandidateRecord {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    workspaceId: String(row.workspace_id),
    projectId: row.project_id == null ? undefined : String(row.project_id),
    sessionId: row.session_id == null ? undefined : String(row.session_id),
    type: row.type as MemoryCandidateRecord["type"],
    title: String(row.title),
    summary: String(row.summary),
    evidence: Array.isArray(row.evidence) ? row.evidence.map(String) : [],
    confidence: Number(row.confidence),
    suggestedDestination: row.suggested_destination as MemoryCandidateRecord["suggestedDestination"],
    conflictsWith: Array.isArray(row.conflicts_with) ? row.conflicts_with.map(String) : [],
    status: row.status as MemoryCandidateRecord["status"],
    model: row.model == null ? undefined : String(row.model),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    reviewedAt: row.reviewed_at == null ? null : String(row.reviewed_at),
    reviewedBy: row.reviewed_by == null ? null : String(row.reviewed_by),
    reviewNote: row.review_note == null ? null : String(row.review_note),
    destinationRecordId: row.destination_record_id == null ? null : String(row.destination_record_id),
  };
}

function reviewActionToStatus(action: MemoryReviewInput["action"]): MemoryCandidateRecord["status"] {
  switch (action) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "merge":
      return "merged";
    case "mark_stale":
      return "stale";
  }
}

function matchesScope(
  recordWorkspaceId: string,
  recordProjectId: string | undefined,
  requestedWorkspaceId: string,
  requestedProjectId?: string,
): boolean {
  if (recordWorkspaceId !== requestedWorkspaceId) return false;
  if (requestedProjectId === undefined) return true;
  return recordProjectId === requestedProjectId;
}

function matchesSession(recordSessionId: string | undefined, requestedSessionId?: string): boolean {
  if (requestedSessionId === undefined) return true;
  return recordSessionId === requestedSessionId;
}
