import test from "node:test";
import assert from "node:assert/strict";
import { HashEmbeddingProvider } from "../src/embedder.js";
import { HeuristicMemoryExtractor } from "../src/extract.js";
import { MemoryService } from "../src/service.js";
import { InMemoryMemoryStore } from "../src/storage.js";

test("recordTurn stores memory and retrieves a compact context", async () => {
  const store = new InMemoryMemoryStore();
  const service = new MemoryService(store, new HashEmbeddingProvider(), new HeuristicMemoryExtractor(), {
    summaryAfterTurns: 2,
    retrievalLimit: 5,
    summaryWindowTurns: 2,
  });

  await service.init();
  const first = await service.recordTurn({
    workspaceId: "demo",
    projectId: "project-a",
    sessionId: "s1",
    userId: "u1",
    role: "user",
    turnIndex: 1,
    content: "Decision: use Postgres for durable memory and prefer markdown task notes.",
    metadata: { taskId: "t1" },
  });
  const result = await service.recordTurn({
    workspaceId: "demo",
    projectId: "project-a",
    sessionId: "s1",
    userId: "u1",
    role: "assistant",
    turnIndex: 2,
    content: "We should keep task notes in workspace/tasks and use workspace/artifacts for reusable output.",
    metadata: { taskId: "t1" },
  });

  assert.ok(result.turn.id);
  assert.ok(result.facts.length > 0);
  assert.ok(first.decisions.length > 0);
  assert.ok(result.summary);
  assert.ok(result.context.items.length > 0);
});

test("pruneMemory archives older low-confidence items", async () => {
  const store = new InMemoryMemoryStore();
  const service = new MemoryService(store, new HashEmbeddingProvider(), new HeuristicMemoryExtractor());
  await service.init();

  await service.recordTurn({
    workspaceId: "demo",
    projectId: "project-a",
    sessionId: "s1",
    userId: "u1",
    role: "user",
    turnIndex: 1,
    content: "Remember that cache is temporary.",
  });

  const changed = await service.pruneMemory({
    workspaceId: "demo",
    archiveOlderThanDays: 0,
    lowConfidenceThreshold: 0.99,
    keepRecentDays: 0,
  });

  assert.ok(changed >= 0);
});

test("retrieveContext stays inside project scope", async () => {
  const store = new InMemoryMemoryStore();
  const service = new MemoryService(store, new HashEmbeddingProvider(), new HeuristicMemoryExtractor());
  await service.init();

  await service.recordTurn({
    workspaceId: "customer-a",
    projectId: "project-a",
    sessionId: "task-1",
    userId: "u1",
    role: "user",
    turnIndex: 1,
    content: "Decision: use Postgres for project A.",
  });

  await service.recordTurn({
    workspaceId: "customer-a",
    projectId: "project-b",
    sessionId: "task-2",
    userId: "u1",
    role: "user",
    turnIndex: 1,
    content: "Decision: use Redis for project B.",
  });

  const context = await service.retrieveContext({
    workspaceId: "customer-a",
    projectId: "project-a",
    query: "What did we decide?",
    limit: 5,
  });

  assert.ok(context.items.some((item) => item.text.includes("Postgres")));
  assert.ok(!context.items.some((item) => item.text.includes("Redis")));
});

test("candidate review keeps unapproved candidates out of retrieval", async () => {
  const store = new InMemoryMemoryStore();
  const service = new MemoryService(store, new HashEmbeddingProvider(), new HeuristicMemoryExtractor());
  await service.init();

  const source = await service.addSource({
    workspaceId: "demo",
    projectId: "project-a",
    sessionId: "task-1",
    sourceType: "artifact",
    sourcePath: "workspace/artifacts/spec.md",
    sourceHash: "sha256-demo",
  });

  await service.proposeCandidate({
    workspaceId: "demo",
    projectId: "project-a",
    sessionId: "task-1",
    sourceId: source.id,
    type: "project_decision",
    title: "Gemma curator boundary",
    summary: "Gemma proposes memory candidates only and cannot write canonical memory.",
    evidence: ["workspace/artifacts/spec.md"],
    confidence: 0.9,
    suggestedDestination: "memory-service",
    model: "gemma4:e4b",
  });

  const context = await service.retrieveContext({
    workspaceId: "demo",
    projectId: "project-a",
    query: "Gemma curator boundary",
    limit: 10,
  });

  assert.ok(!context.items.some((item) => item.text.includes("Gemma proposes memory candidates only")));
});

test("only approved candidates can be promoted into canonical memory", async () => {
  const store = new InMemoryMemoryStore();
  const service = new MemoryService(store, new HashEmbeddingProvider(), new HeuristicMemoryExtractor());
  await service.init();

  const source = await service.addSource({
    workspaceId: "demo",
    projectId: "project-a",
    sessionId: "task-1",
    sourceType: "manual",
    sourcePath: "manual://operator",
    sourceHash: "manual-1",
  });

  const candidate = await service.proposeCandidate({
    workspaceId: "demo",
    projectId: "project-a",
    sessionId: "task-1",
    sourceId: source.id,
    type: "reusable_workflow",
    title: "Approved memory workflow",
    summary: "Approved candidates become canonical memory items with evidence.",
    evidence: ["manual://operator"],
    confidence: 0.88,
    suggestedDestination: "memory-service",
  });

  await assert.rejects(() => service.promoteCandidate({ candidateId: candidate.id, reviewer: "tester" }), /must be approved/);

  await service.reviewCandidate({ candidateId: candidate.id, action: "approve", reviewer: "tester", note: "accepted" });
  const item = await service.promoteCandidate({ candidateId: candidate.id, reviewer: "tester", note: "promoted" });

  assert.equal(item.sourceCandidateId, candidate.id);
  assert.equal(item.status, "active");

  const context = await service.retrieveContext({
    workspaceId: "demo",
    projectId: "project-a",
    query: "canonical memory items evidence",
    limit: 10,
  });

  assert.ok(context.items.some((entry) => entry.kind === "item" && entry.id === item.id));
});

test("invalid candidate JSON is rejected before insertion", async () => {
  const store = new InMemoryMemoryStore();
  const service = new MemoryService(store, new HashEmbeddingProvider(), new HeuristicMemoryExtractor());
  await service.init();

  await assert.rejects(
    () => service.proposeCandidate({
      workspaceId: "demo",
      projectId: "project-a",
      sourceId: "11111111-1111-1111-1111-111111111111",
      type: "project_decision",
      title: "Invalid candidate",
      summary: "Missing evidence should fail.",
      evidence: [],
      confidence: 1.2,
      suggestedDestination: "memory-service",
    }),
    /evidence|confidence/,
  );

  assert.equal(store.snapshot().candidates.length, 0);
});
