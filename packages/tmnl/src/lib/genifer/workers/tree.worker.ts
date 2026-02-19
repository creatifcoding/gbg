/**
 * Tree Worker
 *
 * Offloads applyPatches() from main thread.
 * Receives UITree + JsonPatch[], returns updated UITree.
 *
 * @module genifer/workers/tree
 */

// =============================================================================
// Interfaces (duplicated to avoid bundling issues)
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

// =============================================================================
// Message Types
// =============================================================================

export interface ApplyPatchesRequest {
  type: "applyPatches"
  id: number
  tree: UITreeJSON
  patches: JsonPatchJSON[]
}

export interface ApplyPatchesResponse {
  type: "applied"
  id: number
  tree: UITreeJSON
  patchesApplied: number
  errors: string[]
}

export type TreeWorkerRequest = ApplyPatchesRequest
export type TreeWorkerResponse = ApplyPatchesResponse

// =============================================================================
// Path Utilities (duplicated from path.ts)
// =============================================================================

const parsePathSegments = (path: string): string[] =>
  !path || path === "/"
    ? []
    : path.startsWith("/")
      ? path.slice(1).split("/")
      : path.split("/")

/**
 * Set value at path (immutable)
 */
const setByPath = <T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): T => {
  const segments = parsePathSegments(path)

  if (segments.length === 0) {
    return value as T
  }

  // Deep clone and set
  const result = structuredClone(obj) as T
  let current: Record<string, unknown> = result

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!
    if (!(segment in current) || typeof current[segment] !== "object" || current[segment] === null) {
      current[segment] = {}
    }
    current = current[segment] as Record<string, unknown>
  }

  const lastSegment = segments[segments.length - 1]!
  current[lastSegment] = value

  return result
}

// =============================================================================
// UITree Operations (pure functions, no Effect)
// =============================================================================

const treeGetElement = (tree: UITreeJSON, key: string): UIElementJSON | undefined =>
  tree.elements[key]

const treeSetElement = (tree: UITreeJSON, key: string, element: UIElementJSON): UITreeJSON => ({
  root: tree.root,
  elements: { ...tree.elements, [key]: element }
})

const treeRemoveElement = (tree: UITreeJSON, key: string): UITreeJSON => {
  const { [key]: _, ...rest } = tree.elements
  return { root: tree.root, elements: rest }
}

const treeSetRoot = (tree: UITreeJSON, root: string): UITreeJSON => ({
  root,
  elements: tree.elements
})

// =============================================================================
// Patch Application
// =============================================================================

/**
 * Apply a single patch to a UITree (pure function)
 */
const applyPatch = (tree: UITreeJSON, patch: JsonPatchJSON): UITreeJSON => {
  const op = patch.op
  const path = patch.path

  switch (op) {
    case "set":
    case "add":
    case "replace": {
      // Handle root path
      if (path === "/root") {
        return treeSetRoot(tree, patch.value as string)
      }

      // Handle elements paths
      if (path.startsWith("/elements/")) {
        const pathParts = path.slice("/elements/".length).split("/")
        const elementKey = pathParts[0]

        if (!elementKey) return tree

        if (pathParts.length === 1) {
          // Setting entire element
          const element = patch.value as UIElementJSON
          // Ensure defaults
          const normalized: UIElementJSON = {
            key: element.key,
            type: element.type,
            props: element.props ?? {},
            children: element.children ?? [],
            parentKey: element.parentKey ?? null,
            visible: element.visible,
            entrance: element.entrance,
          }
          return treeSetElement(tree, elementKey, normalized)
        } else {
          // Setting property of element
          const existingElement = treeGetElement(tree, elementKey)
          if (existingElement) {
            const propPath = "/" + pathParts.slice(1).join("/")
            const updated = setByPath(
              { ...existingElement } as Record<string, unknown>,
              propPath,
              patch.value
            ) as unknown as UIElementJSON
            return treeSetElement(tree, elementKey, updated)
          }
        }
      }
      return tree
    }

    case "remove": {
      if (path.startsWith("/elements/")) {
        const elementKey = path.slice("/elements/".length).split("/")[0]
        if (elementKey) {
          return treeRemoveElement(tree, elementKey)
        }
      }
      return tree
    }

    default:
      return tree
  }
}

/**
 * Apply multiple patches to a tree (batch operation)
 */
const applyPatches = (
  tree: UITreeJSON,
  patches: JsonPatchJSON[]
): { tree: UITreeJSON; errors: string[] } => {
  const errors: string[] = []
  let current = tree

  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i]!
    try {
      current = applyPatch(current, patch)
    } catch (e) {
      errors.push(`Patch ${i} failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { tree: current, errors }
}

// =============================================================================
// Worker Message Handler
// =============================================================================

self.onmessage = (event: MessageEvent<TreeWorkerRequest>) => {
  const request = event.data

  switch (request.type) {
    case "applyPatches": {
      const { tree, errors } = applyPatches(request.tree, request.patches)
      const response: ApplyPatchesResponse = {
        type: "applied",
        id: request.id,
        tree,
        patchesApplied: request.patches.length,
        errors,
      }
      self.postMessage(response)
      break
    }
  }
}

// Signal worker is ready
self.postMessage({ type: "ready" })
