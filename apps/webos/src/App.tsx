import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  PlusCircle,
  RefreshCw,
  Settings,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type React from "react";
import { DataTable, type DataColumn } from "./components/DataTable";
import { api } from "./lib/api";
import { cn, formatDate } from "./lib/utils";
import type { ActionRequest, AgentRecommendation, CheckFinding, MemoryCandidate, MemoryCandidateStatus, ProjectRecord, TaskRecord } from "./shared/schemas";

const screens = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "tasks", label: "Tasks", icon: ClipboardCheck },
  { id: "checks", label: "Checks", icon: ListChecks },
  { id: "actions", label: "Actions", icon: ShieldAlert },
  { id: "memory", label: "Memory", icon: MessageSquareText },
  { id: "digest", label: "Digest", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type Screen = (typeof screens)[number]["id"];

function invalidateAgentReadModels(queryClient: QueryClient) {
  ["agent-bootstrap", "overview", "checks", "tasks", "projects", "digest", "actions"].forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey: [queryKey] });
  });
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "block" }) {
  return (
    <span className={cn(
      "inline-flex rounded px-2 py-1 text-xs font-medium",
      tone === "ok" && "bg-emerald-100 text-emerald-800",
      tone === "warn" && "bg-amber-100 text-amber-800",
      tone === "block" && "bg-red-100 text-red-800",
      tone === "neutral" && "bg-stone-100 text-stone-700",
    )}>
      {children}
    </span>
  );
}

