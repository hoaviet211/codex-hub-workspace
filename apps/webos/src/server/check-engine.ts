import type { CheckFinding, WorkspaceSnapshot } from "../shared/schemas";

function finding(value: CheckFinding): CheckFinding {
  return value;
}

export function runChecks(snapshot: WorkspaceSnapshot): CheckFinding[] {
  const findings: CheckFinding[] = [];

  if (snapshot.git.error) {
    findings.push(finding({
      id: "git:status-unavailable",
      severity: "warn",
      category: "git",
      title: "Git status unavailable",
      evidence: snapshot.git.error,
      suggestedActionType: "clean_dirty_files",
    }));
  } else if (snapshot.git.dirty) {
    findings.push(finding({
      id: "git:dirty-worktree",
      severity: "warn",
      category: "git",
      title: "Dirty Git worktree",
      evidence: `${snapshot.git.changedFiles.length} changed file(s): ${snapshot.git.changedFiles.slice(0, 8).join(", ")}`,
      target: ".",
      suggestedActionType: "clean_dirty_files",
    }));
  } else {
    findings.push(finding({
      id: "git:clean-worktree",
      severity: "info",
      category: "git",
      title: "Git worktree clean",
      evidence: "No changed tracked files detected.",
      target: ".",
    }));
  }

  for (const project of snapshot.projects) {
    if (!project.exists) {
      findings.push(finding({
        id: `registry:${project.id}:missing-path`,
        severity: "block",
        category: "registry",
        title: "Registry path is missing",
        evidence: `${project.name} points to ${project.localPath}, but the path does not exist.`,
        target: project.localPath,
        suggestedActionType: "create_missing_project",
      }));
    }
  }

  if (!snapshot.projects.some((project) => project.id === "codex-hub-webos")) {
    findings.push(finding({
      id: "registry:codex-hub-webos:missing",
      severity: "warn",
      category: "registry",
      title: "WebOS project is not registered",
      evidence: "projects/registry.md does not include codex-hub-webos.",
      target: "projects/registry.md",
      suggestedActionType: "update_registry",
    }));
  }

  if (!snapshot.configPresent || !snapshot.agentsPresent || !snapshot.workflowsPresent) {
    findings.push(finding({
      id: "workspace:policy-files:missing",
      severity: "block",
      category: "workspace",
      title: "Required hub policy files are missing",
      evidence: `config=${snapshot.configPresent}, AGENTS=${snapshot.agentsPresent}, workflows=${snapshot.workflowsPresent}`,
      target: ".",
    }));
  }

  for (const task of snapshot.tasks) {
    if (!task.hasAcceptanceCriteria) {
      findings.push(finding({
        id: `process:${task.id}:missing-ac`,
        severity: "warn",
        category: "process",
        title: "Task missing acceptance criteria",
        evidence: `${task.path} has no testable Acceptance Criteria checklist.`,
        target: task.path,
        suggestedActionType: "create_task_note",
      }));
    }
    if (!task.hasDoneCriteria) {
      findings.push(finding({
        id: `process:${task.id}:missing-dod`,
        severity: "info",
        category: "process",
        title: "Task missing done criteria",
        evidence: `${task.path} has no explicit Done Criteria section.`,
        target: task.path,
        suggestedActionType: "review_closed_task",
      }));
    }
  }

  const suspiciousEncoding = snapshot.git.changedFiles.filter((file) => /\.(md|ts|tsx|json|yaml|yml)$/i.test(file) && /�/.test(file));
  for (const file of suspiciousEncoding) {
    findings.push(finding({
      id: `encoding:${file.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      severity: "warn",
      category: "encoding",
      title: "Possible encoding risk",
      evidence: `${file} contains replacement characters in Git file path metadata.`,
      target: file,
      suggestedActionType: "fix_encoding",
    }));
  }

  findings.push(finding({
    id: "security:v1-read-only-boundary",
    severity: "info",
    category: "security",
    title: "V1 mutation boundary active",
    evidence: "API endpoints are designed to write only .orchestrator outputs and action queue records.",
    target: ".orchestrator",
  }));

  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

export function summarizeFindings(findings: CheckFinding[]) {
  return {
    info: findings.filter((item) => item.severity === "info").length,
    warn: findings.filter((item) => item.severity === "warn").length,
    block: findings.filter((item) => item.severity === "block").length,
  };
}
