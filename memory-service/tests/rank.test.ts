import test from "node:test";
import assert from "node:assert/strict";
import { dedupeContextItems, scoreCandidate } from "../src/rank.js";

test("scoreCandidate boosts recent confident items", () => {
  const high = scoreCandidate({
    queryEmbedding: [1, 0, 0],
    candidateEmbedding: [1, 0, 0],
    confidence: 0.9,
    createdAt: new Date().toISOString(),
    kind: "decision",
    text: "decision",
  });
  const low = scoreCandidate({
    queryEmbedding: [1, 0, 0],
    candidateEmbedding: [0, 1, 0],
    confidence: 0.2,
    createdAt: "2020-01-01T00:00:00.000Z",
    kind: "turn",
    text: "turn",
  });

  assert.ok(high > low);
});

test("dedupeContextItems keeps the best scored duplicate", () => {
  const items = dedupeContextItems([
    {
      kind: "fact",
      id: "1",
      title: "A",
      text: "same",
      confidence: 0.7,
      score: 0.5,
      source: "a",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      kind: "fact",
      id: "2",
      title: "A",
      text: "same",
      confidence: 0.8,
      score: 0.9,
      source: "b",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0]?.id, "2");
});
