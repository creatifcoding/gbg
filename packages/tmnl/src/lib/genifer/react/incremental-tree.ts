import { useEffect, useRef, useState } from 'react'
import { Effect, HashMap } from 'effect'
import { applyPatch } from '../core/streaming'
import { decodeJsonPatchSync, UITree, UIElement, type JsonPatch } from '../core/schemas'

/** Convert nested node format ({ type, key, props, children:[node...] }) → UITree */
function parseNestedRoot(snapshot: Record<string, unknown>): UITree | null {
  if (typeof snapshot.type !== 'string') return null

  const entries = new Map<string, UIElement>()

  const visit = (node: Record<string, unknown>, parentKey: string | null, fallbackKey: string): string => {
    const key = typeof node.key === 'string' ? node.key : fallbackKey

    const rawProps = node.props && typeof node.props === 'object'
      ? { ...(node.props as Record<string, unknown>) }
      : {}

    const className = typeof node.className === 'string'
      ? node.className
      : typeof rawProps.className === 'string'
        ? rawProps.className
        : undefined

    if (rawProps.className !== undefined) {
      delete rawProps.className
    }

    const ref = node.ref ?? rawProps.ref
    const behavior = node.behavior ?? rawProps.behavior
    const bindings = Array.isArray(node.bindings)
      ? node.bindings
      : Array.isArray(rawProps.bindings)
        ? rawProps.bindings
        : undefined
    const dataSources = Array.isArray(node.dataSources)
      ? node.dataSources
      : Array.isArray(rawProps.dataSources)
        ? rawProps.dataSources
        : undefined
    const actions = Array.isArray(node.actions)
      ? node.actions
      : Array.isArray(rawProps.actions)
        ? rawProps.actions
        : undefined
    if (rawProps.ref !== undefined) delete rawProps.ref
    if (rawProps.behavior !== undefined) delete rawProps.behavior
    if (rawProps.bindings !== undefined) delete rawProps.bindings
    if (rawProps.dataSources !== undefined) delete rawProps.dataSources
    if (rawProps.actions !== undefined) delete rawProps.actions

    const childNodes = Array.isArray(node.children) ? node.children : []
    const childKeys: string[] = []

    childNodes.forEach((child, idx) => {
      if (!child || typeof child !== 'object') return
      const childKey = visit(
        child as Record<string, unknown>,
        key,
        `${key}:${idx}`,
      )
      childKeys.push(childKey)
    })

    entries.set(
      key,
      new UIElement({
        key,
        type: node.type as string,
        props: rawProps,
        children: childKeys,
        parentKey,
        ...(className ? { className } : {}),
        ...(ref !== undefined ? { ref } : {}),
        ...(behavior !== undefined ? { behavior } : {}),
        ...(bindings !== undefined ? { bindings } : {}),
        ...(dataSources !== undefined ? { dataSources } : {}),
        ...(actions !== undefined ? { actions } : {}),
      }),
    )

    return key
  }

  const root = visit(snapshot, null, 'root')
  return new UITree({ root, elements: HashMap.fromIterable(entries.entries()) })
}

const SNAPSHOT_STRING_CACHE_MAX = 64
const PATCH_STRING_CACHE_MAX = 256

const snapshotStringCache = new Map<string, UITree | null>()
const snapshotObjectCache = new WeakMap<object, UITree | null>()
const patchStringCache = new Map<string, JsonPatch | null>()
const patchObjectCache = new WeakMap<object, JsonPatch | null>()

const setBounded = <A>(cache: Map<string, A>, key: string, value: A, max: number): void => {
  if (cache.has(key)) {
    cache.delete(key)
  }
  cache.set(key, value)
  if (cache.size > max) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.delete(oldest)
    }
  }
}

