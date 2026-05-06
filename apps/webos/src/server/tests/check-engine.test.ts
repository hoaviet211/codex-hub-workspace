import { describe, expect, it } from "vitest";
import { runChecks } from "../check-engine";
import { readTasks } from "../workspace-adapter";
import type { WorkspaceSnapshot } from "../../shared/schemas";

const snapshot: WorkspaceSnapshot = {
  hubRoot: "C:/hub",
  scannedAt: "2026-04-25T00:00:00.000Z",
  git: { dirty: true, changedFiles: ["AGENTS.md"] },
  projects: [
    {
      id: "demo",
      name: "demo",
      localPath: "projects/demo/",
      githubRepo: "(not set)",
      visibility: "private",
      status: "active",
      lastUpdated: "2026-04-25",
      exists: false,
    },
  ],
  tasks: [
    {
      id: "task-one",
      title: "Task One",
      path: "workspace/tasks/task-one.md",
      status: "active",
      hasAcceptanceCriteria: false,
      hasDoneCriteria: false,
    },
  ],
  artifacts: { count: 0, recent: [] },
  configPresent: true,
  agentsPresent: true,
  workflowsPresent: true,
};

describe("check engine", () => {
  it("is deterministic for the same input snapshot", () => {
    expect(runChecks(snapshot)).toEqual(runChecks(snapshot));
  });

  it("reports dirty git, missing registry path, missing WebOS registration, and task process warnings", () => {
    const ids = runChecks(snapshot).map((finding) => finding.id);
    expect(ids).toContain("git:dirty-worktree");
    expect(ids).toContain("registry:demo:missing-path");
    expect(ids).toContain("registry:codex-hub-webos:missing");
    expect(ids).toContain("process:task-one:missing-ac");
  });

  it("does not treat the task folder README as an executable task note", async () => {
    const tasks = await readTasks();
    expect(tasks.every((task) => task.path !== "workspace/tasks/README.md")).toBe(true);
  });
});
