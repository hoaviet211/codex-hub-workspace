import { existsSync } from "node:fs";
import {
  type ActionType,
  type AgentBootstrap,
  type AgentRecommendation,
  type AgentStaleMeta,
  type CheckFinding,
  type ContextBrief,
  type DataCompleteness,
  type PrimaryAction,
  type PrimaryActionKind,
  type ProjectContext,
  type ProjectRecord,
  type Scope,
  type SourceMap,
  type TaskContext,
  type TaskRecord,
  type WorkspaceSnapshot,
} from "../shared/schemas";
import { runChecks } from "./check-engine";
import { HUB_ROOT, ORCHESTRATOR_ROOT, safeResolveInsideHub } from "./paths";
import { listActions, readLatestCheckRun } from "./storage";
import { readWorkspaceSnapshot } from "./workspace-adapter";

const STALE_THRESHOLD_MS = 15 * 60 * 1000;
const DEFAULT_RECOMMENDATION_LIMIT = 8;
const DEFAULT_TASK_CONTEXT_LIMIT = 12;

interface ReadModelBase {
  snapshot: WorkspaceSnapshot;
  findings: CheckFinding[];
  sourceScanAt: string | null;
  staleMeta: AgentStaleMeta;
}

function compareSeverity(a: CheckFinding, b: CheckFinding): number {
  const order = { block: 0, warn: 1, info: 2 };
  return order[a.severity] - order[b.severity] || a.id.localeCompare(b.id);
}

function mapSeverityToRisk(severity: CheckFinding["severity"]): "low" | "medium" | "high" {
  if (severity === "block") return "high";
  if (severity === "warn") return "medium";
  return "low";
}

function mapActionType(finding: CheckFinding): ActionType {
  if (finding.suggestedActionType) return finding.suggestedActionType;
  if (finding.severity === "block") return "create_missing_project";
  if (finding.severity === "warn") return "create_task_note";
  return "review_closed_task";
}

function mapActionKind(actionType: ActionType): PrimaryActionKind {
  switch (actionType) {
    case "clean_dirty_files":
    case "fix_encoding":
      return "fix";
    case "review_closed_task":
      return "review";
    case "update_registry":
    case "create_missing_project":
    case "create_task_note":
      return "prepare";
    default:
      return "manual";
  }
}

function dedupeKeyForFinding(findingId: string, actionType: string): string {
  return `finding:${findingId}:${actionType}`;
}

function scoreConfidence(finding: CheckFinding, stale: boolean): number {
  const base = finding.severity === "block" ? 0.92 : finding.severity === "warn" ? 0.82 : 0.74;
  const adjusted = stale ? base - 0.2 : base;
  return Number(Math.max(0.2, Math.min(1, adjusted)).toFixed(2));
}

function computeStaleMeta(sourceScanAt: string | null, hasPersistedRun: boolean): AgentStaleMeta {
  const now = new Date();
  const age = sourceScanAt ? now.getTime() - new Date(sourceScanAt).getTime() : Number.POSITIVE_INFINITY;
  const staleByAge = Number.isFinite(age) ? age > STALE_THRESHOLD_MS : true;
  const stale = !hasPersistedRun || staleByAge;
  const staleReason = !hasPersistedRun
    ? "latest check run is missing; using live snapshot fallback"
    : staleByAge
      ? `source scan older than ${Math.floor(STALE_THRESHOLD_MS / 60000)} minutes`
      : null;

  let dataCompleteness: DataCompleteness = "complete";
  if (!hasPersistedRun) dataCompleteness = sourceScanAt ? "partial" : "empty";
  if (!sourceScanAt) dataCompleteness = "empty";

  return {
    generatedAt: now.toISOString(),
    sourceScanAt,
    stale,
    staleReason,
    dataCompleteness,
  };
}

function normalizeSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    ...snapshot,
    projects: [...snapshot.projects].sort((a, b) => a.id.localeCompare(b.id)),
    tasks: [...snapshot.tasks].sort((a, b) => a.id.localeCompare(b.id)),
    git: {
      ...snapshot.git,
      changedFiles: [...snapshot.git.changedFiles].sort((a, b) => a.localeCompare(b)),
    },
  };
}

