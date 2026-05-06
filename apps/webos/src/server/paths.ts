import path from "node:path";

export const PROJECT_ROOT = path.resolve(process.cwd());
export const HUB_ROOT = path.resolve(process.env.CODEX_HUB_ROOT ?? path.join(PROJECT_ROOT, "..", ".."));
export const ORCHESTRATOR_ROOT = path.join(HUB_ROOT, ".orchestrator");
export const CHECKS_DIR = path.join(ORCHESTRATOR_ROOT, "checks");
export const EVENTS_DIR = path.join(ORCHESTRATOR_ROOT, "events");
export const ACTION_QUEUE_DIR = path.join(ORCHESTRATOR_ROOT, "action-queue");
export const MEMORY_CANDIDATE_DIR = path.join(ORCHESTRATOR_ROOT, "memory-candidates");
export const DIGEST_PATH = path.join(ORCHESTRATOR_ROOT, "workspace-digest.md");
export const LATEST_CHECK_PATH = path.join(CHECKS_DIR, "latest.json");

export function toPosixRelative(absolutePath: string): string {
  return path.relative(HUB_ROOT, absolutePath).split(path.sep).join("/");
}

export function safeResolveInsideHub(relativePath: string): string {
  const resolved = path.resolve(HUB_ROOT, relativePath);
  const relative = path.relative(HUB_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes hub root: ${relativePath}`);
  }
  return resolved;
}
