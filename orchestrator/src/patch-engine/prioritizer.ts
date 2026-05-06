// ============================================================
// Patch Engine — Prioritizer
// Sorts patches by dependency (topological) + risk level,
// then re-assigns priority numbers 1, 2, 3, ...
// ============================================================

import type { PatchPlan, PatchSpec } from './types.js'

// ---- Risk ordering ----

const RISK_ORDER: Record<PatchSpec['risk'], number> = {
  low: 0,
  medium: 1,
  high: 2,
}

// ---- Topological sort ----

/**
 * Topological sort of patches by dependency graph.
 * Returns sorted array or null if a circular dependency is detected.
 *
 * Algorithm: Kahn's algorithm (BFS)
 */
function topoSort(patches: PatchSpec[]): PatchSpec[] | null {
  const idToSpec = new Map<string, PatchSpec>()
  for (const p of patches) {
    idToSpec.set(p.patch_id, p)
  }

  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>() // who depends on X

  for (const p of patches) {
    if (!inDegree.has(p.patch_id)) inDegree.set(p.patch_id, 0)
    if (!dependents.has(p.patch_id)) dependents.set(p.patch_id, [])
  }

  for (const p of patches) {
    for (const dep of p.dependencies) {
      // dep must come before p — so p depends on dep
      // dep → p  (dep unblocks p)
      const current = inDegree.get(p.patch_id) ?? 0
      inDegree.set(p.patch_id, current + 1)

      const list = dependents.get(dep) ?? []
      list.push(p.patch_id)
      dependents.set(dep, list)
    }
  }

  // Collect all nodes with in-degree 0, sorted by risk (low first)
  const ready: PatchSpec[] = []
  for (const p of patches) {
    if ((inDegree.get(p.patch_id) ?? 0) === 0) {
      ready.push(p)
    }
  }
  ready.sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk])

  const sorted: PatchSpec[] = []

  while (ready.length > 0) {
    // Pop first item (already sorted by risk)
    const node = ready.shift()!
    sorted.push(node)

    // Reduce in-degree of dependents
    const children = dependents.get(node.patch_id) ?? []
    const newlyReady: PatchSpec[] = []

    for (const childId of children) {
      const deg = (inDegree.get(childId) ?? 0) - 1
      inDegree.set(childId, deg)
      if (deg === 0) {
        const child = idToSpec.get(childId)
        if (child) newlyReady.push(child)
      }
    }

    // Insert newly-ready children sorted by risk, then add to ready queue
    newlyReady.sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk])
    ready.push(...newlyReady)
  }

  // Circular dependency check: sorted must have all patches
  if (sorted.length !== patches.length) {
    return null // circular
  }

  return sorted
}

// ---- Public API ----

/**
 * Sort patches in a PatchPlan by:
 *   1. Topological order (dependencies first)
 *   2. Within same dependency level: risk ascending (low → high)
 *   3. Re-assign priority numbers 1, 2, 3, ...
 *
 * Falls back to original order if circular dependency detected.
 */
export function prioritizePatchPlan(plan: PatchPlan): PatchPlan {
  if (plan.patches.length === 0) return plan

  const sorted = topoSort(plan.patches)

  if (sorted === null) {
    console.warn(
      '[prioritizer] Circular dependency detected in patch plan — falling back to original order.'
    )
    // Re-number priorities on original order
    const renumbered = plan.patches.map((p, i) => ({ ...p, priority: i + 1 }))
    return { ...plan, patches: renumbered }
  }

  // Re-assign priority numbers starting from 1
  const renumbered = sorted.map((p, i) => ({ ...p, priority: i + 1 }))
  return { ...plan, patches: renumbered }
}
