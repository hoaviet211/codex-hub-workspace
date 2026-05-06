import type {
  DecisionDraft,
  EntityDraft,
  FactDraft,
  MemoryExtraction,
  MemoryExtractor,
  MemoryTurnInput,
  RelationDraft,
} from "./types.js";
import { normalizeText, parseTags } from "./utils.js";

const FACT_PATTERNS: Array<{ regex: RegExp; subject: string; predicate: string; confidence: number }> = [
  { regex: /\bwe use ([^.?!]+)/i, subject: "system", predicate: "uses", confidence: 0.82 },
  { regex: /\buse ([^.?!]+)/i, subject: "system", predicate: "uses", confidence: 0.72 },
  { regex: /\bprefer ([^.?!]+)/i, subject: "preference", predicate: "prefers", confidence: 0.78 },
  { regex: /\bremember that ([^.?!]+)/i, subject: "memory", predicate: "remembers", confidence: 0.76 },
  { regex: /\bis decided(?: that)? ([^.?!]+)/i, subject: "decision", predicate: "decides", confidence: 0.86 },
];

const DECISION_PATTERNS: Array<{ regex: RegExp; confidence: number }> = [
  { regex: /\bdecision[:\-]\s*([^.?!]+)/i, confidence: 0.92 },
  { regex: /\bwe will ([^.?!]+)/i, confidence: 0.85 },
  { regex: /\bchose to ([^.?!]+)/i, confidence: 0.84 },
  { regex: /\bselected ([^.?!]+)/i, confidence: 0.8 },
];

export class HeuristicMemoryExtractor implements MemoryExtractor {
  async extract(input: MemoryTurnInput): Promise<MemoryExtraction> {
    const content = normalizeText(input.content);
    const facts = this.extractFacts(content);
    const decisions = this.extractDecisions(content, input.taskId);
    const entities = this.extractEntities(content);
    const relations = this.extractRelations(content, entities);
    const summaryHint = this.createSummaryHint(content, facts, decisions);
    return { facts, decisions, entities, relations, summaryHint };
  }

  private extractFacts(content: string): FactDraft[] {
    const facts: FactDraft[] = [];
    for (const pattern of FACT_PATTERNS) {
      const match = content.match(pattern.regex);
      if (!match?.[1]) continue;
      const statement = normalizeText(match[1]);
      facts.push({
        subject: pattern.subject,
        predicate: pattern.predicate,
        object: statement,
        statement: `${pattern.subject} ${pattern.predicate} ${statement}`,
        confidence: pattern.confidence,
      });
    }

    const preferenceMatches = content.match(/\b(i prefer|my preference is|i like)\b[^.?!]*/gi) ?? [];
    for (const match of preferenceMatches) {
      const statement = normalizeText(match);
      facts.push({
        subject: "user.preference",
        predicate: "prefers",
        object: statement,
        statement,
        confidence: 0.88,
      });
    }

    return dedupeFacts(facts);
  }

  private extractDecisions(content: string, taskId?: string): DecisionDraft[] {
    const decisions: DecisionDraft[] = [];
    for (const pattern of DECISION_PATTERNS) {
      const match = content.match(pattern.regex);
      if (!match?.[1]) continue;
      const decision = normalizeText(match[1]);
      decisions.push({
        title: decision.slice(0, 80),
        decision,
        confidence: pattern.confidence,
        taskId,
      });
    }
    return dedupeDecisions(decisions);
  }

  private extractEntities(content: string): EntityDraft[] {
    const tags = parseTags(content);
    const candidates = new Set<string>(tags);
    for (const path of content.match(/(?:[A-Za-z]:)?[\\/][\w./\\-]+/g) ?? []) {
      candidates.add(path);
    }
    for (const token of content.match(/\b[A-Z][a-zA-Z0-9_]{2,}\b/g) ?? []) {
      candidates.add(token);
    }
    return Array.from(candidates)
      .map((name) => name.trim())
      .filter((name) => name.length > 2)
      .slice(0, 12)
      .map((canonicalName) => ({
        canonicalName,
        entityType: inferEntityType(canonicalName),
        aliases: [],
        confidence: canonicalName.includes("/") ? 0.9 : 0.65,
      }));
  }

  private extractRelations(content: string, entities: EntityDraft[]): RelationDraft[] {
    if (entities.length < 2) return [];
    const [first, second] = entities;
    const relationType = content.includes("uses") ? "uses" : "related_to";
    const relation = `${first.canonicalName} ${relationType} ${second.canonicalName}`;
    return [
      {
        fromEntityName: first.canonicalName,
        toEntityName: second.canonicalName,
        relationType,
        relation,
        confidence: 0.42,
      },
    ];
  }

  private createSummaryHint(content: string, facts: FactDraft[], decisions: DecisionDraft[]): string {
    const sentences = content
      .split(/(?<=[.?!])\s+/)
      .map(normalizeText)
      .filter(Boolean)
      .slice(0, 3);
    const notable = [...facts.map((fact) => fact.statement), ...decisions.map((decision) => decision.decision)].slice(0, 3);
    return [...sentences, ...notable].join(" | ");
  }
}

function dedupeFacts(facts: FactDraft[]): FactDraft[] {
  const map = new Map<string, FactDraft>();
  for (const fact of facts) {
    const key = `${fact.subject}::${fact.predicate}::${normalizeText(fact.object ?? fact.statement).toLowerCase()}`;
    const existing = map.get(key);
    if (!existing || fact.confidence > existing.confidence) {
      map.set(key, fact);
    }
  }
  return Array.from(map.values());
}

function dedupeDecisions(decisions: DecisionDraft[]): DecisionDraft[] {
  const map = new Map<string, DecisionDraft>();
  for (const decision of decisions) {
    const key = normalizeText(decision.decision).toLowerCase();
    const existing = map.get(key);
    if (!existing || decision.confidence > existing.confidence) {
      map.set(key, decision);
    }
  }
  return Array.from(map.values());
}

function inferEntityType(name: string): string {
  if (name.includes("/") || name.includes("\\")) return "path";
  if (/^[A-Z][a-z]+$/.test(name)) return "person_or_org";
  return "term";
}