function Shell({ screen, setScreen, children }: { screen: Screen; setScreen: (screen: Screen) => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-stone-300 bg-[#202820] p-4 text-white md:block">
        <div className="mb-6">
          <div className="text-lg font-bold">Codex Hub WebOS</div>
          <div className="text-xs text-stone-300">localhost read model</div>
        </div>
        <nav className="space-y-1">
          {screens.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={cn("flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm", screen === item.id ? "bg-white text-[#202820]" : "text-stone-200 hover:bg-white/10")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="md:pl-64">
        <div className="border-b border-stone-300 bg-white px-4 py-3 md:hidden">
          <select className="w-full rounded border border-stone-300 p-2" value={screen} onChange={(event) => setScreen(event.target.value as Screen)}>
            {screens.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <div className="mx-auto max-w-7xl p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

function Overview() {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview, refetchInterval: 15000 });
  const scan = useMutation({
    mutationFn: api.scan,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
  const data = overview.data;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-stone-600">Last scan: {formatDate(data?.scannedAt)}</p>
        </div>
        <button
          onClick={() => scan.mutate()}
          className="inline-flex items-center gap-2 rounded bg-[#1f6f58] px-3 py-2 text-sm font-semibold text-white hover:bg-[#185946]"
        >
          <RefreshCw className={cn("h-4 w-4", scan.isPending && "animate-spin")} />
          Run Scan
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Health" value={data?.health ?? "unknown"} tone={data?.health === "block" ? "block" : data?.health === "warn" ? "warn" : data?.health === "ok" ? "ok" : "neutral"} />
        <Metric label="Projects" value={data?.counts.projects ?? 0} />
        <Metric label="Tasks" value={data?.counts.tasks ?? 0} />
        <Metric label="Pending Actions" value={data?.counts.actionsPending ?? 0} tone={(data?.counts.actionsPending ?? 0) > 0 ? "warn" : "ok"} />
      </div>
      <Panel title="Top Findings">
        <DataTable
          rows={data?.topFindings ?? []}
          loading={overview.isLoading}
          error={overview.error}
          emptyText="No blocking or warning findings."
          getRowKey={(row) => row.id}
          columns={findingColumns}
        />
      </Panel>
    </section>
  );
}

function Agent() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["agent-bootstrap"], queryFn: api.agentBootstrap, refetchInterval: 15000, refetchOnWindowFocus: true });
  const scan = useMutation({
    mutationFn: api.scan,
    onSuccess: () => invalidateAgentReadModels(queryClient),
  });
  const createAction = useMutation({
    mutationFn: (dedupeKey: string) => api.createActionFromFinding(dedupeKey),
    onSuccess: () => invalidateAgentReadModels(queryClient),
  });
  const data = query.data;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agent</h1>
          <p className="text-sm text-stone-600">Contract {data?.contractVersion ?? "1.5"} · Scan: {formatDate(data?.sourceScanAt ?? undefined)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={data?.stale ? "warn" : "ok"}>{data?.stale ? "stale" : "fresh"}</Badge>
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="inline-flex items-center gap-2 rounded bg-[#1f6f58] px-3 py-2 text-sm font-semibold text-white hover:bg-[#185946] disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            <RefreshCw className={cn("h-4 w-4", scan.isPending && "animate-spin")} />
            Run Scan
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Health" value={data?.brief.summary.health ?? "unknown"} tone={data?.brief.summary.health === "block" ? "block" : data?.brief.summary.health === "warn" ? "warn" : data?.brief.summary.health === "ok" ? "ok" : "neutral"} />
        <Metric label="Next Steps" value={data?.nextSteps.length ?? 0} tone={(data?.nextSteps.length ?? 0) > 0 ? "warn" : "ok"} />
        <Metric label="Active Tasks" value={data?.activeTasks.length ?? 0} />
        <Metric label="Dirty Files" value={data?.brief.summary.dirtyFiles ?? 0} tone={(data?.brief.summary.dirtyFiles ?? 0) > 0 ? "warn" : "ok"} />
      </div>
      {data?.staleReason && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <span>{data.staleReason}</span>
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="inline-flex items-center gap-2 rounded bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            <RefreshCw className={cn("h-4 w-4", scan.isPending && "animate-spin")} />
            Run Scan to refresh metrics
          </button>
        </div>
      )}
      <Panel title="Next Steps">
        <DataTable
          rows={data?.nextSteps ?? []}
          loading={query.isLoading}
          error={query.error}
          emptyText="No recommendations."
          getRowKey={(row) => row.dedupeKey}
          columns={[
            { key: "risk", header: "Risk", accessor: (row: AgentRecommendation) => <Badge tone={row.risk === "high" ? "block" : row.risk === "medium" ? "warn" : "neutral"}>{row.risk}</Badge>, sortValue: (row) => row.risk },
            { key: "ready", header: "Ready", accessor: (row) => <Badge tone={row.readyState === "ready" ? "ok" : row.readyState === "blocked" ? "block" : "warn"}>{row.readyState}</Badge>, sortValue: (row) => row.readyState },
            { key: "title", header: "Recommendation", accessor: (row) => <div><div className="font-medium">{row.title}</div><div className="text-xs text-stone-500">{row.evidence[0]}</div></div>, sortValue: (row) => row.title },
            { key: "confidence", header: "Confidence", accessor: (row) => `${Math.round(row.confidence * 100)}%`, sortValue: (row) => row.confidence },
            { key: "target", header: "Target", accessor: (row) => row.primaryAction.target, sortValue: (row) => row.primaryAction.target },
            {
              key: "action",
              header: "Queue",
              accessor: (row) => (
                <button
                  className="inline-flex items-center gap-1 rounded bg-[#1f6f58] px-2 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                  disabled={createAction.isPending}
                  onClick={() => createAction.mutate(row.dedupeKey)}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Create Action
                </button>
              ),
            },
          ]}
        />
      </Panel>
      <Panel title="Active Task Context">
        <DataTable
          rows={data?.activeTasks ?? []}
          loading={query.isLoading}
          error={query.error}
          emptyText="No active task context."
          getRowKey={(row) => row.id}
          columns={[
            { key: "task", header: "Task", accessor: (row) => <div><div className="font-medium">{row.title}</div><div className="text-xs text-stone-500">{row.path}</div></div>, sortValue: (row) => row.title },
            { key: "risk", header: "Risk", accessor: (row) => <Badge tone={row.riskLevel === "high" ? "block" : row.riskLevel === "medium" ? "warn" : "neutral"}>{row.riskLevel}</Badge>, sortValue: (row) => row.riskLevel },
            { key: "missing", header: "Missing", accessor: (row) => row.missingFields.join(", ") || "-", sortValue: (row) => row.missingFields.join(",") },
            { key: "project", header: "Project", accessor: (row) => row.project ?? "-", sortValue: (row) => row.project },
          ]}
        />
      </Panel>
    </section>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "block" }) {
  return (
    <div className="rounded border border-stone-300 bg-white p-4">
      <div className="text-xs uppercase text-stone-500">{label}</div>
      <div className="mt-2 flex items-center gap-2 text-2xl font-bold"><Badge tone={tone}>{value}</Badge></div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const findingColumns: DataColumn<CheckFinding>[] = [
  { key: "severity", header: "Severity", accessor: (row) => <Badge tone={row.severity === "block" ? "block" : row.severity === "warn" ? "warn" : "neutral"}>{row.severity}</Badge>, sortValue: (row) => row.severity },
  { key: "category", header: "Category", accessor: (row) => row.category, sortValue: (row) => row.category },
  { key: "title", header: "Title", accessor: (row) => <div><div className="font-medium">{row.title}</div><div className="text-xs text-stone-500">{row.evidence}</div></div>, sortValue: (row) => row.title },
  { key: "target", header: "Target", accessor: (row) => row.target ?? "-", sortValue: (row) => row.target },
  { key: "action", header: "Action", accessor: (row) => row.suggestedActionType ?? "-", sortValue: (row) => row.suggestedActionType },
];

function Projects() {
  const query = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const columns: DataColumn<ProjectRecord>[] = [
    { key: "name", header: "Project", accessor: (row) => <div className="font-medium">{row.name}</div>, sortValue: (row) => row.name },
    { key: "path", header: "Path", accessor: (row) => row.localPath, sortValue: (row) => row.localPath },
    { key: "exists", header: "Exists", accessor: (row) => <Badge tone={row.exists ? "ok" : "block"}>{row.exists ? "yes" : "no"}</Badge>, sortValue: (row) => String(row.exists) },
    { key: "status", header: "Status", accessor: (row) => row.status, sortValue: (row) => row.status },
    { key: "updated", header: "Updated", accessor: (row) => row.lastUpdated, sortValue: (row) => row.lastUpdated },
  ];
  return <ScreenTable title="Projects" rows={query.data ?? []} columns={columns} loading={query.isLoading} error={query.error} getRowKey={(row) => row.id} />;
}

function Tasks() {
  const query = useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
  const columns: DataColumn<TaskRecord>[] = [
    { key: "title", header: "Task", accessor: (row) => <div><div className="font-medium">{row.title}</div><div className="text-xs text-stone-500">{row.path}</div></div>, sortValue: (row) => row.title },
    { key: "project", header: "Project", accessor: (row) => row.project ?? "-", sortValue: (row) => row.project },
    { key: "status", header: "Status", accessor: (row) => row.status, sortValue: (row) => row.status },
    { key: "ac", header: "AC", accessor: (row) => <Badge tone={row.hasAcceptanceCriteria ? "ok" : "warn"}>{row.hasAcceptanceCriteria ? "present" : "missing"}</Badge>, sortValue: (row) => String(row.hasAcceptanceCriteria) },
    { key: "dod", header: "DoD", accessor: (row) => <Badge tone={row.hasDoneCriteria ? "ok" : "warn"}>{row.hasDoneCriteria ? "present" : "missing"}</Badge>, sortValue: (row) => String(row.hasDoneCriteria) },
  ];
  return <ScreenTable title="Tasks" rows={query.data ?? []} columns={columns} loading={query.isLoading} error={query.error} getRowKey={(row) => row.id} />;
}

function Checks() {
  const query = useQuery({ queryKey: ["checks"], queryFn: api.checks });
  return <ScreenTable title="Checks" rows={query.data?.findings ?? []} columns={findingColumns} loading={query.isLoading} error={query.error} getRowKey={(row) => row.id} />;
}

function Actions() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved" | "all">("pending");
  const query = useQuery({ queryKey: ["actions"], queryFn: api.actions });
  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" }) => api.patchAction(id, status),
    onSuccess: () => invalidateAgentReadModels(queryClient),
  });
  const rejectPending = useMutation({
    mutationFn: () => api.patchActionsBulk("rejected", "pending"),
    onSuccess: () => invalidateAgentReadModels(queryClient),
  });
  const cleanupResolved = useMutation({
    mutationFn: () => api.cleanupActions("resolved"),
    onSuccess: () => invalidateAgentReadModels(queryClient),
  });
  const actions = query.data ?? [];
  const pendingCount = actions.filter((action) => action.status === "pending").length;
  const resolvedCount = actions.length - pendingCount;
  const rows = actions.filter((action) => {
    if (statusFilter === "pending") return action.status === "pending";
    if (statusFilter === "resolved") return action.status !== "pending";
    return true;
  });
  const columns: DataColumn<ActionRequest>[] = [
    { key: "title", header: "Action", accessor: (row) => <div><div className="font-medium">{row.title}</div><div className="text-xs text-stone-500">{row.intent}</div></div>, sortValue: (row) => row.title },
    { key: "risk", header: "Risk", accessor: (row) => <Badge tone={row.risk === "high" ? "block" : row.risk === "medium" ? "warn" : "neutral"}>{row.risk}</Badge>, sortValue: (row) => row.risk },
    { key: "status", header: "Status", accessor: (row) => row.status, sortValue: (row) => row.status },
    { key: "target", header: "Target", accessor: (row) => row.target, sortValue: (row) => row.target },
    {
      key: "decision",
      header: "Decision",
      accessor: (row) => row.status === "pending" ? (
        <div className="flex gap-2">
          <button className="rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white" onClick={() => patch.mutate({ id: row.id, status: "approved" })}>Approve</button>
          <button className="rounded bg-stone-700 px-2 py-1 text-xs font-semibold text-white" onClick={() => patch.mutate({ id: row.id, status: "rejected" })}>Reject</button>
        </div>
      ) : "-",
    },
  ];
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Actions</h1>
          <p className="text-sm text-stone-600">{pendingCount} pending / {resolvedCount} resolved</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-stone-300 bg-white px-2 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "pending" | "resolved" | "all")}
          >
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
          <button
            className="inline-flex items-center gap-2 rounded bg-stone-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
            disabled={pendingCount === 0 || rejectPending.isPending}
            onClick={() => rejectPending.mutate()}
          >
            <XCircle className="h-4 w-4" />
            Reject pending
          </button>
          <button
            className="inline-flex items-center gap-2 rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
            disabled={resolvedCount === 0 || cleanupResolved.isPending}
            onClick={() => cleanupResolved.mutate()}
          >
            <Trash2 className="h-4 w-4" />
            Clear resolved
          </button>
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        loading={query.isLoading}
        error={query.error}
        emptyText="No actions in this view."
        getRowKey={(row) => row.id}
      />
    </section>
  );
}

