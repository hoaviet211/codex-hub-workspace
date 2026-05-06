import type {
  DecisionDraft,
  EmbeddingProvider,
  EntityDraft,
  FactDraft,
  MemoryContextItem,
  MemoryCandidateInput,
  MemoryCandidateListOptions,
  MemoryCandidateRecord,
  MemoryDecisionRecord,
  MemoryEntityRecord,
  MemoryExtractor,
  MemoryFactRecord,
  MemoryPrunePolicy,
  MemoryPromoteInput,
  MemoryRecordTurnResult,
  MemoryRelationRecord,
  MemorySearchOptions,
  MemorySourceInput,
  MemorySourceRecord,
  MemoryItemRecord,
  MemorySummaryRecord,
  MemoryTurnInput,
  MemoryTurnRecord,
  RelationDraft,
  RetrievedContext,
} from "./types.js";
import { dedupeContextItems, scoreCandidate } from "./rank.js";
import { nowIso, uuid } from "./utils.js";
import type { MemoryStore } from "./storage.js";

export interface MemoryServiceOptions {
  summaryAfterTurns?: number;
  retrievalLimit?: number;
  summaryWindowTurns?: number;
}

export class MemoryService {
  constructor(
    private readonly store: MemoryStore,
    private readonly embedder: EmbeddingProvider,
    private readonly extractor: MemoryExtractor,
    private readonly options: MemoryServiceOptions = {},
  ) {}

  async init(): Promise<void> {
    await this.store.init();
  }

