import type { MemoryContextItem, MemoryKind } from "./types.js";
import { clamp, cosineSimilarity, nowIso } from "./utils.js";

export interface RankInput {
  queryEmbedding: number[];
  candidateEmbedding: number[] | null;
  confidence: number;
  createdAt: string;
  kind: MemoryKind;
  text: string;
  now?: string;
}

export function scoreCandidate(input: RankInput): number {
  const now = new Date(input.now ?? nowIso()).getTime();
  const createdAt = new Date(input.createdAt).getTime();
  const ageDays = Math.max((now - createdAt) / 86_400_000, 0);
  const recency = 1 / (1 + ageDays);
  const semantic = input.candidateEmbedding ? cosineSimilarity(input.queryEmbedding, input.candidateEmbedding) : 0;
  const confidence = clamp(input.confidence, 0, 1);
  const kindBoost = kindWeight(input.kind);
  return semantic * 0.55 + recency * 0.2 + confidence * 0.2 + kindBoost * 0.05;
}

export function kindWeight(kind: MemoryKind): number {
  switch (kind) {
    case "decision":
      return 1;
    case "fact":
      return 0.95;
    case "summary":
      return 0.8;
    case "entity":
      return 0.7;
    case "relation":
      return 0.65;
    case "turn":
    default:
      return 0.5;
  }
}

export function dedupeContextItems(items: MemoryContextItem[]): MemoryContextItem[] {
  const map = new Map<string, MemoryContextItem>();
  for (const item of items) {
    const key = `${item.kind}::${normalizeKey(item.title)}::${normalizeKey(item.text)}`;
    const existing = map.get(key);
    if (!existing || item.score > existing.score) {
      map.set(key, item);
    }
  }
  return Array.from(map.values()).sort((left, right) => right.score - left.score);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
