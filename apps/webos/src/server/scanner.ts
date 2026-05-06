import { randomUUID } from "node:crypto";
import type { CheckRun, WorkspaceOverview } from "../shared/schemas";
import { runChecks, summarizeFindings } from "./check-engine";
import { readWorkspaceSnapshot } from "./workspace-adapter";
import { appendEvent, listActions, readDigest, readLatestCheckRun, writeCheckRun } from "./storage";

export function buildDigest(run: CheckRun): string {
  const lines = [
    "# Codex Hub Workspace Digest",
    "",
    `Generated: ${run.scannedAt}`,
    "",
    "## Summary",
    "",
    `- Projects: ${run.snapshot.projects.length}`,
    `- Tasks: ${run.snapshot.tasks.length}`,
    `- Findings: ${run.findings.length} (${run.summary.block} block, ${run.summary.warn} warn, ${run.summary.info} info)`,
    `- Git dirty: ${run.snapshot.git.dirty ? "yes" : "no"}`,
    "",
    "## Top Findings",
    "",
    ...run.findings.slice(0, 12).map((finding) => `- [${finding.severity}] ${finding.title}: ${finding.evidence}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export async function scanWorkspace(): Promise<CheckRun> {
  const correlationId = randomUUID();
  await appendEvent({ type: "scan_started", source: "api", correlationId, payload: {} });
  const snapshot = await readWorkspaceSnapshot();
  const findings = runChecks(snapshot);
  const run: CheckRun = {
    id: correlationId,
    scannedAt: snapshot.scannedAt,
    findings,
    summary: summarizeFindings(findings),
    snapshot,
  };
  await writeCheckRun(run, buildDigest(run));
  await appendEvent({
    type: "scan_completed",
    source: "check-engine",
    correlationId,
    payload: { findings: findings.length, summary: run.summary },
  });
  return run;
}

export async function getOverview(): Promise<WorkspaceOverview> {
  const latest = await readLatestCheckRun();
  const pendingActions = await listActions("pending");
  if (!latest) {
    return {
      health: "unknown",
      counts: { projects: 0, tasks: 0, findings: 0, actionsPending: pendingActions.length },
      topFindings: [],
      digest: await readDigest(),
    };
  }
  const health = latest.summary.block > 0 ? "block" : latest.summary.warn > 0 ? "warn" : "ok";
  return {
    scannedAt: latest.scannedAt,
    health,
    counts: {
      projects: latest.snapshot.projects.length,
      tasks: latest.snapshot.tasks.length,
      findings: latest.findings.length,
      actionsPending: pendingActions.length,
    },
    topFindings: latest.findings.filter((finding) => finding.severity !== "info").slice(0, 6),
    digest: await readDigest(),
  };
}
