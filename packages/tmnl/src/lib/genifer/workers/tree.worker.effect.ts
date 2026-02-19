/**
 * Tree Worker Runner (Effect Platform)
 *
 * Worker-side implementation using @effect/platform Runner.
 * Handles applyPatches requests with proper Effect integration.
 *
 * @module genifer/workers/tree.worker.effect
 */

import * as BrowserRunner from "@effect/platform-browser/BrowserWorkerRunner"
import * as Runner from "@effect/platform/WorkerRunner"
import { Effect, Layer, Stream } from "effect"

// =============================================================================
// Types (duplicated to avoid bundling issues)
// =============================================================================

interface UIElementJSON {
  key: string
  type: string
  props: Record<string, unknown>
  children: string[]
  parentKey: string | null
  visible?: unknown
  entrance?: unknown
}

interface UITreeJSON {
  root: string
  elements: Record<string, UIElementJSON>
}

interface JsonPatchJSON {
  op: "add" | "remove" | "replace" | "set"
  path: string
  value?: unknown
}

interface ApplyPatchesRequest {
  tree: UITreeJSON
  patches: JsonPatchJSON[]
}

// =============================================================================
// Patch Application Logic (pure functions)
// =============================================================================

function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = path.split("/").filter(Boolean)
  if (parts.length === 0) return obj

  const result = structuredClone(obj)
  let current: Record<string, unknown> = result

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!(key in current)) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
  return result
}

function applyPatch(tree: UITreeJSON, patch: JsonPatchJSON): UITreeJSON {
  const { op, path, value } = patch

  switch (op) {
    case "set":
    case "add":
    case "replace": {
      if (path === "/root") {
        return { ...tree, root: value as string }
      }

      if (path.startsWith("/elements/")) {
        const pathParts = path.slice("/elements/".length).split("/")
        const elementKey = pathParts[0]
        if (!elementKey) return tree

        if (pathParts.length === 1) {
          return {
            ...tree,
            elements: { ...tree.elements, [elementKey]: value as UIElementJSON },
          }
        } else {
          const existingElement = tree.elements[elementKey]
          if (existingElement) {
            const propPath = "/" + pathParts.slice(1).join("/")
            const updated = setByPath(
              existingElement as unknown as Record<string, unknown>,
              propPath,
              value
            )
            return {
              ...tree,
              elements: {
                ...tree.elements,
                [elementKey]: updated as unknown as UIElementJSON,
              },
            }
          }
        }
      }
      return tree
    }

    case "remove": {
      if (path.startsWith("/elements/")) {
        const elementKey = path.slice("/elements/".length).split("/")[0]
        if (elementKey && tree.elements[elementKey]) {
          const { [elementKey]: _, ...rest } = tree.elements
          return { ...tree, elements: rest }
        }
      }
      return tree
    }

    default:
      return tree
  }
}

function applyPatches(tree: UITreeJSON, patches: JsonPatchJSON[]): UITreeJSON {
  let current = tree
  for (const patch of patches) {
    current = applyPatch(current, patch)
  }
  return current
}

// =============================================================================
// Worker Runner
// =============================================================================

/**
 * Worker layer that handles applyPatches requests.
 * Returns a Stream with single result (could support streaming partial results).
 */
const TreeWorkerLive = Runner.layer((request: ApplyPatchesRequest) =>
  Stream.make(
    applyPatches(request.tree, request.patches)
  )
).pipe(Layer.provide(BrowserRunner.layer))

// Launch the worker
Effect.runFork(Runner.launch(TreeWorkerLive))
