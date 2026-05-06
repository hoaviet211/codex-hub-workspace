import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApiServer } from "../api";
import {
  ACTION_QUEUE_DIR,
  CHECKS_DIR,
  DIGEST_PATH,
  EVENTS_DIR,
  MEMORY_CANDIDATE_DIR,
  ORCHESTRATOR_ROOT,
} from "../paths";

describe("api safety", () => {
  it("has health endpoint and exposes no execute route", async () => {
    const app = createApiServer();
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ localhostOnly: true, commandExecution: false });

    const execute = await app.inject({ method: "POST", url: "/api/actions/test/execute" });
    expect(execute.statusCode).toBe(404);
  });

  it("rejects executed and failed status updates through approval endpoint", async () => {
    const app = createApiServer();
    const response = await app.inject({
      method: "PATCH",
      url: "/api/actions/abc",
      payload: { status: "executed" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects executed and failed status updates through bulk endpoint", async () => {
    const app = createApiServer();
    const response = await app.inject({
      method: "PATCH",
      url: "/api/actions/bulk",
      payload: { status: "executed", onlyStatus: "pending" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("exposes bootstrap limits and deterministic recommendation shape", async () => {
    const app = createApiServer();
    const response = await app.inject({ method: "GET", url: "/api/agent/bootstrap" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.contractVersion).toBe("1.5");
    expect(body.limits).toEqual({
      localhostOnly: true,
      commandExecution: false,
      manualOnlyDefault: true,
      mutationScope: ".orchestrator",
    });
    if ((body.nextSteps?.length ?? 0) > 0) {
      const rec = body.nextSteps[0];
      expect(rec).toHaveProperty("confidence");
      expect(rec).toHaveProperty("readyState");
      expect(rec).toHaveProperty("blockedBy");
      expect(rec).toHaveProperty("dedupeKey");
      expect(rec).toHaveProperty("manualOnly");
      expect(rec).toHaveProperty("primaryAction");
      expect(rec).not.toHaveProperty("nextActionHint");
    }
  });

  it("keeps file writes scoped to .orchestrator and avoids command-execution calls in API source", () => {
    const writablePaths = [ACTION_QUEUE_DIR, CHECKS_DIR, EVENTS_DIR, DIGEST_PATH, MEMORY_CANDIDATE_DIR];
    for (const filePath of writablePaths) {
      const normalized = path.resolve(filePath).replace(/\\/g, "/").toLowerCase();
      expect(normalized.includes("/.orchestrator/")).toBe(true);
      expect(normalized.startsWith(path.resolve(ORCHESTRATOR_ROOT).replace(/\\/g, "/").toLowerCase())).toBe(true);
    }

    const apiSourcePath = path.join(process.cwd(), "src/server/api.ts");
    const source = readFileSync(apiSourcePath, "utf8");
    expect(source.includes("exec(")).toBe(false);
    expect(source.includes("spawn(")).toBe(false);
    expect(source.includes("commandExecution: true")).toBe(false);
  });

  it("exposes memory candidate review without command execution", async () => {
    const app = createApiServer();
    const list = await app.inject({ method: "GET", url: "/api/memory/candidates?status=proposed" });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.json())).toBe(true);

    const execute = await app.inject({ method: "POST", url: "/api/memory/candidates/abc/execute" });
    expect(execute.statusCode).toBe(404);
  });
});