function MemoryReview() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<MemoryCandidateStatus | "all">("proposed");
  const query = useQuery({ queryKey: ["memory-candidates", statusFilter], queryFn: () => api.memoryCandidates(statusFilter === "all" ? undefined : statusFilter) });
  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" | "merged" | "stale" }) => api.patchMemoryCandidate(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["memory-candidates"] });
    },
  });
  const rows = query.data ?? [];
  const columns: DataColumn<MemoryCandidate>[] = [
    { key: "status", header: "Status", accessor: (row) => <Badge tone={row.status === "approved" ? "ok" : row.status === "rejected" || row.status === "stale" ? "block" : row.status === "merged" ? "neutral" : "warn"}>{row.status}</Badge>, sortValue: (row) => row.status },
    { key: "title", header: "Candidate", accessor: (row) => <div><div className="font-medium">{row.title}</div><div className="text-xs text-stone-500">{row.summary}</div></div>, sortValue: (row) => row.title },
    { key: "scope", header: "Scope", accessor: (row) => `${row.scope.workspaceId}/${row.scope.projectId ?? "-"}/${row.scope.sessionId ?? "-"}`, sortValue: (row) => row.scope.projectId ?? "" },
    { key: "type", header: "Type", accessor: (row) => row.type, sortValue: (row) => row.type },
    { key: "confidence", header: "Conf.", accessor: (row) => `${Math.round(row.confidence * 100)}%`, sortValue: (row) => row.confidence },
    { key: "destination", header: "Destination", accessor: (row) => row.suggestedDestination, sortValue: (row) => row.suggestedDestination },
    { key: "evidence", header: "Evidence", accessor: (row) => <div className="max-w-xs truncate" title={row.evidence.join("\n")}>{row.evidence[0] ?? "-"}</div>, sortValue: (row) => row.evidence.join(",") },
    { key: "conflicts", header: "Conflicts", accessor: (row) => row.conflictsWith.length ? <Badge tone="warn">{row.conflictsWith.length}</Badge> : "-", sortValue: (row) => row.conflictsWith.length },
    {
      key: "decision",
      header: "Review",
      accessor: (row) => (
        <div className="flex flex-wrap gap-2">
          <button className="rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white disabled:bg-stone-400" disabled={patch.isPending} onClick={() => patch.mutate({ id: row.id, status: "approved" })}>Approve</button>
          <button className="rounded bg-stone-700 px-2 py-1 text-xs font-semibold text-white disabled:bg-stone-400" disabled={patch.isPending} onClick={() => patch.mutate({ id: row.id, status: "merged" })}>Merge</button>
          <button className="rounded bg-amber-700 px-2 py-1 text-xs font-semibold text-white disabled:bg-stone-400" disabled={patch.isPending} onClick={() => patch.mutate({ id: row.id, status: "stale" })}>Stale</button>
          <button className="rounded bg-red-700 px-2 py-1 text-xs font-semibold text-white disabled:bg-stone-400" disabled={patch.isPending} onClick={() => patch.mutate({ id: row.id, status: "rejected" })}>Reject</button>
        </div>
      ),
    },
  ];
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Memory Review</h1>
          <p className="text-sm text-stone-600">Manual candidate review under `.orchestrator/memory-candidates`.</p>
        </div>
        <select
          className="rounded border border-stone-300 bg-white px-2 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as MemoryCandidateStatus | "all")}
        >
          <option value="proposed">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="merged">Export queue</option>
          <option value="stale">Stale</option>
          <option value="all">All</option>
        </select>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        loading={query.isLoading}
        error={query.error}
        emptyText="No memory candidates in this view."
        getRowKey={(row) => row.id}
      />
    </section>
  );
}