  async recordTurn(input: MemoryTurnInput): Promise<MemoryRecordTurnResult> {
    const sessionId = input.sessionId ?? input.workspaceId;
    await this.store.upsertSession({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sessionId,
      userId: input.userId,
      metadata: input.metadata,
    });

    const embedding = await this.embedder.embed(input.content);
    const turn: MemoryTurnRecord = {
      id: uuid(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sessionId,
      role: input.role,
      content: input.content,
      turnIndex: input.turnIndex,
      embedding,
      confidence: 1,
      source: "turn",
      status: "active",
      metadata: input.metadata ?? {},
      createdAt: nowIso(),
    };

    await this.store.addTurn(turn);

    const extraction = await this.extractor.extract(input);
    const facts = await Promise.all(extraction.facts.map((draft) => this.store.addFact(buildFactRecord(draft, input, embedding, turn.id))));
    const decisions = await Promise.all(extraction.decisions.map((draft) => this.store.addDecision(buildDecisionRecord(draft, input, embedding, turn.id))));
    const entities = await Promise.all(extraction.entities.map((draft) => this.store.addEntity(buildEntityRecord(draft, input, embedding, turn.id))));
    const relations = await Promise.all(extraction.relations.map((draft) => this.store.addRelation(buildRelationRecord(draft, input, embedding, turn.id, entities))));

    const summary = (await this.shouldSummarizeSession(sessionId, input.projectId)) ? await this.summarizeSession(sessionId, input.workspaceId, input.projectId) : null;
    const context = await this.retrieveContext({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sessionId,
      query: input.content,
      limit: this.options.retrievalLimit ?? 8,
      kinds: ["item", "decision", "fact", "summary", "entity", "relation", "turn"],
    });

    return { turn, facts, decisions, entities, relations, summary, context };
  }

  async retrieveContext(options: MemorySearchOptions): Promise<RetrievedContext> {
    const queryEmbedding = await this.embedder.embed(options.query);
    const hits = await this.store.search({
      workspaceId: options.workspaceId,
      projectId: options.projectId,
      sessionId: options.sessionId,
      queryEmbedding,
      limit: options.limit ?? this.options.retrievalLimit ?? 8,
      kinds: options.kinds,
    });

    const items: MemoryContextItem[] = dedupeContextItems(
      hits.map((hit) => ({
        kind: hit.kind,
        id: hit.id,
        title: hit.title,
        text: hit.text,
        confidence: hit.confidence,
        score:
          scoreCandidate({
            queryEmbedding,
            candidateEmbedding: null,
            confidence: hit.confidence,
            createdAt: hit.createdAt,
            kind: hit.kind,
            text: hit.text,
          }) + hit.score,
        source: hit.source,
        createdAt: hit.createdAt,
        metadata: hit.metadata,
      })),
    ).slice(0, options.limit ?? this.options.retrievalLimit ?? 8);

    return { query: options.query, items };
  }

  async summarizeSession(sessionId: string, workspaceId: string, projectId?: string): Promise<MemorySummaryRecord | null> {
    const turns = await this.store.recentTurns(sessionId, this.options.summaryWindowTurns ?? 12, projectId);
    if (turns.length === 0) return null;

    const ordered = [...turns].sort((left, right) => left.turnIndex - right.turnIndex);
    const bulletPoints = ordered.map((turn) => {
      const trimmed = turn.content.trim().replace(/\s+/g, " ");
      return `- ${turn.role}: ${trimmed.slice(0, 140)}`;
    });
    const summaryText = bulletPoints.join("\n");
    const summaryEmbedding = await this.embedder.embed(summaryText);
    const now = nowIso();

    const summary: MemorySummaryRecord = {
      id: uuid(),
      workspaceId,
      projectId,
      sessionId,
      summary: summaryText,
      confidence: 0.78,
      source: "session-summarizer",
      embedding: summaryEmbedding,
      metadata: {
        turnCount: turns.length,
        window: this.options.summaryWindowTurns ?? 12,
      },
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    await this.store.addSummary(summary);
    return summary;
  }

  async pruneMemory(policy: MemoryPrunePolicy): Promise<number> {
    return this.store.prune(policy);
  }

  async addSource(input: MemorySourceInput): Promise<MemorySourceRecord> {
    if (!input.workspaceId || !input.sourceType || !input.sourcePath || !input.sourceHash) {
      throw new Error("Source requires workspaceId, sourceType, sourcePath, and sourceHash");
    }
    const source: MemorySourceRecord = {
      id: uuid(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sessionId: input.sessionId,
      sourceType: input.sourceType,
      sourcePath: input.sourcePath,
      sourceHash: input.sourceHash,
      metadata: input.metadata ?? {},
      capturedAt: nowIso(),
    };
    return this.store.addSource(source);
  }

  async proposeCandidate(input: MemoryCandidateInput): Promise<MemoryCandidateRecord> {
    validateCandidateInput(input);
    const candidate: MemoryCandidateRecord = {
      id: uuid(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sessionId: input.sessionId,
      sourceId: input.sourceId,
      type: input.type,
      title: input.title,
      summary: input.summary,
      evidence: input.evidence,
      confidence: input.confidence,
      suggestedDestination: input.suggestedDestination,
      conflictsWith: input.conflictsWith ?? [],
      status: "proposed",
      model: input.model,
      metadata: input.metadata ?? {},
      createdAt: nowIso(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
      destinationRecordId: null,
    };
    return this.store.addCandidate(candidate);
  }

  async listCandidates(options: MemoryCandidateListOptions): Promise<MemoryCandidateRecord[]> {
    return this.store.listCandidates(options);
  }

  async reviewCandidate(input: { candidateId: string; action: "approve" | "reject" | "merge" | "mark_stale"; reviewer: string; note?: string | null }): Promise<MemoryCandidateRecord> {
    return this.store.reviewCandidate(input);
  }

  async promoteCandidate(input: MemoryPromoteInput): Promise<MemoryItemRecord> {
    const candidate = await this.store.getCandidate(input.candidateId);
    if (!candidate) {
      throw new Error(`Candidate ${input.candidateId} not found`);
    }
    if (candidate.status !== "approved") {
      throw new Error(`Candidate ${input.candidateId} must be approved before promotion`);
    }
    if (candidate.suggestedDestination !== "memory-service") {
      throw new Error(`Candidate ${input.candidateId} destination is ${candidate.suggestedDestination}, not memory-service`);
    }

    const now = nowIso();
    const body = candidate.summary;
    const item: MemoryItemRecord = {
      id: uuid(),
      workspaceId: candidate.workspaceId,
      projectId: candidate.projectId,
      sessionId: candidate.sessionId,
      type: candidate.type,
      title: candidate.title,
      body,
      evidence: candidate.evidence,
      sourceCandidateId: candidate.id,
      embedding: await this.embedder.embed(`${candidate.title}\n${body}`),
      confidence: candidate.confidence,
      status: "active",
      metadata: { ...candidate.metadata, model: candidate.model ?? null },
      createdAt: now,
      updatedAt: now,
    };
    return this.store.promoteCandidate({ ...input, item });
  }

  private async shouldSummarizeSession(sessionId: string, projectId?: string): Promise<boolean> {
    const turnCount = await this.store.countSessionTurns(sessionId, projectId);
    const threshold = this.options.summaryAfterTurns ?? 6;
    return turnCount > 0 && turnCount % threshold === 0;
  }
}

function validateCandidateInput(input: MemoryCandidateInput): void {
  if (!input.workspaceId || !input.sourceId || !input.type || !input.title || !input.summary || !input.suggestedDestination) {
    throw new Error("Candidate requires workspaceId, sourceId, type, title, summary, and suggestedDestination");
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0 || !input.evidence.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error("Candidate evidence must be a non-empty string array");
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("Candidate confidence must be between 0 and 1");
  }
  if (input.conflictsWith !== undefined && (!Array.isArray(input.conflictsWith) || !input.conflictsWith.every((item) => typeof item === "string"))) {
    throw new Error("Candidate conflictsWith must be a string array when provided");
  }
}

function buildFactRecord(draft: FactDraft, input: MemoryTurnInput, embedding: number[], sourceTurnId: string): MemoryFactRecord {
  const now = nowIso();
  return {
    id: uuid(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sessionId: input.sessionId ?? input.workspaceId,
    subject: draft.subject,
    predicate: draft.predicate,
    object: draft.object,
    statement: draft.statement,
    confidence: draft.confidence,
    source: "extracted",
    sourceTurnId,
    embedding,
    metadata: draft.metadata ?? {},
    validFrom: draft.validFrom ?? null,
    validTo: draft.validTo ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function buildDecisionRecord(draft: DecisionDraft, input: MemoryTurnInput, embedding: number[], sourceTurnId: string): MemoryDecisionRecord {
  const now = nowIso();
  return {
    id: uuid(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sessionId: input.sessionId ?? input.workspaceId,
    taskId: draft.taskId ?? input.taskId,
    title: draft.title,
    decision: draft.decision,
    confidence: draft.confidence,
    source: "extracted",
    sourceTurnId,
    embedding,
    metadata: draft.metadata ?? {},
    validFrom: draft.validFrom ?? null,
    validTo: draft.validTo ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function buildEntityRecord(draft: EntityDraft, input: MemoryTurnInput, embedding: number[], sourceTurnId: string): MemoryEntityRecord {
  const now = nowIso();
  return {
    id: uuid(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sessionId: input.sessionId ?? input.workspaceId,
    canonicalName: draft.canonicalName,
    entityType: draft.entityType,
    aliases: draft.aliases,
    confidence: draft.confidence,
    source: "extracted",
    sourceTurnId,
    embedding,
    metadata: draft.metadata ?? {},
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function buildRelationRecord(
  draft: RelationDraft,
  input: MemoryTurnInput,
  embedding: number[],
  sourceTurnId: string,
  entities: MemoryEntityRecord[],
): MemoryRelationRecord {
  const now = nowIso();
  const fromEntity = entities.find((entity) => entity.canonicalName === draft.fromEntityName);
  const toEntity = entities.find((entity) => entity.canonicalName === draft.toEntityName);
  return {
    id: uuid(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sessionId: input.sessionId ?? input.workspaceId,
    fromEntityId: fromEntity?.id ?? uuid(),
    relationType: draft.relationType,
    toEntityId: toEntity?.id ?? uuid(),
    relation: draft.relation,
    confidence: draft.confidence,
    source: "extracted",
    sourceTurnId,
    embedding,
    metadata: draft.metadata ?? {},
    validFrom: draft.validFrom ?? null,
    validTo: draft.validTo ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}
