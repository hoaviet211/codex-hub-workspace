import fs from "node:fs";
import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import git from "isomorphic-git";
import { HUB_ROOT, safeResolveInsideHub, toPosixRelative } from "./paths";
import type { ProjectRecord, TaskRecord, WorkspaceSnapshot } from "../shared/schemas";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function readProjects(): Promise<ProjectRecord[]> {
  const registryPath = safeResolveInsideHub("projects/registry.md");
  if (!(await exists(registryPath))) return [];
  const markdown = await readFile(registryPath, "utf8");
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("Project |"))
    .map((line) => line.split("|").slice(1, -1).map((part) => part.trim().replace(/^`|`$/g, "")))
    .filter((cols) => cols.length >= 6)
    .map(([name, localPath, githubRepo, visibility, statusValue, lastUpdated]) => ({
      id: slug(name),
      name,
      localPath,
      githubRepo,
      visibility,
      status: statusValue,
      lastUpdated,
      exists: fs.existsSync(safeResolveInsideHub(localPath.replace(/\/$/, ""))),
    }));
}

async function readTaskFile(filePath: string): Promise<TaskRecord> {
  const body = await readFile(filePath, "utf8");
  const title = body.match(/^#\s+Task:\s*(.+)$/m)?.[1]?.trim() || path.basename(filePath, ".md");
  const project = body.match(/^- Project:\s*(.+)$/m)?.[1]?.trim();
  const status = body.includes("Closed ") ? "closed" : body.includes("- [ ]") ? "active" : "unknown";
  const fileStat = await stat(filePath);
  return {
    id: slug(path.basename(filePath, ".md")),
    title,
    path: toPosixRelative(filePath),
    status,
    project,
    hasAcceptanceCriteria: /## Acceptance Criteria/i.test(body) && /- \[[ x]\]/i.test(body),
    hasDoneCriteria: /## Done Criteria|## Done/i.test(body),
    updatedAt: fileStat.mtime.toISOString(),
  };
}

export async function readTasks(): Promise<TaskRecord[]> {
  const dir = safeResolveInsideHub("workspace/tasks");
  if (!(await exists(dir))) return [];
  const files = (await readdir(dir)).filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md");
  return Promise.all(files.map((file) => readTaskFile(path.join(dir, file))));
}

export async function readArtifacts(): Promise<{ count: number; recent: string[] }> {
  const dir = safeResolveInsideHub("workspace/artifacts");
  if (!(await exists(dir))) return { count: 0, recent: [] };
  const entries = await Promise.all(
    (await readdir(dir, { withFileTypes: true })).map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      const entryStat = await stat(fullPath);
      return { name: entry.name, mtime: entryStat.mtimeMs };
    }),
  );
  return {
    count: entries.length,
    recent: entries.sort((a, b) => b.mtime - a.mtime).slice(0, 8).map((entry) => entry.name),
  };
}

async function readGitStatus(): Promise<WorkspaceSnapshot["git"]> {
  try {
    const matrix = await git.statusMatrix({ fs, dir: HUB_ROOT });
    const changedFiles = matrix
      .filter(([, head, workdir, stage]) => head !== workdir || workdir !== stage)
      .map(([file]) => file)
      .sort();
    return { dirty: changedFiles.length > 0, changedFiles };
  } catch (error) {
    return { dirty: false, changedFiles: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export async function readWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const [gitStatus, projects, tasks, artifacts, configPresent, agentsPresent, workflowsPresent] = await Promise.all([
    readGitStatus(),
    readProjects(),
    readTasks(),
    readArtifacts(),
    exists(safeResolveInsideHub("config.yaml")),
    exists(safeResolveInsideHub("AGENTS.md")),
    exists(safeResolveInsideHub("workflows")),
  ]);

  return {
    hubRoot: HUB_ROOT,
    scannedAt: new Date().toISOString(),
    git: gitStatus,
    projects,
    tasks,
    artifacts,
    configPresent,
    agentsPresent,
    workflowsPresent,
  };
}
