import { z } from "zod";

export const SeveritySchema = z.enum(["info", "warn", "block"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ActionStatusSchema = z.enum(["pending", "approved", "rejected", "executed", "failed"]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const ActionTypeSchema = z.enum([
  "update_registry",
  "fix_encoding",
  "clean_dirty_files",
  "create_missing_project",
  "create_task_note",
  "review_closed_task",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const MemoryCandidateStatusSchema = z.enum(["proposed", "approved", "rejected", "merged", "stale"]);
export type MemoryCandidateStatus = z.infer<typeof MemoryCandidateStatusSchema>;

export const MemoryCandidateSchema = z.object({
  id: z.string(),
  type: z.string(),
  scope: z.object({
    workspaceId: z.string(),
    projectId: z.string().optional(),
    sessionId: z.string().nullable().optional(),
  }),
  title: z.string(),
  summary: z.string(),
  evidence: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  suggestedDestination: z.string(),
  conflictsWith: z.array(z.string()).default([]),
  status: MemoryCandidateStatusSchema,
  createdAt: z.string(),
  reviewedAt: z.string().nullable().optional(),
  reviewedBy: z.string().nullable().optional(),
  reviewNote: z.string().nullable().optional(),
  destinationRecordId: z.string().nullable().optional(),
  sourcePath: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
});
export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;

export const ScopeSchema = z.enum(["workspace", "project", "task"]);
export type Scope = z.infer<typeof ScopeSchema>;

export const ReadinessSchema = z.enum(["ready", "blocked", "needs_review"]);
export type Readiness = z.infer<typeof ReadinessSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const DataCompletenessSchema = z.enum(["complete", "partial", "empty"]);
export type DataCompleteness = z.infer<typeof DataCompletenessSchema>;

export const PrimaryActionKindSchema = z.enum(["review", "fix", "prepare", "manual"]);
export type PrimaryActionKind = z.infer<typeof PrimaryActionKindSchema>;

export const AgentCostSchema = z.enum(["low", "medium", "high"]);
export type AgentCost = z.infer<typeof AgentCostSchema>;

export const AgentUrgencySchema = z.enum(["immediate", "soon", "later"]);
export type AgentUrgency = z.infer<typeof AgentUrgencySchema>;

export const AgentStaleMetaSchema = z.object({
  generatedAt: z.string(),
  sourceScanAt: z.string().nullable(),
  stale: z.boolean(),
  staleReason: z.string().nullable(),
  dataCompleteness: DataCompletenessSchema,
});
export type AgentStaleMeta = z.infer<typeof AgentStaleMetaSchema>;

export const CheckFindingSchema = z.object({
  id: z.string(),
  severity: SeveritySchema,
  category: z.enum(["git", "registry", "workspace", "encoding", "process", "security"]),
  title: z.string(),
  evidence: z.string(),
  target: z.string().optional(),
  suggestedActionType: ActionTypeSchema.optional(),
});
export type CheckFinding = z.infer<typeof CheckFindingSchema>;

export const ActionRequestSchema = z.object({
  id: z.string(),
  type: ActionTypeSchema,
  title: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  target: z.string(),
  dedupeKey: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  intent: z.string(),
  rollback: z.string(),
  status: ActionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export const EventRecordSchema = z.object({
  id: z.string(),
  type: z.enum(["scan_started", "scan_completed", "action_created", "action_updated", "error"]),
  timestamp: z.string(),
  source: z.enum(["api", "ui", "check-engine", "gemma-worker"]),
  correlationId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
});
export type EventRecord = z.infer<typeof EventRecordSchema>;

export const AgentMetaSchema = z.object({
  confidence: z.number().min(0).max(1),
  confidenceReason: z.string(),
  readyState: ReadinessSchema,
  blockedBy: z.array(z.string()),
  dedupeKey: z.string().min(1),
  manualOnly: z.boolean(),
  cost: AgentCostSchema.optional(),
  urgency: AgentUrgencySchema.optional(),
  decisionTrace: z.array(z.string()).optional(),
});
export type AgentMeta = z.infer<typeof AgentMetaSchema>;

export const PrimaryActionSchema = z.object({
  type: PrimaryActionKindSchema,
  target: z.string().min(1),
  actionType: ActionTypeSchema,
  reason: z.string().min(1),
  dedupeKey: z.string().min(1),
});
export type PrimaryAction = z.infer<typeof PrimaryActionSchema>;

export const AgentRecommendationSchema = z.object({
  id: z.string(),
  scope: ScopeSchema,
  findingId: z.string(),
  category: z.enum(["git", "registry", "workspace", "encoding", "process", "security"]),
  severity: SeveritySchema,
  title: z.string(),
  risk: RiskLevelSchema,
  evidence: z.array(z.string()).min(1),
  target: z.string(),
  primaryAction: PrimaryActionSchema,
}).merge(AgentMetaSchema);
export type AgentRecommendation = z.infer<typeof AgentRecommendationSchema>;

export const ContextBriefSchema = z.object({
  scope: ScopeSchema,
  verbosity: z.enum(["compact"]),
  summary: z.object({
    health: z.enum(["unknown", "ok", "warn", "block"]),
    projects: z.number().int().nonnegative(),
    tasks: z.number().int().nonnegative(),
    activeTasks: z.number().int().nonnegative(),
    findings: z.number().int().nonnegative(),
    pendingActions: z.number().int().nonnegative(),
    dirtyFiles: z.number().int().nonnegative(),
  }),
  focus: z.object({
    projectId: z.string().optional(),
    taskId: z.string().optional(),
    target: z.string().optional(),
  }).optional(),
  topFindings: z.array(CheckFindingSchema.pick({
    id: true,
    severity: true,
    category: true,
    title: true,
    evidence: true,
    target: true,
  })).max(12),
}).merge(AgentStaleMetaSchema);
export type ContextBrief = z.infer<typeof ContextBriefSchema>;

export const TaskContextSchema = z.object({
  id: z.string(),
  title: z.string(),
  path: z.string(),
  status: z.string(),
  project: z.string().optional(),
  hasAcceptanceCriteria: z.boolean(),
  hasDoneCriteria: z.boolean(),
  updatedAt: z.string().optional(),
  missingFields: z.array(z.enum(["acceptanceCriteria", "doneCriteria"])),
  riskLevel: RiskLevelSchema,
  relatedFiles: z.array(z.string()),
}).merge(AgentStaleMetaSchema);
export type TaskContext = z.infer<typeof TaskContextSchema>;

export const ProjectContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  localPath: z.string(),
  githubRepo: z.string(),
  visibility: z.string(),
  status: z.string(),
  lastUpdated: z.string(),
  exists: z.boolean(),
  registryInfo: z.object({
    registered: z.boolean(),
    registryPath: z.string(),
    githubRepo: z.string(),
    visibility: z.string(),
    status: z.string(),
    lastUpdated: z.string(),
  }),
  relatedTasks: z.array(z.object({
    id: z.string(),
    path: z.string(),
    status: z.string(),
  })),
  relatedDirtyFiles: z.array(z.string()),
}).merge(AgentStaleMetaSchema);
export type ProjectContext = z.infer<typeof ProjectContextSchema>;

export const SourceMapSchema = z.object({
  scope: ScopeSchema,
  hubRoot: z.string(),
  entries: z.array(z.object({
    key: z.string(),
    path: z.string(),
    exists: z.boolean(),
    kind: z.enum(["policy", "registry", "workspace", "runtime", "project"]),
  })),
}).merge(AgentStaleMetaSchema);
export type SourceMap = z.infer<typeof SourceMapSchema>;

export const AgentBootstrapSchema = z.object({
  contractVersion: z.literal("1.5"),
  limits: z.object({
    localhostOnly: z.literal(true),
    commandExecution: z.literal(false),
    manualOnlyDefault: z.literal(true),
    mutationScope: z.literal(".orchestrator"),
  }),
  brief: ContextBriefSchema,
  nextSteps: z.array(AgentRecommendationSchema),
  activeTasks: z.array(TaskContextSchema),
  sourceMapLite: SourceMapSchema,
}).merge(AgentStaleMetaSchema);
export type AgentBootstrap = z.infer<typeof AgentBootstrapSchema>;

export interface ProjectRecord {
  id: string;
  name: string;
  localPath: string;
  githubRepo: string;
  visibility: string;
  status: string;
  lastUpdated: string;
  exists: boolean;
}

export interface TaskRecord {
  id: string;
  title: string;
  path: string;
  status: string;
  project?: string;
  hasAcceptanceCriteria: boolean;
  hasDoneCriteria: boolean;
  updatedAt?: string;
}

export interface WorkspaceSnapshot {
  hubRoot: string;
  scannedAt: string;
  git: {
    dirty: boolean;
    changedFiles: string[];
    error?: string;
  };
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  artifacts: { count: number; recent: string[] };
  configPresent: boolean;
  agentsPresent: boolean;
  workflowsPresent: boolean;
}

export interface CheckRun {
  id: string;
  scannedAt: string;
  findings: CheckFinding[];
  summary: {
    info: number;
    warn: number;
    block: number;
  };
  snapshot: WorkspaceSnapshot;
}

export interface WorkspaceOverview {
  scannedAt?: string;
  health: "unknown" | "ok" | "warn" | "block";
  counts: {
    projects: number;
    tasks: number;
    findings: number;
    actionsPending: number;
  };
  topFindings: CheckFinding[];
  digest?: string;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