/** Parse UITree from either nested-node or canonical { root, elements } snapshot. */
export function parseTreeSnapshot(snapshot: unknown): UITree | null {
  if (!snapshot) return null

  if (typeof snapshot === 'string') {
    if (snapshotStringCache.has(snapshot)) {
      return snapshotStringCache.get(snapshot) ?? null
    }
    let snap: Record<string, unknown>
    try {
      snap = JSON.parse(snapshot)
    } catch {
      setBounded(snapshotStringCache, snapshot, null, SNAPSHOT_STRING_CACHE_MAX)
      return null
    }
    const parsed = parseTreeSnapshot(snap)
    setBounded(snapshotStringCache, snapshot, parsed, SNAPSHOT_STRING_CACHE_MAX)
    return parsed
  }

  if (typeof snapshot !== 'object' || snapshot === null) {
    return null
  }

  if (snapshotObjectCache.has(snapshot)) {
    return snapshotObjectCache.get(snapshot) ?? null
  }

  const snap = snapshot as Record<string, unknown>

  // Format A: nested node tree
  const nestedTree = parseNestedRoot(snap)
  if (nestedTree) {
    snapshotObjectCache.set(snapshot, nestedTree)
    return nestedTree
  }

  // Format B: canonical UITree snapshot ({ root, elements })
  try {
    const elementsRaw = snap.elements
    if (!elementsRaw) {
      snapshotObjectCache.set(snapshot, null)
      return null
    }

    let entries: ReadonlyArray<readonly [string, UIElement]> = []

    if (Array.isArray(elementsRaw)) {
      entries = elementsRaw.flatMap((item): ReadonlyArray<readonly [string, UIElement]> => {
        if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string') {
          return [[item[0], new UIElement(item[1] as any)] as const]
        }
        if (item && typeof item === 'object' && typeof (item as any).key === 'string') {
          const obj = item as Record<string, unknown>
          return [[obj.key as string, new UIElement(obj as any)] as const]
        }
        return []
      })
    } else if (typeof elementsRaw === 'object') {
      entries = Object.entries(elementsRaw as Record<string, unknown>).map(
        ([k, v]) => [k, new UIElement(v as any)] as const,
      )
    } else {
      snapshotObjectCache.set(snapshot, null)
      return null
    }

    if (entries.length === 0) {
      snapshotObjectCache.set(snapshot, null)
      return null
    }

    const keys = entries.map(([k]) => k)
    const byKey = new Map(entries)

    const explicitRoot = typeof snap.root === 'string' ? snap.root : undefined
    const inferredRoot = keys.find((k) => byKey.get(k)?.parentKey == null) ?? keys[0]
    const root = explicitRoot && byKey.has(explicitRoot) ? explicitRoot : inferredRoot

    const tree = new UITree({ root, elements: HashMap.fromIterable(entries) })
    snapshotObjectCache.set(snapshot, tree)
    return tree
  } catch {
    snapshotObjectCache.set(snapshot, null)
    return null
  }
}

const decodeJsonPatchSafe = (value: unknown): JsonPatch | null => {
  try {
    const payload = typeof value === 'string' ? JSON.parse(value) : value
    return decodeJsonPatchSync(payload)
  } catch {
    return null
  }
}

const toJsonPatch = (value: unknown): JsonPatch | null => {
  if (value == null) return null

  if (typeof value === 'string') {
    if (patchStringCache.has(value)) {
      return patchStringCache.get(value) ?? null
    }
    const decoded = decodeJsonPatchSafe(value)
    setBounded(patchStringCache, value, decoded, PATCH_STRING_CACHE_MAX)
    return decoded
  }

  if (typeof value === 'object') {
    const key = value as object
    if (patchObjectCache.has(key)) {
      return patchObjectCache.get(key) ?? null
    }
    const decoded = decodeJsonPatchSafe(value)
    patchObjectCache.set(key, decoded)
    return decoded
  }

  return decodeJsonPatchSafe(value)
}

const applyPatchSafe = (tree: UITree, patch: JsonPatch): UITree | null => {
  const either = Effect.runSync(Effect.either(applyPatch(tree, patch)))
  return either._tag === 'Right' ? either.right : null
}

export const GENIFER_FIRST_PATCH_COMMITTED_EVENT = 'genifer:first-patch-committed'

export type IncrementalTreeDetails = {
  readonly treeSnapshot?: unknown
  readonly treePatch?: unknown
  readonly patchSeq?: number
  /** Operation start timestamp (epoch ms) */
  readonly startTs?: number
  /** Timestamp of first patch observed in harness stream (epoch ms) */
  readonly firstPatchReceivedTs?: number
  /** Stable identity for one patch stream (e.g. toolCallId/surfaceId tuple) */
  readonly streamKey?: string
}

/**
 * Incremental tree state for tool renderers.
 *
 * - Parses full snapshots only when checkpoint/final snapshots change.
 * - Applies incoming patches incrementally between snapshots.
 * - Dedupes patch application with patchSeq when present.
 * - Resets dedupe baseline when streamKey changes.
 */
