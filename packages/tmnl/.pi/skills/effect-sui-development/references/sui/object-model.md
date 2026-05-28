---
up: INDEX.md
prereqs: ../grounding.md
provides: sui-object-model, object-refs, ownership-semantics, effect-sui-object-implications
children: none
update-strategy: refresh when Sui object model docs or Effect-Sui query/object schemas change
update-status: current
---

# Sui Object Model

> up: INDEX.md
> prereqs: ../grounding.md
> provides: sui-object-model, object-refs, ownership-semantics, effect-sui-object-implications
> children: none

Primary source: `submodules/sui/docs/content/develop/sui-architecture/object-model.mdx`.

## Core Model

Sui is object-centric. The unit of state is not an account balance row; it is an object with stable identity and versioned state.

| Concept | Sui meaning | Effect-Sui consequence |
|---|---|---|
| Object ID | Globally unique identifier for an object. | `SuiObjectId` is a branded/validated string boundary, never an anonymous `string` in public domain schemas. |
| Version / sequence number | Changes when an object is mutated. | Owned object transaction inputs must use fresh refs; stale versions become execution failures, not local no-ops. |
| Digest | Authenticates object contents for a given version. | `ObjectRef` must preserve `{ objectId, version, digest }` as inert authenticated data. |
| Owner | Address, object, shared, immutable, or wrapped state. | Query normalization must classify owner shape before Flow decides reservation/payment policy. |
| Type | Fully qualified Move struct type. | Decoding and registry dispatch key off type tags, not UI labels. |

## Move Object Shape

Move objects are structs with `key`. In Sui Move, an object struct's first field is conventionally and operationally its UID:

```move
public struct Counter has key {
    id: UID,
    value: u64,
}
```

The `id: UID` anchors the value as a Sui object. Other struct fields can contain primitives, addresses, non-object structs, or object references as the module allows.

## Ownership Modes

| Owner mode | Transaction semantics | Wrapper posture |
|---|---|---|
| Address-owned | Exclusive mutable access is version/ref based. | Reserve owned object refs for in-flight execution. |
| Object-owned | Object is nested under another object. | Treat as unavailable as a direct top-level input unless Sui/API returns an admissible ref. |
| Shared | Accessed through shared object ref with initial shared version and mutability. | Resolve to `SharedObjectRef({ objectId, initialSharedVersion, mutable })`; do not pretend it is an owned ref. |
| Immutable | Read-only object available to all. | No mutable reservation; still preserve authenticated identity. |
| Wrapped/deleted | Not directly usable as a live object input. | Classify as absent/unavailable in query errors/diagnostics. |

## ObjectRef vs SuiObject

Effect-Sui keeps a sharp distinction:

```text
SuiObjectRef = inert authenticated pointer
SuiObject    = active capability that can refresh/read/current-snapshot
```

This matters because a cached ref is safe to pass as transaction data only if it remains current. A `SuiObject` facade may refresh or derive a newer ref; a ref alone cannot.

## Query Decoder Implications

Use `client.core.getObject({ include: { content: true } })` when typed content is needed. The Mysten Core API docs warn that `json` content shape can vary by transport, while `content` is the BCS-encoded Move struct content intended for generated parsers. Do not feed `objectBcs` into a Move struct parser; it is an envelope with metadata.

Effect-Sui map:

- `src/schema/objects.ts`: public object/ref schemas.
- `src/query/resolver-core.ts`: object fetch and normalized result.
- `src/query/resolver-shared-ref.ts`: shared-owner to shared-ref conversion.
- `src/effectable/object.ts`: active object capability surface.

## Failure Modes to Preserve

- Stale owned object version: rebuild/query again; do not silently retry with the same ref.
- Shared object missing `initialSharedVersion`: cannot compile offline as a shared input.
- JSON content mismatch across transports: prefer BCS content + generated parser.
- Wrapped/deleted object: classify clearly; diagnostics may explain but must not alter execution semantics.
