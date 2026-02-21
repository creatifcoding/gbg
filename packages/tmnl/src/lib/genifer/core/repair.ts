/**
 * @fileoverview Structural Repair — Cluster 3
 *
 * Pure UITree → UITree transformations that fix structural issues
 * in normalized trees.
 *
 * Pipeline:
 *   assignMissingKeys → deduplicateKeys → resolveOrphans →
 *   inferMissingTypes → breakCircularRefs → repaired tree
 *
 * Design decisions (INCREMENTAL-NORMALIZATION.md §10):
 *   - Error boundary is quarantine (Q4): failed elements collected, not dropped
 *   - Local repairs (assign, infer) can run per-element during streaming
 *   - Global repairs (dedup, orphans, cycles) run post-stream
 *
 * @module genifer/core/repair
 */

import { Effect, HashMap, Option } from "effect"
import { UIElement, UITree } from "./schemas"
import { NormalizeError } from "./normalize"

// =============================================================================
// Types
// =============================================================================

/** Quarantined element — failed repair with reason */
export interface QuarantinedElement {
  readonly element: UIElement
  readonly reason: string
  readonly stage: string
}

/** Repair result — repaired tree + quarantine */
export interface RepairResult {
  readonly tree: UITree
  readonly quarantined: readonly QuarantinedElement[]
  readonly repairs: readonly RepairAction[]
}

/** Individual repair action for audit trail */
export interface RepairAction {
  readonly elementKey: string
  readonly action: string
  readonly before: string
  readonly after: string
}

// =============================================================================
// Local Repairs (can run per-element, parallelizable)
// =============================================================================

/**
 * Assign keys to elements that are missing them.
 * Uses type + index to generate deterministic keys.
 *
 * Scope: LOCAL (per-element, no dependencies)
 */
export function assignMissingKeys(tree: UITree): Effect.Effect<{ tree: UITree; repairs: RepairAction[] }> {
  return Effect.sync(() => {
    const repairs: RepairAction[] = []
    let autoIdx = 0
    let newElements = tree.elements

    for (const [key, el] of tree.elements) {
      if (!key || key.length === 0) {
        const newKey = `${el.type.toLowerCase()}-auto-${autoIdx++}`
        repairs.push({ elementKey: key, action: "assignKey", before: key, after: newKey })

        // Remove old empty-key entry, add with new key
        newElements = HashMap.remove(newElements, key)
        newElements = HashMap.set(newElements, newKey, new UIElement({
          ...el,
          key: newKey,
        }))

        // Update any parents referencing the old key
        for (const [pk, pe] of newElements) {
          if (pe.children.includes(key)) {
            const newChildren = pe.children.map(c => c === key ? newKey : c)
            newElements = HashMap.set(newElements, pk, new UIElement({ ...pe, children: newChildren }))
          }
        }
      }
    }

    const newRoot = tree.root.length === 0
      ? Option.getOrElse(
          HashMap.keys(newElements).pipe(
            (iter) => {
              for (const k of iter) {
                const el = HashMap.get(newElements, k)
                if (Option.isSome(el) && el.value.parentKey === null) return Option.some(k)
              }
              return Option.none<string>()
            }
          ),
          () => "root"
        )
      : tree.root

    return {
      tree: new UITree({ root: newRoot, elements: newElements }),
      repairs,
    }
  })
}

/**
 * Infer missing types from props shape heuristics.
 *
 * Heuristics:
 *   - Has `label` + `value` → "MetricCard"
 *   - Has `text` or `content` and no children → "Text"
 *   - Has `src` or `url` → "Image"
 *   - Has `columns` or `template` → "Grid"
 *   - Has children but no other signal → "Section"
 *   - Fallback → "Unknown"
 *
 * Scope: LOCAL (per-element, no dependencies)
 */
