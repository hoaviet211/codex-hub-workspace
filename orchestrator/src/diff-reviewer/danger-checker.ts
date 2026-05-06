// ============================================================
// Diff Reviewer — Danger Checker
// Warn on schema / auth / config / env changes and destructive patterns
// ============================================================

import type { DimensionResult } from './types.js'

interface DangerPattern {
  label: string
  /** Test a file path */
  pathTest?: (p: string) => boolean
  /** Test the full diff content */
  contentTest?: (d: string) => boolean
}

const DANGER_PATTERNS: DangerPattern[] = [
  // ---- Path-based patterns ----
  {
    label: 'schema file (migration/schema/.sql/prisma)',
    pathTest: (p) =>
      /migration/i.test(p) ||
      /schema/i.test(p) ||
      /\.sql$/i.test(p) ||
      /prisma\//i.test(p),
  },
  {
    label: 'auth file (auth/jwt/session/password/token)',
    pathTest: (p) =>
      /auth/i.test(p) ||
      /jwt/i.test(p) ||
      /session/i.test(p) ||
      /password/i.test(p) ||
      /token/i.test(p),
  },
  {
    label: 'config/secrets file (.env/config./secrets/credentials)',
    pathTest: (p) =>
      /\.env/i.test(p) ||
      /config\./i.test(p) ||
      /secrets/i.test(p) ||
      /credentials/i.test(p),
  },
  // ---- Content-based (destructive) patterns ----
  {
    label: 'destructive SQL: DROP TABLE',
    contentTest: (d) => /DROP\s+TABLE/i.test(d),
  },
  {
    label: 'destructive SQL: DELETE FROM',
    contentTest: (d) => /DELETE\s+FROM/i.test(d),
  },
  {
    label: 'destructive shell: rm -rf',
    contentTest: (d) => /rm\s+-rf/i.test(d),
  },
  {
    label: 'unsafe Node.js: process.exit',
    contentTest: (d) => /process\.exit/.test(d),
  },
]

/**
 * Check for dangerous file changes or destructive diff content.
 *
 * @param changedFiles  File paths extracted from the diff
 * @param diffContent   Full raw diff text
 */
export function checkDanger(
  changedFiles: string[],
  diffContent: string
): DimensionResult {
  const matched: string[] = []

  for (const pattern of DANGER_PATTERNS) {
    if (pattern.pathTest) {
      for (const file of changedFiles) {
        if (pattern.pathTest(file)) {
          matched.push(`${pattern.label}: ${file}`)
          break  // report pattern once even if multiple files match
        }
      }
    }
    if (pattern.contentTest && pattern.contentTest(diffContent)) {
      matched.push(pattern.label)
    }
  }

  if (matched.length > 0) {
    return {
      dimension: 'danger',
      outcome: 'warn',
      reason: `${matched.length} danger pattern(s) detected — manual review recommended.`,
      details: matched,
    }
  }

  return {
    dimension: 'danger',
    outcome: 'pass',
    reason: 'No danger patterns detected.',
  }
}
