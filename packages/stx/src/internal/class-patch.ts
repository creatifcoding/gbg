/**
 * @tmnl/stx — Class-aware optic operations
 *
 * Problem: Effect v4 Optic.replace/modify uses cloneShallow internally,
 * which throws on objects with non-Object constructors.
 *
 * This affects:
 * - Schema.TaggedClass instances at the root
 * - Class instances nested inside plain objects (e.g. { position: Vector })
 * - Any object tree containing class instances at any depth
 *
 * Solution: Deep-strip all class instances to plain objects (recording their
 * prototypes), run the optic on the plain tree, then deep-restore prototypes.
 *
 * Preserves:
 * - instanceof (prototype chain restored)
 * - Methods and computed getters (via prototype)
 * - _tag (data property, copied through)
 * - Structural sharing on primitive leaf values (Object.is still works)
 *
 * @module
 * @internal
 */

// ─── Detection ──────────────────────────────────────

/**
 * Returns true if `state` is a class instance (non-Object/null prototype).
 */
export function isClassInstance(state: unknown): state is object {
  if (state === null || typeof state !== "object") return false
  const proto = Object.getPrototypeOf(state)
  return proto !== null && proto !== Object.prototype
}

/**
 * Returns true if the object tree contains any class instances.
 * Walks own enumerable properties (shallow scan of values).
 */
function hasClassInstances(obj: unknown): boolean {
  if (obj === null || typeof obj !== "object") return false
  if (isClassInstance(obj)) return true
  const o: object = obj
  if (Array.isArray(o)) return o.some(hasClassInstances)
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (hasClassInstances(val)) return true
  }
  return false
}

// ─── Deep strip / restore ───────────────────────────

/**
 * Prototype map: records prototypes by path for restoration.
 */
type ProtoMap = Map<string, object>

/**
 * Opaque value: not a data container we should recurse into.
 * Maps, Sets, Dates, TypedArrays, RegExps, etc. are leaf values.
 */
function isOpaqueValue(obj: object): boolean {
  return (
    obj instanceof Map ||
    obj instanceof Set ||
    obj instanceof Date ||
    obj instanceof RegExp ||
    obj instanceof ArrayBuffer ||
    ArrayBuffer.isView(obj)
  )
}

/**
 * Recursively strip class prototypes to plain objects.
 * Records each stripped prototype with its path for restoration.
 *
 * Opaque values (Map, Set, Date, etc.) are treated as leaves — not recursed.
 * Pure plain branches with no class instances are returned by reference (zero-copy).
 */
function deepStrip(obj: any, path: string, protos: ProtoMap): any {
  if (obj === null || typeof obj !== "object") return obj
  if (isOpaqueValue(obj)) return obj // leaf — don't recurse
  if (Array.isArray(obj)) {
    if (!obj.some(hasClassInstances)) return obj // fast path
    return obj.map((item, i) => deepStrip(item, `${path}[${i}]`, protos))
  }

  const proto = Object.getPrototypeOf(obj)
  const isClass = proto !== null && proto !== Object.prototype

  // Fast path: fully plain subtree — return by ref
  if (!isClass && !hasClassInstances(obj)) return obj

  if (isClass) protos.set(path, proto)

  const result: Record<string, any> = {}
  for (const [key, val] of Object.entries(obj)) {
    const childPath = path ? `${path}.${key}` : key
    result[key] = deepStrip(val, childPath, protos)
  }
  return result
}

/**
 * Recursively restore prototypes from the map.
 * Only reconstructs objects whose paths appear in the proto map.
 * Other objects are returned as-is (preserving optic's structural sharing).
 */
function deepRestore(obj: any, path: string, protos: ProtoMap): any {
  if (obj === null || typeof obj !== "object") return obj
  if (Array.isArray(obj)) {
    if (protos.size === 0) return obj
    return obj.map((item, i) => deepRestore(item, `${path}[${i}]`, protos))
  }

  // Recurse into children first
  let needsRestore = protos.has(path)
  let hasChildProtos = false
  for (const key of Object.keys(obj)) {
    const childPath = path ? `${path}.${key}` : key
    // Check if any descendant has a proto to restore
    for (const p of protos.keys()) {
      if (p === childPath || p.startsWith(childPath + ".") || p.startsWith(childPath + "[")) {
        hasChildProtos = true
        break
      }
    }
    if (hasChildProtos) break
  }

  if (!needsRestore && !hasChildProtos) return obj // nothing to do in this subtree

  const result: Record<string, any> = {}
  for (const [key, val] of Object.entries(obj)) {
    const childPath = path ? `${path}.${key}` : key
    result[key] = deepRestore(val, childPath, protos)
  }

  const proto = protos.get(path)
  if (proto) {
    return Object.assign(Object.create(proto), result)
  }
  return result
}

// ─── Public API ─────────────────────────────────────

/**
 * Class-aware Optic.replace.
 *
 * Handles class instances at ANY depth in the state tree.
 * Plain objects with no class instances → zero-overhead passthrough.
 */
export function classAwareReplace<S extends object, A>(
  optic: { replace: (value: A, state: S) => S },
  value: A,
  state: S,
): S {
  if (!hasClassInstances(state)) return optic.replace(value, state)

  const protos: ProtoMap = new Map()
  const plain = deepStrip(state, "", protos) as S
  const updated = optic.replace(value, plain)
  return deepRestore(updated, "", protos) as S
}

/**
 * Class-aware Optic.modify.
 *
 * Same deep-strip/restore strategy as classAwareReplace.
 */
export function classAwareModify<S extends object, A>(
  optic: { modify: (f: (a: A) => A) => (state: S) => S },
  fn: (a: A) => A,
  state: S,
): S {
  if (!hasClassInstances(state)) return optic.modify(fn)(state)

  const protos: ProtoMap = new Map()
  const plain = deepStrip(state, "", protos) as S
  const updated = optic.modify(fn)(plain)
  return deepRestore(updated, "", protos) as S
}