async function loadReadModelBase(): Promise<ReadModelBase> {
  const latest = await readLatestCheckRun();
  if (latest) {
    const findings = [...latest.findings].sort(compareSeverity);
    const snapshot = normalizeSnapshot(latest.snapshot);
    return {
      findings,
      snapshot,
      sourceScanAt: latest.scannedAt,
      staleMeta: computeStaleMeta(latest.scannedAt, true),
    };
  }

  const snapshot = normalizeSnapshot(await readWorkspaceSnapshot());
  const findings = runChecks(snapshot).sort(compareSeverity);
  return {
    findings,
    snapshot,
    sourceScanAt: snapshot.scannedAt,
    staleMeta: computeStaleMeta(snapshot.scannedAt, false),
  };
}

function resolveHealth(findings: CheckFinding[]): "unknown" | "ok" | "warn" | "block" {
  if (findings.some((item) => item.severity === "block")) return "block";
  if (findings.some((item) => item.severity === "warn")) return "warn";
  if (findings.length > 0) return "ok";
  return "unknown";
}

function deriveTaskContext(task: TaskRecord, snapshot: WorkspaceSnapshot, staleMeta: AgentStaleMeta): TaskContext {
  const missingFields: Array<"acceptanceCriteria" | "doneCriteria"> = [];
  if (!task.hasAcceptanceCriteria) missingFields.push("acceptanceCriteria");
  if (!task.hasDoneCriteria) missingFields.push("doneCriteria");

  const riskLevel = missingFields.length >= 2 ? "high" : missingFields.length === 1 ? "medium" : "low";

  const project = snapshot.projects.find((item) => item.id === task.project || item.name === task.project);
  const relatedDirtyFiles = snapshot.git.changedFiles.filter((file) =>
    file === task.path
    || (project?.localPath ? file.startsWith(project.localPath.replace(/\/+$/, "")) : false)
    || file.includes(task.id),
  );
  const relatedFiles = Array.from(new Set([task.path, ...(project ? [project.localPath] : []), ...relatedDirtyFiles]))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 12);

  return {
    ...task,
    missingFields,
    riskLevel,
    relatedFiles,
    ...staleMeta,
  };
}

