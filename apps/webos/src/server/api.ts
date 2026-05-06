import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { ActionRequestSchema, ActionStatusSchema, ActionTypeSchema } from "../shared/schemas";
import type { ActionRequest, ActionStatus, MemoryCandidateStatus } from "../shared/schemas";
import { MemoryCandidateStatusSchema } from "../shared/schemas";
import {
  buildAgentBootstrap,
  buildContextBrief,
  buildProjectContexts,
  buildRecommendationFromFinding,
  buildRecommendationModel,
  buildSourceMap,
  buildTaskContexts,
} from "./agent-read-model";
import { getOverview, scanWorkspace } from "./scanner";
import {
  appendEvent,
  deleteActions,
  findActionByDedupeKey,
  listActions,
  listHistory,
  listMemoryCandidates,
  readAction,
  readDigest,
  readLatestCheckRun,
  readMemoryCandidate,
  writeAction,
  writeMemoryCandidate,
} from "./storage";

const CreateActionSchema = z.object({
  type: ActionTypeSchema,
  title: z.string().min(1),
  risk: z.enum(["low", "medium", "high"]),
  target: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  intent: z.string().min(1),
  rollback: z.string().min(1),
});

const PatchActionSchema = z.object({
  status: ActionStatusSchema.exclude(["executed", "failed"]),
});

const BulkPatchActionSchema = z.object({
  status: ActionStatusSchema.exclude(["executed", "failed"]),
  onlyStatus: ActionStatusSchema.default("pending"),
});

const CleanupActionsSchema = z.object({
  mode: z.enum(["resolved", "all"]).default("resolved"),
});

const MemoryCandidateQuerySchema = z.object({
  status: MemoryCandidateStatusSchema.optional(),
});

const PatchMemoryCandidateSchema = z.object({
  status: z.enum(["approved", "rejected", "merged", "stale"]),
  reviewer: z.string().min(1).default("codex"),
  note: z.string().optional(),
});

const ContextBriefQuerySchema = z.object({
  scope: z.enum(["workspace", "project", "task"]).default("workspace"),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  verbosity: z.literal("compact").default("compact"),
});

