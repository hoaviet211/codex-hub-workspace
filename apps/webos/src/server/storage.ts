import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ACTION_QUEUE_DIR,
  DIGEST_PATH,
  EVENTS_DIR,
  LATEST_CHECK_PATH,
  MEMORY_CANDIDATE_DIR,
} from "./paths";
import type { ActionRequest, CheckRun, EventRecord, MemoryCandidate, MemoryCandidateStatus } from "../shared/schemas";
import { ActionRequestSchema, MemoryCandidateSchema } from "../shared/schemas";

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function atomicWriteText(filePath: string, value: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(tempPath, value, "utf8");
  await rename(tempPath, filePath);
}

export async function appendEvent(event: Omit<EventRecord, "id" | "timestamp">): Promise<EventRecord> {
  await ensureDir(EVENTS_DIR);
  const record: EventRecord = {
    ...event,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const day = record.timestamp.slice(0, 10);
  await writeFile(path.join(EVENTS_DIR, `${day}.jsonl`), `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
  return record;
}

export async function readLatestCheckRun(): Promise<CheckRun | undefined> {
  try {
    return JSON.parse(await readFile(LATEST_CHECK_PATH, "utf8")) as CheckRun;
  } catch {
    return undefined;
  }
}

export async function writeCheckRun(run: CheckRun, digest: string): Promise<void> {
  await atomicWriteJson(LATEST_CHECK_PATH, run);
  await atomicWriteText(DIGEST_PATH, digest);
}

export async function readDigest(): Promise<string> {
  try {
    return await readFile(DIGEST_PATH, "utf8");
  } catch {
    return "";
  }
}

export async function listHistory(limit: number): Promise<unknown[]> {
  try {
    const files = (await readdir(EVENTS_DIR)).filter((name) => name.endsWith(".jsonl")).sort().reverse();
    const records: unknown[] = [];
    for (const file of files) {
      const lines = (await readFile(path.join(EVENTS_DIR, file), "utf8")).trim().split(/\r?\n/).filter(Boolean).reverse();
      for (const line of lines) {
        records.push(JSON.parse(line));
        if (records.length >= limit) return records;
      }
    }
    return records;
  } catch {
    return [];
  }
}

export async function listActions(status?: string): Promise<ActionRequest[]> {
  await ensureDir(ACTION_QUEUE_DIR);
  const files = (await readdir(ACTION_QUEUE_DIR)).filter((name) => name.endsWith(".json"));
  const actions = await Promise.all(
    files.map(async (file) => ActionRequestSchema.parse(JSON.parse(await readFile(path.join(ACTION_QUEUE_DIR, file), "utf8")))),
  );
  return actions.filter((action) => !status || action.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function findActionByDedupeKey(dedupeKey: string): Promise<ActionRequest | undefined> {
  const actions = await listActions();
  return actions.find((action) => action.dedupeKey === dedupeKey || action.payload?.dedupeKey === dedupeKey);
}

export async function readAction(id: string): Promise<ActionRequest | undefined> {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) return undefined;
  try {
    return ActionRequestSchema.parse(JSON.parse(await readFile(path.join(ACTION_QUEUE_DIR, `${id}.json`), "utf8")));
  } catch {
    return undefined;
  }
}

export async function writeAction(action: ActionRequest): Promise<void> {
  await atomicWriteJson(path.join(ACTION_QUEUE_DIR, `${action.id}.json`), action);
}

export async function deleteActions(mode: "resolved" | "all"): Promise<ActionRequest[]> {
  const actions = await listActions();
  const targets = mode === "all" ? actions : actions.filter((action) => action.status !== "pending");
  await Promise.all(targets.map((action) => unlink(path.join(ACTION_QUEUE_DIR, `${action.id}.json`))));
  return targets;
}

export async function listMemoryCandidates(status?: MemoryCandidateStatus): Promise<MemoryCandidate[]> {
  await ensureDir(MEMORY_CANDIDATE_DIR);
  const files = (await readdir(MEMORY_CANDIDATE_DIR)).filter((name) => name.endsWith(".json"));
  const candidates = await Promise.all(
    files.map(async (file) => MemoryCandidateSchema.parse(JSON.parse(await readFile(path.join(MEMORY_CANDIDATE_DIR, file), "utf8")))),
  );
  return candidates.filter((candidate) => !status || candidate.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readMemoryCandidate(id: string): Promise<MemoryCandidate | undefined> {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) return undefined;
  try {
    return MemoryCandidateSchema.parse(JSON.parse(await readFile(path.join(MEMORY_CANDIDATE_DIR, `${id}.json`), "utf8")));
  } catch {
    return undefined;
  }
}

export async function writeMemoryCandidate(candidate: MemoryCandidate): Promise<void> {
  await atomicWriteJson(path.join(MEMORY_CANDIDATE_DIR, `${candidate.id}.json`), candidate);
}