function deriveProjectContext(
  project: ProjectRecord,
  snapshot: WorkspaceSnapshot,
  includeDirty: boolean,
  staleMeta: AgentStaleMeta,
): ProjectContext {
  const relatedTasks = snapshot.tasks
    .filter((task) => task.project === project.id || task.project === project.name)
    .map((task) => ({ id: task.id, path: task.path, status: task.status }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const normalizedProjectPath = project.localPath.replace(/\/+$/, "");
  const relatedDirtyFiles = includeDirty
    ? snapshot.git.changedFiles.filter((file) => file.startsWith(normalizedProjectPath)).sort((a, b) => a.localeCompare(b))
    : [];

  return {
    ...project,
    registryInfo: {
      registered: true,
      registryPath: "projects/registry.md",
      githubRepo: project.githubRepo,
      visibility: project.visibility,
      status: project.status,
      lastUpdated: project.lastUpdated,
    },
    relatedTasks,
    relatedDirtyFiles,
    ...staleMeta,
  };
}

function buildRecommendation(finding: CheckFinding, scope: Scope, staleMeta: AgentStaleMeta): AgentRecommendation {
  const actionType = mapActionType(finding);
  const dedupeKey = dedupeKeyForFinding(finding.id, actionType);
  const blockedBy = finding.severity === "block" ? [finding.title] : [];
  if (staleMeta.stale && staleMeta.staleReason) blockedBy.push(staleMeta.staleReason);

  const readyState = blockedBy.length > 0 ? (finding.severity === "info" ? "needs_review" : "blocked") : finding.severity === "warn" ? "needs_review" : "ready";
  const confidence = scoreConfidence(finding, staleMeta.stale);

  const primaryAction: PrimaryAction = {
    type: mapActionKind(actionType),
    target: finding.target ?? ".",
    actionType,
    reason: finding.evidence,
    dedupeKey,
  };

  const confidenceReason = staleMeta.stale
    ? "Deterministic severity/action mapping was applied, but source scan is stale."
    : "Deterministic severity/action mapping was applied from the latest scan.";

  return {
    id: `rec:${finding.id}`,
    scope,
    findingId: finding.id,
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
    risk: mapSeverityToRisk(finding.severity),
    evidence: [finding.evidence],
    target: finding.target ?? ".",
    primaryAction,
    confidence,
    confidenceReason,
    readyState,
    blockedBy,
    dedupeKey,
    manualOnly: true,
    cost: finding.severity === "block" ? "high" : finding.severity === "warn" ? "medium" : "low",
    urgency: finding.severity === "block" ? "immediate" : finding.severity === "warn" ? "soon" : "later",
    decisionTrace: [
      `finding=${finding.id}`,
      `severity=${finding.severity}`,
      `actionType=${actionType}`,
      `scope=${scope}`,
    ],
  };
}

function filterFindingsByScope(findings: CheckFinding[], snapshot: WorkspaceSnapshot, scope: Scope, projectId?: string, taskId?: string): CheckFinding[] {
  if (scope === "workspace") return findings;
  if (scope === "project") {
    const project = snapshot.projects.find((item) => item.id === projectId);
    if (!project) return [];
    const normalizedPath = project.localPath.replace(/\/+$/, "");
    return findings.filter((finding) => finding.target?.startsWith(normalizedPath) || finding.id.includes(project.id));
  }
  if (scope === "task") {
    const task = snapshot.tasks.find((item) => item.id === taskId);
    if (!task) return [];
    return findings.filter((finding) => finding.target === task.path || finding.id.includes(task.id));
  }
  return findings;
}

export async function buildContextBrief(params: {
  scope: Scope;
  verbosity: "compact";
  projectId?: string;
  taskId?: string;
}): Promise<ContextBrief> {
  const base = await loadReadModelBase();
  const pendingActions = await listActions("pending");
  const scopedFindings = filterFindingsByScope(base.findings, base.snapshot, params.scope, params.projectId, params.taskId);
  const findings = scopedFindings.length > 0 ? scopedFindings : base.findings;
  const topFindings = findings.slice().sort(compareSeverity).slice(0, 12).map((item) => ({
    id: item.id,
    severity: item.severity,
    category: item.category,
    title: item.title,
    evidence: item.evidence,
    target: item.target,
  }));

  const focus = params.scope === "workspace"
    ? undefined
    : params.scope === "project"
      ? { projectId: params.projectId, target: base.snapshot.projects.find((item) => item.id === params.projectId)?.localPath }
      : { taskId: params.taskId, target: base.snapshot.tasks.find((item) => item.id === params.taskId)?.path };

  return {
    scope: params.scope,
    verbosity: "compact",
    summary: {
      health: resolveHealth(base.findings),
      projects: base.snapshot.projects.length,
      tasks: base.snapshot.tasks.length,
      activeTasks: base.snapshot.tasks.filter((item) => item.status === "active").length,
      findings: findings.length,
      pendingActions: pendingActions.length,
      dirtyFiles: base.snapshot.git.changedFiles.length,
    },
    focus,
    topFindings,
    ...base.staleMeta,
  };
}

export async function buildRecommendationModel(params: {
  scope: Scope;
  projectId?: string;
  taskId?: string;
  limit?: number;
}): Promise<{
  recommendations: AgentRecommendation[];
  primaryAction: PrimaryAction;
  staleMeta: AgentStaleMeta;
}> {
  const base = await loadReadModelBase();
  const scopedFindings = filterFindingsByScope(base.findings, base.snapshot, params.scope, params.projectId, params.taskId);
  const findings = (scopedFindings.length > 0 ? scopedFindings : base.findings)
    .slice()
    .sort(compareSeverity)
    .slice(0, Math.max(1, Math.min(params.limit ?? DEFAULT_RECOMMENDATION_LIMIT, 20)));

  const recommendations = findings.map((finding) => buildRecommendation(finding, params.scope, base.staleMeta));

  const primaryAction = recommendations[0]?.primaryAction ?? {
    type: "manual",
    target: "workspace/tasks",
    actionType: "create_task_note",
    reason: "No deterministic finding is available. Perform manual review first.",
    dedupeKey: "finding:manual-review:create_task_note",
  };

  return {
    recommendations,
    primaryAction,
    staleMeta: base.staleMeta,
  };
}

export async function buildRecommendationFromFinding(params: {
  findingId?: string;
  dedupeKey?: string;
  scope?: Scope;
}): Promise<AgentRecommendation | undefined> {
  const scope = params.scope ?? "workspace";
  const base = await loadReadModelBase();
  const findings = filterFindingsByScope(base.findings, base.snapshot, scope);
  const recommendations = findings.map((finding) => buildRecommendation(finding, scope, base.staleMeta));
  return recommendations.find((recommendation) =>
    (params.findingId && recommendation.findingId === params.findingId)
    || (params.dedupeKey && recommendation.dedupeKey === params.dedupeKey),
  );
}

export async function buildTaskContexts(params: {
  status?: "active" | "recent";
  project?: string;
  limit?: number;
}): Promise<{ items: TaskContext[]; staleMeta: AgentStaleMeta }> {
  const base = await loadReadModelBase();
  let tasks = base.snapshot.tasks;
  if (params.status === "active") tasks = tasks.filter((item) => item.status === "active");
  if (params.project) tasks = tasks.filter((item) => item.project === params.project);
  if (params.status === "recent") {
    tasks = tasks
      .slice()
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || a.id.localeCompare(b.id));
  } else {
    tasks = tasks.slice().sort((a, b) => a.id.localeCompare(b.id));
  }
  const limit = Math.max(1, Math.min(params.limit ?? DEFAULT_TASK_CONTEXT_LIMIT, 50));
  const items = tasks.slice(0, limit).map((task) => deriveTaskContext(task, base.snapshot, base.staleMeta));
  return { items, staleMeta: base.staleMeta };
}

export async function buildProjectContexts(params: {
  projectId?: string;
  includeDirty: boolean;
}): Promise<{ items: ProjectContext[]; staleMeta: AgentStaleMeta }> {
  const base = await loadReadModelBase();
  let projects = base.snapshot.projects.slice().sort((a, b) => a.id.localeCompare(b.id));
  if (params.projectId) projects = projects.filter((item) => item.id === params.projectId);
  const items = projects.map((project) => deriveProjectContext(project, base.snapshot, params.includeDirty, base.staleMeta));
  return { items, staleMeta: base.staleMeta };
}

export async function buildSourceMap(scope: Scope): Promise<SourceMap> {
  const base = await loadReadModelBase();
  const entries: SourceMap["entries"] = [
    { key: "agents", path: "AGENTS.md", exists: existsSync(safeResolveInsideHub("AGENTS.md")), kind: "policy" },
    { key: "config", path: "config.yaml", exists: existsSync(safeResolveInsideHub("config.yaml")), kind: "policy" },
    { key: "registry", path: "projects/registry.md", exists: existsSync(safeResolveInsideHub("projects/registry.md")), kind: "registry" },
    { key: "workspace_tasks", path: "workspace/tasks", exists: existsSync(safeResolveInsideHub("workspace/tasks")), kind: "workspace" },
    { key: "workspace_artifacts", path: "workspace/artifacts", exists: existsSync(safeResolveInsideHub("workspace/artifacts")), kind: "workspace" },
    { key: "runtime_orchestrator", path: ".orchestrator", exists: existsSync(ORCHESTRATOR_ROOT), kind: "runtime" },
  ];
  for (const project of base.snapshot.projects.slice(0, 6)) {
    const normalizedPath = project.localPath.replace(/\/+$/, "");
    entries.push({
      key: `project_${project.id}`,
      path: normalizedPath,
      exists: existsSync(safeResolveInsideHub(normalizedPath)),
      kind: "project",
    });
  }

  return {
    scope,
    hubRoot: HUB_ROOT,
    entries: entries.sort((a, b) => a.path.localeCompare(b.path)),
    ...base.staleMeta,
  };
}

export async function buildAgentBootstrap(): Promise<AgentBootstrap> {
  const [brief, recommendationModel, taskContexts, sourceMapLite] = await Promise.all([
    buildContextBrief({ scope: "workspace", verbosity: "compact" }),
    buildRecommendationModel({ scope: "workspace", limit: DEFAULT_RECOMMENDATION_LIMIT }),
    buildTaskContexts({ status: "active", limit: 8 }),
    buildSourceMap("workspace"),
  ]);

  return {
    contractVersion: "1.5",
    limits: {
      localhostOnly: true,
      commandExecution: false,
      manualOnlyDefault: true,
      mutationScope: ".orchestrator",
    },
    brief,
    nextSteps: recommendationModel.recommendations,
    activeTasks: taskContexts.items,
    sourceMapLite,
    ...recommendationModel.staleMeta,
  };
}
