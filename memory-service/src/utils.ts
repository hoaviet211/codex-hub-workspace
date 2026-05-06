import { createHash, randomUUID } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  return randomUUID();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

export function canonicalKey(parts: Array<string | null | undefined>): string {
  return parts.map((part) => normalizeText(part ?? "").toLowerCase()).filter(Boolean).join("::");
}

export function hashText(text: string): number[] {
  const digest = createHash("sha256").update(text).digest();
  const out: number[] = [];
  for (let index = 0; index < 32; index += 1) {
    out.push(digest[index] / 255);
  }
  return out;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

export function parseTags(text: string): string[] {
  const matches = text.match(/`([^`]+)`/g) ?? [];
  return matches.map((item) => item.slice(1, -1));
}
