#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { exit } from "node:process";
import { HeuristicMemoryExtractor } from "./extract.js";
import { createEmbeddingProviderFromEnv } from "./embedder.js";
import { MemoryService } from "./service.js";
import { PostgresMemoryStore } from "./storage.js";
import type { MemoryCandidateInput, MemoryPrunePolicy, MemorySourceInput, MemoryTurnInput } from "./types.js";

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

async function main(): Promise<void> {
  const [command = "help", ...rest] = process.argv.slice(2);
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const args = parseArgs(rest);
  const dbUrl = stringArg(args["database-url"]) ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const store = new PostgresMemoryStore(dbUrl);
  const memory = new MemoryService(store, createEmbeddingProviderFromEnv(process.env), new HeuristicMemoryExtractor());

  switch (command) {
    case "init": {
      await memory.init();
      console.log("Memory schema initialized.");
      break;
    }
    case "ingest": {
      await memory.init();
      const input = await loadTurnInput(args);
      const result = await memory.recordTurn(input);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "retrieve": {
      await memory.init();
      const workspaceId = requiredArg(args, "workspace");
      const projectId = requiredArg(args, "project");
      const query = requiredArg(args, "query");
      const limit = numberArg(args.limit) ?? 8;
      const context = await memory.retrieveContext({ workspaceId, projectId, query, limit, sessionId: stringArg(args.session) ?? undefined });
      console.log(JSON.stringify(context, null, 2));
      break;
    }
    case "summarize": {
      await memory.init();
      const workspaceId = requiredArg(args, "workspace");
      const projectId = requiredArg(args, "project");
      const sessionId = requiredArg(args, "session");
      const summary = await memory.summarizeSession(sessionId, workspaceId, projectId);
      console.log(JSON.stringify(summary, null, 2));
      break;
    }
    case "prune": {
      await memory.init();
      const policy: MemoryPrunePolicy = {
        workspaceId: stringArg(args.workspace) ?? undefined,
        projectId: requiredArg(args, "project"),
        archiveOlderThanDays: numberArg(args["archive-days"]) ?? 30,
        lowConfidenceThreshold: numberArg(args["confidence-threshold"]) ?? 0.45,
        keepRecentDays: numberArg(args["keep-recent-days"]) ?? 7,
      };
      const changed = await memory.pruneMemory(policy);
      console.log(JSON.stringify({ changed }, null, 2));
      break;
    }
    case "source:add": {
      await memory.init();
      const input = await loadJsonFile<MemorySourceInput>(requiredArg(args, "file"));
      const source = await memory.addSource(input);
      console.log(JSON.stringify(source, null, 2));
      break;
    }
    case "candidate:propose": {
      await memory.init();
      const input = await loadJsonFile<MemoryCandidateInput>(requiredArg(args, "file"));
      const candidate = await memory.proposeCandidate(input);
      console.log(JSON.stringify(candidate, null, 2));
      break;
    }
    case "candidate:list": {
      await memory.init();
      const workspaceId = requiredArg(args, "workspace");
      const projectId = stringArg(args.project) ?? undefined;
      const sessionId = stringArg(args.session) ?? undefined;
      const status = stringArg(args.status) as Parameters<typeof memory.listCandidates>[0]["status"] | undefined;
      const candidates = await memory.listCandidates({ workspaceId, projectId, sessionId, status });
      console.log(JSON.stringify(candidates, null, 2));
      break;
    }
    case "candidate:review": {
      await memory.init();
      const candidate = await memory.reviewCandidate({
        candidateId: requiredArg(args, "candidate"),
        action: requiredArg(args, "action") as "approve" | "reject" | "merge" | "mark_stale",
        reviewer: stringArg(args.reviewer) ?? "codex",
        note: stringArg(args.note) ?? null,
      });
      console.log(JSON.stringify(candidate, null, 2));
      break;
    }
    case "candidate:promote": {
      await memory.init();
      const item = await memory.promoteCandidate({
        candidateId: requiredArg(args, "candidate"),
        reviewer: stringArg(args.reviewer) ?? "codex",
        note: stringArg(args.note) ?? null,
      });
      console.log(JSON.stringify(item, null, 2));
      break;
    }
    case "export-sample": {
      const file = stringArg(args.file) ?? "sample-turn.json";
      const payload = {
        workspaceId: "demo-workspace",
        projectId: "demo-project",
        sessionId: "11111111-1111-1111-1111-111111111111",
        userId: "demo-user",
        role: "user",
        content: "We decided to keep task notes in workspace/tasks and use Postgres for durable memory.",
        turnIndex: 1,
        metadata: { taskId: "demo-task" },
      };
      await writeFile(file, JSON.stringify(payload, null, 2), "utf8");
      console.log(`Wrote ${file}`);
      break;
    }
    default:
      printHelp();
      break;
  }
}

async function loadTurnInput(args: Record<string, string | boolean>): Promise<MemoryTurnInput> {
  const file = stringArg(args.file);
  if (!file) {
    throw new Error("--file is required for ingest");
  }
  const raw = await readFile(file, "utf8");
  const parsed = JSON.parse(raw) as MemoryTurnInput;
  if (!parsed.workspaceId || !parsed.projectId || !parsed.sessionId || !parsed.content || !parsed.role || typeof parsed.turnIndex !== "number") {
    throw new Error("Input file must contain workspaceId, projectId, sessionId, role, content, and turnIndex");
  }
  return parsed;
}

async function loadJsonFile<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as T;
}

function requiredArg(args: Record<string, string | boolean>, key: string): string {
  const value = stringArg(args[key]);
  if (!value) {
    throw new Error(`--${key} is required`);
  }
  return value;
}

function stringArg(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberArg(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function printHelp(): void {
  console.log(`Usage:
  npm run cli -- init --database-url <url>
  npm run cli -- ingest --database-url <url> --file <turn.json>
  npm run cli -- retrieve --database-url <url> --workspace <id> --project <id> --query <text>
  npm run cli -- summarize --database-url <url> --workspace <id> --project <id> --session <id>
  npm run cli -- prune --database-url <url> --workspace <id> --project <id>
  npm run cli -- source:add --database-url <url> --file <source.json>
  npm run cli -- candidate:propose --database-url <url> --file <candidate.json>
  npm run cli -- candidate:list --database-url <url> --workspace <id> [--project <id>] [--status proposed]
  npm run cli -- candidate:review --database-url <url> --candidate <id> --action approve|reject|merge|mark_stale
  npm run cli -- candidate:promote --database-url <url> --candidate <id>
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  exit(1);
});
