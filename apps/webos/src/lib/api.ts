import type {
  ActionRequest,
  AgentBootstrap,
  CheckRun,
  MemoryCandidate,
  MemoryCandidateStatus,
  ProjectRecord,
  TaskRecord,
  WorkspaceOverview,
} from "../shared/schemas";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => requestJson<{ ok: boolean }>("/health"),
  scan: () => requestJson<CheckRun>("/api/workspace/scan", { method: "POST", body: JSON.stringify({}) }),
  overview: () => requestJson<WorkspaceOverview>("/api/workspace/overview"),
  projects: () => requestJson<ProjectRecord[]>("/api/projects"),
  tasks: () => requestJson<TaskRecord[]>("/api/tasks"),
  checks: () => requestJson<CheckRun>("/api/checks/latest"),
  agentBootstrap: () => requestJson<AgentBootstrap>("/api/agent/bootstrap"),
  createActionFromFinding: (dedupeKey: string) =>
    requestJson<{ action: ActionRequest; created: boolean; dedupeKey: string }>("/api/actions/from-finding", {
      method: "POST",
      body: JSON.stringify({ dedupeKey }),
    }),
  history: () => requestJson<unknown[]>("/api/checks/history?limit=50"),
  actions: () => requestJson<ActionRequest[]>("/api/actions"),
  memoryCandidates: (status?: MemoryCandidateStatus) =>
    requestJson<MemoryCandidate[]>(`/api/memory/candidates${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  patchMemoryCandidate: (id: string, status: "approved" | "rejected" | "merged" | "stale", note?: string) =>
    requestJson<MemoryCandidate>(`/api/memory/candidates/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, reviewer: "codex", note }),
    }),
  patchAction: (id: string, status: "approved" | "rejected") =>
    requestJson<ActionRequest>(`/api/actions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  patchActionsBulk: (status: "approved" | "rejected", onlyStatus = "pending") =>
    requestJson<{ count: number; actions: ActionRequest[] }>("/api/actions/bulk", {
      method: "PATCH",
      body: JSON.stringify({ status, onlyStatus }),
    }),
  cleanupActions: (mode: "resolved" | "all" = "resolved") =>
    requestJson<{ count: number; mode: "resolved" | "all" }>("/api/actions/cleanup", {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),
  digest: () => requestJson<{ markdown: string }>("/api/digest/latest"),
  gemmaStatus: () => requestJson<{ available: boolean; model: string; message: string }>("/api/gemma/status"),
};