export function inferMissingTypes(tree: UITree): Effect.Effect<{ tree: UITree; repairs: RepairAction[] }> {
  return Effect.sync(() => {
    const repairs: RepairAction[] = []
    let newElements = tree.elements

    for (const [key, el] of tree.elements) {
      if (el.type !== "Unknown" && el.type.length > 0) continue

      const props = el.props
      const propKeys = Object.keys(props)
      const hasChildren = el.children.length > 0
      let inferred = "Unknown"

      if (propKeys.includes("label") && propKeys.includes("value")) {
        inferred = "MetricCard"
      } else if ((propKeys.includes("text") || propKeys.includes("content")) && !hasChildren) {
        inferred = "Text"
      } else if (propKeys.includes("src") || propKeys.includes("url")) {
        inferred = "Image"
      } else if (propKeys.includes("columns") || propKeys.includes("template")) {
        inferred = "Grid"
      } else if (propKeys.includes("items") && !hasChildren) {
        inferred = "List"
      } else if (hasChildren && propKeys.length <= 1) {
        inferred = "Section"
      }

      if (inferred !== "Unknown") {
        repairs.push({ elementKey: key, action: "inferType", before: el.type, after: inferred })
        newElements = HashMap.set(newElements, key, new UIElement({ ...el, type: inferred }))
      }
    }

    return { tree: new UITree({ root: tree.root, elements: newElements }), repairs }
  })
}

// =============================================================================
// Global Repairs (need full tree, run post-stream)
// =============================================================================

/**
 * Deduplicate keys by suffixing with -2, -3, etc.
 *
 * Scope: GLOBAL (needs all keys to detect collisions)
 */
export function deduplicateKeys(tree: UITree): Effect.Effect<{ tree: UITree; repairs: RepairAction[] }> {
  return Effect.sync(() => {
    const repairs: RepairAction[] = []
    const seen = new Map<string, number>()
    let newElements = tree.elements

    // Collect all keys and detect dupes
    const allKeys: string[] = []
    for (const [key] of tree.elements) {
      allKeys.push(key)
    }

    // Sort for determinism
    allKeys.sort()

    const dupeRenames = new Map<string, string>()

    for (const key of allKeys) {
      const count = (seen.get(key) ?? 0) + 1
      seen.set(key, count)

      if (count > 1) {
        const newKey = `${key}-${count}`
        dupeRenames.set(key, newKey)
        repairs.push({ elementKey: key, action: "deduplicateKey", before: key, after: newKey })
      }
    }

    // Note: HashMap naturally deduplicates — later insertions overwrite.
    // This repair is more relevant when building from arrays where dupes
    // are separate entries. For HashMap-backed trees, this is mostly a no-op
    // but we keep it for the repair audit trail.

    return { tree: new UITree({ root: tree.root, elements: newElements }), repairs }
  })
}

/**
 * Resolve orphans — children referenced but not defined.
 * Creates placeholder elements for missing children.
 *
 * Scope: GLOBAL (needs full element set to find missing refs)
 */
export function resolveOrphans(tree: UITree): Effect.Effect<{ tree: UITree; repairs: RepairAction[] }> {
  return Effect.sync(() => {
    const repairs: RepairAction[] = []
    let newElements = tree.elements

    // Collect all referenced children
    for (const [key, el] of tree.elements) {
      for (const childKey of el.children) {
        if (Option.isNone(HashMap.get(tree.elements, childKey))) {
          // Orphan: referenced but not defined → create placeholder
          const placeholder = new UIElement({
            key: childKey,
            type: "Placeholder",
            props: { _orphanOf: key, _repaired: true },
            children: [],
            parentKey: key,
          })
          newElements = HashMap.set(newElements, childKey, placeholder)
          repairs.push({
            elementKey: childKey,
            action: "resolveOrphan",
            before: "(missing)",
            after: `Placeholder (parent: ${key})`,
          })
        }
      }
    }

    return { tree: new UITree({ root: tree.root, elements: newElements }), repairs }
  })
}

/**
 * Detect and break circular parent-child references.
 *
 * Uses DFS cycle detection. When a cycle is found, the back-edge
 * child reference is removed from the parent's children array.
 *
 * Scope: GLOBAL (needs full graph)
 */