export function useIncrementalTree(details: IncrementalTreeDetails | null | undefined): UITree | null {
  const snapshot = details?.treeSnapshot
  const patchRaw = details?.treePatch
  const patchSeq = typeof details?.patchSeq === 'number' ? details.patchSeq : undefined
  const startTs = typeof details?.startTs === 'number' ? details.startTs : undefined
  const firstPatchReceivedTs = typeof details?.firstPatchReceivedTs === 'number'
    ? details.firstPatchReceivedTs
    : undefined
  const streamKey = typeof details?.streamKey === 'string' ? details.streamKey : '__default__'

  const [state, setState] = useState<{
    tree: UITree | null
    lastPatchSeq: number
    streamKey: string
    firstPatchCommittedTs?: number
  }>(() => {
    const initialTree = parseTreeSnapshot(snapshot)
    const initialLastPatchSeq = initialTree
      ? (patchSeq ?? 0)
      : (typeof patchSeq === 'number' ? Math.max(0, patchSeq - 1) : 0)

    return {
      tree: initialTree,
      lastPatchSeq: initialLastPatchSeq,
      streamKey,
      firstPatchCommittedTs: undefined,
    }
  })

  useEffect(() => {
    const parsed = snapshot == null ? null : parseTreeSnapshot(snapshot)

    setState((prev) => {
      if (prev.streamKey !== streamKey) {
        const nextLastPatchSeq = parsed
          ? (patchSeq ?? 0)
          : (typeof patchSeq === 'number' ? Math.max(0, patchSeq - 1) : 0)

        return {
          tree: parsed,
          lastPatchSeq: nextLastPatchSeq,
          streamKey,
          firstPatchCommittedTs: undefined,
        }
      }

      if (!parsed) return prev
      return {
        tree: parsed,
        lastPatchSeq: patchSeq ?? prev.lastPatchSeq,
        streamKey,
        firstPatchCommittedTs: prev.firstPatchCommittedTs,
      }
    })
  }, [snapshot, patchSeq, streamKey])

  useEffect(() => {
    if (patchRaw == null) return
    const patch = toJsonPatch(patchRaw)
    if (!patch) return

    setState((prev) => {
      if (prev.streamKey !== streamKey) {
        return prev
      }

      if (typeof patchSeq === 'number' && patchSeq <= prev.lastPatchSeq) {
        return prev
      }

      const baseTree = prev.tree ?? UITree.empty()
      const nextTree = applyPatchSafe(baseTree, patch)
      if (!nextTree) return prev

      const nextSeq = typeof patchSeq === 'number' ? patchSeq : prev.lastPatchSeq + 1
      const nextCommittedTs = prev.firstPatchCommittedTs ?? Date.now()
      return {
        tree: nextTree,
        lastPatchSeq: nextSeq,
        streamKey,
        firstPatchCommittedTs: nextCommittedTs,
      }
    })
  }, [patchRaw, patchSeq, streamKey])

  const committedProbeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!state.firstPatchCommittedTs) return
    // Guard against stream rollover races: never emit with mismatched stream identity.
    if (state.streamKey !== streamKey) return

    const probeKey = `${state.streamKey}:${state.firstPatchCommittedTs}`
    if (committedProbeKeyRef.current === probeKey) return
    committedProbeKeyRef.current = probeKey

    if (typeof window === 'undefined') return

    const commitLatencyFromStartMs = typeof startTs === 'number'
      ? Math.max(0, state.firstPatchCommittedTs - startTs)
      : undefined
    const commitLagFromReceiveMs = typeof firstPatchReceivedTs === 'number'
      ? Math.max(0, state.firstPatchCommittedTs - firstPatchReceivedTs)
      : undefined

    window.dispatchEvent(
      new CustomEvent(GENIFER_FIRST_PATCH_COMMITTED_EVENT, {
        detail: {
          streamKey: state.streamKey,
          startTs,
          firstPatchReceivedTs,
          firstPatchCommittedTs: state.firstPatchCommittedTs,
          commitLatencyFromStartMs,
          commitLagFromReceiveMs,
        },
      }),
    )
  }, [state.firstPatchCommittedTs, state.streamKey, streamKey, startTs, firstPatchReceivedTs])

  return state.tree
}
