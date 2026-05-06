import test from "node:test";
import assert from "node:assert/strict";
import { HeuristicMemoryExtractor } from "../src/extract.js";

test("extractor detects decisions and preferences", async () => {
  const extractor = new HeuristicMemoryExtractor();
  const result = await extractor.extract({
    workspaceId: "demo",
    role: "user",
    content: "Decision: use Postgres for durable memory. I prefer markdown summaries for task notes.",
    turnIndex: 1,
  });

  assert.ok(result.decisions.length >= 1);
  assert.ok(result.facts.some((fact) => fact.subject === "user.preference"));
});

test("extractor returns entities and summary hint", async () => {
  const extractor = new HeuristicMemoryExtractor();
  const result = await extractor.extract({
    workspaceId: "demo",
    role: "assistant",
    content: "We will store memory in memory-service/src and document it in workspace/tasks/demo.md.",
    turnIndex: 2,
  });

  assert.ok(result.entities.length >= 1);
  assert.ok(result.summaryHint && result.summaryHint.length > 0);
});