const RecommendationQuerySchema = z.object({
  scope: z.enum(["workspace", "project", "task"]).default("workspace"),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const TaskContextQuerySchema = z.object({
  status: z.enum(["active", "recent"]).optional(),
  project: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const ProjectContextQuerySchema = z.object({
  projectId: z.string().optional(),
  includeDirty: z.coerce.boolean().default(true),
});

const CreateActionFromFindingSchema = z.object({
  findingId: z.string().optional(),
  dedupeKey: z.string().optional(),
}).refine((value) => Boolean(value.findingId || value.dedupeKey), {
  message: "findingId or dedupeKey is required",
});

export function createApiServer(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    reply.status(500).send({
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "codex-hub-webos-api",
    localhostOnly: true,
    commandExecution: false,
  }));

  app.post("/api/workspace/scan", async () => scanWorkspace());

  app.get("/api/workspace/overview", async () => getOverview());

  app.get("/api/context/brief", async (request, reply) => {
    const parsed = ContextBriefQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "bad_request", message: "Invalid context brief query", details: parsed.error.flatten() } });
    }
    return buildContextBrief(parsed.data);
  });

  app.get("/api/next-step/recommendation", async (request, reply) => {
    const parsed = RecommendationQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "bad_request", message: "Invalid recommendation query", details: parsed.error.flatten() } });
    }
    const model = await buildRecommendationModel(parsed.data);
    return {
      scope: parsed.data.scope,
      recommendations: model.recommendations,
      primaryAction: model.primaryAction,
      ...model.staleMeta,
    };
  });

  app.get("/api/agent/bootstrap", async () => buildAgentBootstrap());

  app.get("/api/workspace/source-map", async () => buildSourceMap("workspace"));

  app.get("/api/tasks/context", async (request, reply) => {
    const parsed = TaskContextQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "bad_request", message: "Invalid task context query", details: parsed.error.flatten() } });
    }
    const context = await buildTaskContexts(parsed.data);
    return {
      items: context.items,
      ...context.staleMeta,
    };
  });

  app.get("/api/projects/context", async (request, reply) => {
    const parsed = ProjectContextQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "bad_request", message: "Invalid project context query", details: parsed.error.flatten() } });
    }
    const context = await buildProjectContexts(parsed.data);
    return {
      items: context.items,
      ...context.staleMeta,
    };
  });

  app.get("/api/projects", async () => (await readLatestCheckRun())?.snapshot.projects ?? []);

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId", async (request, reply) => {
    const project = ((await readLatestCheckRun())?.snapshot.projects ?? []).find((item) => item.id === request.params.projectId);
    if (!project) return reply.status(404).send({ error: { code: "not_found", message: "Project not found" } });
    return project;
  });

  app.get<{ Querystring: { status?: string; project?: string } }>("/api/tasks", async (request) => {
    let tasks = (await readLatestCheckRun())?.snapshot.tasks ?? [];
    if (request.query.status) tasks = tasks.filter((task) => task.status === request.query.status);
    if (request.query.project) tasks = tasks.filter((task) => task.project === request.query.project);
    return tasks;
  });

  app.get<{ Params: { taskId: string } }>("/api/tasks/:taskId", async (request, reply) => {
    const task = ((await readLatestCheckRun())?.snapshot.tasks ?? []).find((item) => item.id === request.params.taskId);
    if (!task) return reply.status(404).send({ error: { code: "not_found", message: "Task not found" } });
    return task;
  });

  app.get("/api/checks/latest", async () => (await readLatestCheckRun()) ?? { findings: [], summary: { info: 0, warn: 0, block: 0 } });

  app.get<{ Querystring: { limit?: string } }>("/api/checks/history", async (request) => {
    const limit = Math.min(Number(request.query.limit ?? 50), 200);
    return listHistory(Number.isFinite(limit) ? limit : 50);
  });

  app.get<{ Querystring: { status?: string } }>("/api/actions", async (request) => listActions(request.query.status));

  app.get("/api/memory/candidates", async (request, reply) => {
    const parsed = MemoryCandidateQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: { code: "bad_request", message: "Invalid memory candidate query" } });
    return listMemoryCandidates(parsed.data.status);
  });

  app.get<{ Params: { candidateId: string } }>("/api/memory/candidates/:candidateId", async (request, reply) => {
    const candidate = await readMemoryCandidate(request.params.candidateId);
    if (!candidate) return reply.status(404).send({ error: { code: "not_found", message: "Memory candidate not found" } });
    return candidate;
  });

  app.patch<{ Params: { candidateId: string } }>("/api/memory/candidates/:candidateId", async (request, reply) => {
    const parsed = PatchMemoryCandidateSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: "bad_request", message: "Invalid memory candidate patch", details: parsed.error.flatten() } });
    const candidate = await readMemoryCandidate(request.params.candidateId);
    if (!candidate) return reply.status(404).send({ error: { code: "not_found", message: "Memory candidate not found" } });
    const status = parsed.data.status as MemoryCandidateStatus;
    const updated = {
      ...candidate,
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: parsed.data.reviewer,
      reviewNote: parsed.data.note ?? candidate.reviewNote ?? null,
    };
    await writeMemoryCandidate(updated);
    await appendEvent({ type: "action_updated", source: "api", payload: { kind: "memory_candidate", id: updated.id, status } });
    return updated;
  });

  app.patch("/api/actions/bulk", async (request, reply) => {
    const parsed = BulkPatchActionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: "bad_request", message: "Invalid bulk action patch" } });
    const actions = await listActions(parsed.data.onlyStatus);
    const updated = await Promise.all(actions.map(async (action) => {
      const item: ActionRequest = { ...action, status: parsed.data.status as ActionStatus, updatedAt: new Date().toISOString() };
      await writeAction(item);
      return item;
    }));
    await appendEvent({
      type: "action_updated",
      source: "api",
      payload: { mode: "bulk", status: parsed.data.status, onlyStatus: parsed.data.onlyStatus, count: updated.length },
    });
    return { count: updated.length, actions: updated };
  });

  app.post("/api/actions/cleanup", async (request, reply) => {
    const parsed = CleanupActionsSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: { code: "bad_request", message: "Invalid cleanup request" } });
    const deleted = await deleteActions(parsed.data.mode);
    await appendEvent({
      type: "action_updated",
      source: "api",
      payload: { mode: "cleanup", cleanupMode: parsed.data.mode, count: deleted.length },
    });
    return { count: deleted.length, mode: parsed.data.mode };
  });

  app.post("/api/actions", async (request, reply) => {
    const parsed = CreateActionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "bad_request", message: "Invalid action request", details: parsed.error.flatten() } });
    }
    const now = new Date().toISOString();
    const action: ActionRequest = ActionRequestSchema.parse({
      ...parsed.data,
      id: randomUUID(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await writeAction(action);
    await appendEvent({ type: "action_created", source: "api", payload: { id: action.id, type: action.type, target: action.target } });
    return reply.status(201).send(action);
  });

  app.post("/api/actions/from-finding", async (request, reply) => {
    const parsed = CreateActionFromFindingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: "bad_request", message: "Invalid finding action request", details: parsed.error.flatten() } });
    }

    const recommendation = await buildRecommendationFromFinding(parsed.data);
    if (!recommendation) {
      return reply.status(404).send({ error: { code: "not_found", message: "Finding recommendation not found" } });
    }

    const existing = await findActionByDedupeKey(recommendation.dedupeKey);
    if (existing) {
      return reply.status(200).send({ action: existing, created: false, dedupeKey: recommendation.dedupeKey });
    }

    const now = new Date().toISOString();
    const action: ActionRequest = ActionRequestSchema.parse({
      id: randomUUID(),
      type: recommendation.primaryAction.actionType,
      title: recommendation.title,
      risk: recommendation.risk,
      target: recommendation.primaryAction.target,
      dedupeKey: recommendation.dedupeKey,
      payload: {
        dedupeKey: recommendation.dedupeKey,
        findingId: recommendation.findingId,
        primaryAction: recommendation.primaryAction,
        evidence: recommendation.evidence,
        readyState: recommendation.readyState,
        confidence: recommendation.confidence,
        manualOnly: recommendation.manualOnly,
      },
      intent: recommendation.primaryAction.reason,
      rollback: "Reject the pending action before execution; no source mutation has occurred.",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await writeAction(action);
    await appendEvent({
      type: "action_created",
      source: "api",
      payload: { id: action.id, type: action.type, target: action.target, dedupeKey: action.dedupeKey },
    });
    return reply.status(201).send({ action, created: true, dedupeKey: recommendation.dedupeKey });
  });

  app.get<{ Params: { actionId: string } }>("/api/actions/:actionId", async (request, reply) => {
    const action = await readAction(request.params.actionId);
    if (!action) return reply.status(404).send({ error: { code: "not_found", message: "Action not found" } });
    return action;
  });

  app.patch<{ Params: { actionId: string } }>("/api/actions/:actionId", async (request, reply) => {
    const parsed = PatchActionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: { code: "bad_request", message: "Invalid action patch" } });
    const action = await readAction(request.params.actionId);
    if (!action) return reply.status(404).send({ error: { code: "not_found", message: "Action not found" } });
    const updated = { ...action, status: parsed.data.status, updatedAt: new Date().toISOString() };
    await writeAction(updated);
    await appendEvent({ type: "action_updated", source: "api", payload: { id: updated.id, status: updated.status } });
    return updated;
  });

  app.get("/api/digest/latest", async () => ({ markdown: await readDigest() }));

  app.post("/api/digest/generate", async () => {
    const latest = await readLatestCheckRun();
    if (!latest) return scanWorkspace();
    return { markdown: await readDigest(), scannedAt: latest.scannedAt };
  });

  app.get("/api/gemma/status", async () => ({
    available: false,
    model: "gemma4:e4b",
    mode: "optional",
    message: "Gemma worker is not connected in V1. API returns safe fallback responses.",
  }));

  app.post("/api/gemma/summarize", async () => ({
    status: "fallback",
    summary: "Gemma is unavailable. Use the deterministic workspace digest instead.",
    digest: await readDigest(),
  }));

  return app;
}
