export type MemoryRole = "user" | "assistant" | "system" | "tool";
export type MemoryKind = "turn" | "summary" | "fact" | "decision" | "entity" | "relation" | "item";
export type MemoryStatus = "active" | "superseded" | "archived" | "deleted";
export type MemoryCandidateStatus = "proposed" | "approved" | "rejected" | "merged" | "stale";
export type MemoryCandidateType = "user_preference" | "project_decision" | "failure_pattern" | "reusable_workflow" | "source_summary";
export type MemoryCandidateDestination = "memory-service" | "obsidian" | "AGENTS.md" | "config.yaml" | "workflows" | "ignore";
export type MemoryReviewAction = "approve" | "reject" | "merge" | "mark_stale" | "promote";
export type MemorySourceType = "task" | "artifact" | "digest" | "transcript" | "lco_export" | "manual";

export interface MemoryMetadata {
  [key: string]: unknown;
}

export interface WorkspaceContext {
  workspaceId: string;
  projectId?: string;
  userId?: string;
  sessionId?: string;
  taskId?: string;
}

export interface MemoryTurnInput extends WorkspaceContext {
  role: MemoryRole;
  content: string;
  turnIndex: number;
  metadata?: MemoryMetadata;
}

export interface MemoryTurnRecord extends MemoryTurnInput {
  id: string;
  embedding: number[] | null;
  confidence: number;
  source: string;
  status: MemoryStatus;
  metadata: MemoryMetadata;
  createdAt: string;
}

export interface MemoryFactRecord extends WorkspaceContext {
  id: string;
  subject: string;
  predicate: string;
  object: string | null;
  statement: string;
  confidence: number;
  source: string;
  sourceTurnId?: string;
  embedding: number[] | null;
  metadata: MemoryMetadata;
  validFrom: string | null;
  validTo: string | null;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryDecisionRecord extends WorkspaceContext {
  id: string;
  taskId?: string;
  title: string;
  decision: string;
  confidence: number;
  source: string;
  sourceTurnId?: string;
  embedding: number[] | null;
  metadata: MemoryMetadata;
  validFrom: string | null;
  validTo: string | null;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEntityRecord extends WorkspaceContext {
  id: string;
  canonicalName: string;
  entityType: string;
  aliases: string[];
  confidence: number;
  source: string;
  sourceTurnId?: string;
  embedding: number[] | null;
  metadata: MemoryMetadata;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRelationRecord extends WorkspaceContext {
  id: string;
  fromEntityId: string;
  relationType: string;
  toEntityId: string;
  relation: string;
  confidence: number;
  source: string;
  sourceTurnId?: string;
  embedding: number[] | null;
  metadata: MemoryMetadata;
  validFrom: string | null;
  validTo: string | null;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySummaryRecord extends WorkspaceContext {
  id: string;
  summary: string;
  confidence: number;
  source: string;
  embedding: number[] | null;
  metadata: MemoryMetadata;
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySourceRecord extends WorkspaceContext {
  id: string;
  sourceType: MemorySourceType;
  sourcePath: string;
  sourceHash: string;
  metadata: MemoryMetadata;
  capturedAt: string;
}

export interface MemoryCandidateRecord extends WorkspaceContext {
  id: string;
  sourceId: string;
  type: MemoryCandidateType;
  title: string;
  summary: string;
  evidence: string[];
  confidence: number;
  suggestedDestination: MemoryCandidateDestination;
  conflictsWith: string[];
  status: MemoryCandidateStatus;
  model?: string;
  metadata: MemoryMetadata;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  destinationRecordId: string | null;
}

export interface MemoryReviewRecord {
  id: string;
  candidateId: string;
  action: MemoryReviewAction;
  reviewer: string;
  note: string | null;
  createdAt: string;
}

export interface MemoryItemRecord extends WorkspaceContext {
  id: string;
  type: MemoryCandidateType;
  title: string;
  body: string;
  evidence: string[];
  sourceCandidateId: string;
  embedding: number[] | null;
  confidence: number;
  status: "active" | "stale" | "archived";
  metadata: MemoryMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryContextItem {
  kind: MemoryKind;
  id: string;
  title: string;
  text: string;
  confidence: number;
  score: number;
  source: string;
  createdAt: string;
  metadata: MemoryMetadata;
}

export interface MemorySourceInput extends WorkspaceContext {
  sourceType: MemorySourceType;
  sourcePath: string;
  sourceHash: string;
  metadata?: MemoryMetadata;
}

export interface MemoryCandidateInput extends WorkspaceContext {
  sourceId: string;
  type: MemoryCandidateType;
  title: string;
  summary: string;
  evidence: string[];
  confidence: number;
  suggestedDestination: MemoryCandidateDestination;
  conflictsWith?: string[];
  model?: string;
  metadata?: MemoryMetadata;
}

export interface MemoryCandidateListOptions extends WorkspaceContext {
  status?: MemoryCandidateStatus;
}

export interface MemoryReviewInput {
  candidateId: string;
  action: Exclude<MemoryReviewAction, "promote">;
  reviewer: string;
  note?: string | null;
}

export interface MemoryPromoteInput {
  candidateId: string;
  reviewer: string;
  note?: string | null;
}

export interface RetrievedContext {
  query: string;
  items: MemoryContextItem[];
}

export interface MemoryPrunePolicy {
  workspaceId?: string;
  projectId?: string;
  archiveOlderThanDays?: number;
  lowConfidenceThreshold?: number;
  keepRecentDays?: number;
}

export interface MemoryRecordTurnResult {
  turn: MemoryTurnRecord;
  facts: MemoryFactRecord[];
  decisions: MemoryDecisionRecord[];
  entities: MemoryEntityRecord[];
  relations: MemoryRelationRecord[];
  summary?: MemorySummaryRecord | null;
  context: RetrievedContext;
}

export interface MemoryExtractor {
  extract(input: MemoryTurnInput): Promise<MemoryExtraction>;
}

export interface MemoryExtraction {
  facts: FactDraft[];
  decisions: DecisionDraft[];
  entities: EntityDraft[];
  relations: RelationDraft[];
  summaryHint?: string;
}

export interface FactDraft {
  subject: string;
  predicate: string;
  object: string | null;
  statement: string;
  confidence: number;
  validFrom?: string | null;
  validTo?: string | null;
  metadata?: MemoryMetadata;
}

export interface DecisionDraft {
  title: string;
  decision: string;
  confidence: number;
  taskId?: string;
  validFrom?: string | null;
  validTo?: string | null;
  metadata?: MemoryMetadata;
}

export interface EntityDraft {
  canonicalName: string;
  entityType: string;
  aliases: string[];
  confidence: number;
  metadata?: MemoryMetadata;
}

export interface RelationDraft {
  fromEntityName: string;
  toEntityName: string;
  relationType: string;
  relation: string;
  confidence: number;
  validFrom?: string | null;
  validTo?: string | null;
  metadata?: MemoryMetadata;
}

export interface EmbeddingProvider {
  dimensions: number | null;
  embed(text: string): Promise<number[]>;
}

export interface MemorySearchOptions {
  workspaceId: string;
  projectId?: string;
  sessionId?: string;
  query: string;
  limit?: number;
  kinds?: MemoryKind[];
}