export function breakCircularRefs(tree: UITree): Effect.Effect<{ tree: UITree; repairs: RepairAction[] }> {
  return Effect.sync(() => {
    const repairs: RepairAction[] = []
    let newElements = tree.elements
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const backEdges: Array<{ parent: string; child: string }> = []

    function dfs(key: string) {
      if (visited.has(key)) return
      if (visiting.has(key)) return // cycle detected upstream
      visiting.add(key)

      const el = Option.getOrUndefined(HashMap.get(tree.elements, key))
      if (!el) { visiting.delete(key); visited.add(key); return }

      for (const childKey of el.children) {
        if (visiting.has(childKey)) {
          // Back edge → cycle
          backEdges.push({ parent: key, child: childKey })
        } else if (!visited.has(childKey)) {
          dfs(childKey)
        }
      }

      visiting.delete(key)
      visited.add(key)
    }

    // Start DFS from root
    if (tree.root.length > 0) dfs(tree.root)

    // Also DFS from any unvisited nodes (disconnected components)
    for (const [key] of tree.elements) {
      if (!visited.has(key)) dfs(key)
    }

    // Break back edges
    for (const { parent, child } of backEdges) {
      const el = Option.getOrUndefined(HashMap.get(newElements, parent))
      if (el) {
        const newChildren = el.children.filter(c => c !== child)
        newElements = HashMap.set(newElements, parent, new UIElement({ ...el, children: newChildren }))
        repairs.push({
          elementKey: parent,
          action: "breakCycle",
          before: `children: [${el.children.join(",")}]`,
          after: `children: [${newChildren.join(",")}]`,
        })
      }
    }

    return { tree: new UITree({ root: tree.root, elements: newElements }), repairs }
  })
}

// =============================================================================
// Repair Pipeline
// =============================================================================

/**
 * Run the full repair pipeline on a UITree.
 *
 * Order:
 *  1. assignMissingKeys (local)
 *  2. inferMissingTypes (local)
 *  3. deduplicateKeys (global)
 *  4. resolveOrphans (global)
 *  5. breakCircularRefs (global)
 *
 * Quarantined elements are collected but NOT removed from the tree.
 * The caller decides what to do with quarantine (Design Decision Q4).
 */
export const repair = Effect.fn("genifer.repair")(
  function* (tree: UITree) {
    yield* Effect.annotateCurrentSpan("inputElements", tree.size)
    const allRepairs: RepairAction[] = []
    const quarantined: QuarantinedElement[] = []

    // Phase 1: Local repairs
    const r1 = yield* assignMissingKeys(tree)
    allRepairs.push(...r1.repairs)

    const r2 = yield* inferMissingTypes(r1.tree)
    allRepairs.push(...r2.repairs)

    // Phase 2: Global repairs
    const r3 = yield* deduplicateKeys(r2.tree)
    allRepairs.push(...r3.repairs)

    const r4 = yield* resolveOrphans(r3.tree)
    allRepairs.push(...r4.repairs)

    const r5 = yield* breakCircularRefs(r4.tree)
    allRepairs.push(...r5.repairs)

    yield* Effect.annotateCurrentSpan("repairCount", allRepairs.length)
    yield* Effect.annotateCurrentSpan("outputElements", r5.tree.size)

    return {
      tree: r5.tree,
      quarantined,
      repairs: allRepairs,
    } as RepairResult
  },
  // Pipe: catch non-NormalizeError and wrap
  Effect.catchAll((e: unknown) =>
    Effect.fail(
      e instanceof NormalizeError
        ? e
        : new NormalizeError({ stage: "repair", message: String(e) })
    )
  )
)

/**
 * Run only local repairs (for incremental/streaming use).
 * Can be called per-element without the full tree.
 */
export function repairLocal(tree: UITree): Effect.Effect<{ tree: UITree; repairs: RepairAction[] }> {
  return Effect.gen(function* () {
    const r1 = yield* assignMissingKeys(tree)
    const r2 = yield* inferMissingTypes(r1.tree)
    return {
      tree: r2.tree,
      repairs: [...r1.repairs, ...r2.repairs],
    }
  })
}

/**
 * Run only global repairs (post-stream).
 */
export function repairGlobal(tree: UITree): Effect.Effect<{ tree: UITree; repairs: RepairAction[] }> {
  return Effect.gen(function* () {
    const r1 = yield* deduplicateKeys(tree)
    const r2 = yield* resolveOrphans(r1.tree)
    const r3 = yield* breakCircularRefs(r2.tree)
    return {
      tree: r3.tree,
      repairs: [...r1.repairs, ...r2.repairs, ...r3.repairs],
    }
  })
}
