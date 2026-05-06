import { unlink } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_QUEUE_DIR } from "../paths";
import { createApiServer } from "../api";

function expectStaleMetaShape(value: Record<string, unknown>): void {
  expect(typeof value.generatedAt).toBe("string");
  expect(typeof value.stale).toBe("boolean");
  expect("sourceScanAt" in value).toBe(true);
  expect("staleReason" in value).toBe(true);
  expect(["complete", "partial", "empty"]).toContain(value.dataCompleteness);
}

describe("agent context endpoints", () => {
  it("returns context brief with deterministic compact shape", async () => {
    const app = createApiServer();
    const response = await app.inject({ method: "GET", url: "/api/context/brief?scope=workspace&verbosity=compact" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.scope).toBe("workspace");
    expect(body.verbosity).toBe("compact");
    expect(typeof body.summary.findings).toBe("number");
    expect(Array.isArray(body.topFindings)).toBe(true);
    expectStaleMetaShape(body);
  });

  it("returns recommendation with primaryAction and required agent metadata", async () => {
    const app = createApiServer();
    const response = await app.inject({ method: "GET", url: "/api/next-step/recommendation?scope=workspace" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.scope).toBe("workspace");
    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.primaryAction).toBeTruthy();
    if (body.recommendations.length > 0) {
      const rec = body.recommendations[0];
      expect(typeof rec.confidence).toBe("number");
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
      expect(typeof rec.confidenceReason).toBe("string");
      expect(["ready", "blocked", "needs_review"]).toContain(rec.readyState);
      expect(Array.isArray(rec.blockedBy)).toBe(true);
      expect(typeof rec.dedupeKey).toBe("string");
      expect(typeof rec.manualOnly).toBe("boolean");
      expect(["low", "medium", "high"]).toContain(rec.risk);
      expect(Array.isArray(rec.evidence)).toBe(true);
      expect(rec).not.toHaveProperty("nextActionHint");
    }
    expectStaleMetaShape(body);
  });

  it("returns task and project context with extended fields", async () => {
    const app = createApiServer();
    const tasksResponse = await app.inject({ method: "GET", url: "/api/tasks/context?status=active&limit=5" });
    expect(tasksResponse.statusCode).toBe(200);
    const tasksBody = tasksResponse.json();
    expect(Array.isArray(tasksBody.items)).toBe(true);
    if (tasksBody.items.length > 0) {
      const item = tasksBody.items[0];
      expect(Array.isArray(item.missingFields)).toBe(true);
      expect(["low", "medium", "high"]).toContain(item.riskLevel);
      expect(Array.isArray(item.relatedFiles)).toBe(true);
    }
    expectStaleMetaShape(tasksBody);

    const projectsResponse = await app.inject({ method: "GET", url: "/api/projects/context?includeDirty=true" });
    expect(projectsResponse.statusCode).toBe(200);
    const projectsBody = projectsResponse.json();
    expect(Array.isArray(projectsBody.items)).toBe(true);
    if (projectsBody.items.length > 0) {
      const item = projectsBody.items[0];
      expect(item.registryInfo).toBeTruthy();
      expect(Array.isArray(item.relatedTasks)).toBe(true);
      expect(Array.isArray(item.relatedDirtyFiles)).toBe(true);
    }
    expectStaleMetaShape(projectsBody);
  });

  it("returns workspace source map", async () => {
    const app = createApiServer();
    const response = await app.inject({ method: "GET", url: "/api/workspace/source-map" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.scope).toBe("workspace");
    expect(Array.isArray(body.entries)).toBe(true);
    expect(body.entries.length).toBeGreaterThan(0);
    expectStaleMetaShape(body);
  });

  it("creates pending action from finding once per dedupeKey", async () => {
    const app = createApiServer();
    const recommendationResponse = await app.inject({ method: "GET", url: "/api/next-step/recommendation?scope=workspace&limit=1" });
    expect(recommendationResponse.statusCode).toBe(200);
    const recommendation = recommendationResponse.json().recommendations[0];
    expect(recommendation).toBeTruthy();

    const first = await app.inject({
      method: "POST",
      url: "/api/actions/from-finding",
      payload: { dedupeKey: recommendation.dedupeKey },
    });
    expect([200, 201]).toContain(first.statusCode);
    const firstBody = first.json();
    expect(firstBody.dedupeKey).toBe(recommendation.dedupeKey);
    if (firstBody.created === true) {
      expect(firstBody.action.status).toBe("pending");
    }
    expect(firstBody.action.dedupeKey).toBe(recommendation.dedupeKey);

    const second = await app.inject({
      method: "POST",
      url: "/api/actions/from-finding",
      payload: { dedupeKey: recommendation.dedupeKey },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.created).toBe(false);
    expect(secondBody.action.id).toBe(firstBody.action.id);

    if (firstBody.created === true) {
      await unlink(path.join(ACTION_QUEUE_DIR, `${firstBody.action.id}.json`));
    }
  });
});