function Digest() {
  const query = useQuery({ queryKey: ["digest"], queryFn: api.digest });
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Digest</h1>
      <pre className="whitespace-pre-wrap rounded border border-stone-300 bg-white p-4 text-sm text-stone-800">{query.data?.markdown || "No digest yet. Run Scan first."}</pre>
    </section>
  );
}

function SettingsPanel() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const gemma = useQuery({ queryKey: ["gemma"], queryFn: api.gemmaStatus });
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-stone-300 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold"><Activity className="h-4 w-4" /> API</div>
          <Badge tone={health.data?.ok ? "ok" : "warn"}>{health.data?.ok ? "healthy" : "unknown"}</Badge>
        </div>
        <div className="rounded border border-stone-300 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Gemma</div>
          <p className="text-sm text-stone-600">{gemma.data?.message ?? "Checking..."}</p>
        </div>
      </div>
      <div className="rounded border border-stone-300 bg-white p-4 text-sm">
        <div className="font-semibold">V1 safety boundary</div>
        <p className="mt-1 text-stone-600">Localhost only. No execute endpoint. Approval queue changes status only.</p>
      </div>
    </section>
  );
}

function ScreenTable<T>({ title, ...props }: { title: string } & React.ComponentProps<typeof DataTable<T>>) {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <DataTable {...props} />
    </section>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("agent");
  return (
    <Shell screen={screen} setScreen={setScreen}>
      {screen === "agent" && <Agent />}
      {screen === "overview" && <Overview />}
      {screen === "projects" && <Projects />}
      {screen === "tasks" && <Tasks />}
      {screen === "checks" && <Checks />}
      {screen === "actions" && <Actions />}
      {screen === "memory" && <MemoryReview />}
      {screen === "digest" && <Digest />}
      {screen === "settings" && <SettingsPanel />}
    </Shell>
  );
}
