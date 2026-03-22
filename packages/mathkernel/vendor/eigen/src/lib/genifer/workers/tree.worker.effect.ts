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
  op: "add" | "remove" | "replace" | "set" | "move" | "copy" | "test"
  path: string
  from?: string
  value?: unknown
}

interface ApplyPatchesRequest {
  tree: UITreeJSON
  patches: JsonPatchJSON[]
}

// =============================================================================
// Patch Application Logic (pure functions)
// =============================================================================

const decodePointerToken = (token: string): string =>
  token.replace(/~1/g, "/").replace(/~0/g, "~")

const pointerSegments = (path: string): string[] => {
  if (!path || path === "/") return []
  return path
    .split("/")
    .slice(1)
    .map(decodePointerToken)
}

const cloneValue = <A>(value: A): A => structuredClone(value)

const getByPointer = (target: unknown, path: string): unknown => {
  const segments = pointerSegments(path)
  let current: unknown = target

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined
      current = current[index]
      continue
    }

    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

const setByPointer = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
  mode: "add" | "replace" | "set",
): boolean => {
  const segments = pointerSegments(path)
  if (segments.length === 0) return false

  let current: unknown = target
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]

    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return false
      current = current[index]
      continue
    }

    if (!current || typeof current !== "object") return false

    const record = current as Record<string, unknown>
    const next = record[segment]
    if (next === undefined) {
      record[segment] = {}
      current = record[segment]
    } else {
      current = next
    }
  }

  const last = segments[segments.length - 1]

  if (Array.isArray(current)) {
    if (last === "-") {
      current.push(value)
      return true
    }

    const index = Number(last)
    if (!Number.isInteger(index) || index < 0) return false

    if (mode === "replace") {
      if (index >= current.length) return false
      current[index] = value
      return true
    }

    if (mode === "add") {
      if (index > current.length) return false
      current.splice(index, 0, value)
      return true
    }

    current[index] = value
    return true
  }

  if (!current || typeof current !== "object") return false

  const record = current as Record<string, unknown>
  if (mode === "replace" && !(last in record)) return false
  record[last] = value
  return true
}

const removeByPointer = (target: Record<string, unknown>, path: string): boolean => {
  const segments = pointerSegments(path)
  if (segments.length === 0) return false

  let current: unknown = target
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]

    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return false
      current = current[index]
      continue
    }

    if (!current || typeof current !== "object") return false
    current = (current as Record<string, unknown>)[segment]
  }

  const last = segments[segments.length - 1]

  if (Array.isArray(current)) {
    const index = Number(last)
    if (!Number.isInteger(index) || index < 0 || index >= current.length) return false
    current.splice(index, 1)
    return true
  }

  if (!current || typeof current !== "object") return false
  const record = current as Record<string, unknown>
  if (!(last in record)) return false
  delete record[last]
  return true
}

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

function applyPatch(tree: UITreeJSON, patch: JsonPatchJSON): UITreeJSON {
  const { op, path, value, from } = patch

  switch (op) {
    case "set":
    case "add":
    case "replace": {
      if (path === "/root") {
        return { ...tree, root: value as string }
      }

      const mutable = structuredClone(tree) as Record<string, unknown>
      const mode = op === "set" ? "set" : op
      const applied = setByPointer(mutable, path, value, mode)
      return applied ? (mutable as UITreeJSON) : tree
    }

    case "remove": {
      const mutable = structuredClone(tree) as Record<string, unknown>
      const removed = removeByPointer(mutable, path)
      return removed ? (mutable as UITreeJSON) : tree
    }

    case "move": {
      if (!from) return tree
      const mutable = structuredClone(tree) as Record<string, unknown>
      const movedValue = getByPointer(mutable, from)
      if (movedValue === undefined) return tree
      if (!removeByPointer(mutable, from)) return tree
      const added = setByPointer(mutable, path, movedValue, "add")
      return added ? (mutable as UITreeJSON) : tree
    }

    case "copy": {
      if (!from) return tree
      const mutable = structuredClone(tree) as Record<string, unknown>
      const copied = getByPointer(mutable, from)
      if (copied === undefined) return tree
      const added = setByPointer(mutable, path, cloneValue(copied), "add")
      return added ? (mutable as UITreeJSON) : tree
    }

    case "test": {
      const actual = getByPointer(tree as Record<string, unknown>, path)
      return deepEqual(actual, value) ? tree : tree
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
