# Research Spike: Effect Data Structures for Genifer

**Date**: 2026-02-20
**Status**: Active
**Author**: Val (architectural research)
**Context**: Replacing naive JS `Map`/plain-object patterns with Effect's persistent/immutable collections for UITree, TreeCache, CatalogService, and stream isolation.

---

## 1. Complete Inventory of Effect Data Structures

### 1.1 Immutable Collections

| Module | Structure | Key Properties | Complexity | Use in Genifer? |
|--------|-----------|---------------|------------|-----------------|
| **HashMap** | Hash Array Mapped Trie (HAMT) | Unordered K→V, structural equality via `Equal`+`Hash` traits, O(1) avg lookup/insert/remove. Supports `mutate()` for batch-mutable windows. | O(1) avg | **UITree.elements** — replace `Record<string, UIElement>` |
| **HashSet** | Hash set (HAMT-backed) | Unordered unique values, O(1) avg membership. `mutate()` for batch ops. | O(1) avg | **BFTA identifiedDepths**, **stream dedup sets** |
| **RedBlackTree** | Self-balancing BST | Ordered K→V, O(log n) insert/lookup/remove. Range queries via `forEachBetween`, `greaterThanEqual`, `lessThan`. Immutable. | O(log n) | **TreeCache eviction** — ordered by access timestamp |
| **SortedMap** | Ordered map (RBTree-backed) | Like HashMap but sorted by key order. `headOption`/`lastOption` for min/max. | O(log n) | **Version-ordered element snapshots** |
| **SortedSet** | Ordered set (RBTree-backed) | Sorted unique values. | O(log n) | **Layer z-index ordering** (already have this) |
| **List** | Immutable linked list | O(1) prepend, O(n) append. LIFO stack pattern. Structural sharing on tail. | O(1) prepend | **Thread message history** — prepend-heavy |
| **Chunk** | Immutable array-like | Optimized for repeated concatenation. O(1) append via tree structure. `toReadonlyArray` for interop. | O(1) concat | **Streaming token buffers** — concat-heavy hot path |
| **Trie** | Prefix tree | String-keyed, O(k) lookup where k=key length. `keysWithPrefix`, `valuesWithPrefix`, `longestPrefixOf`. | O(k) | **Component type registry** — prefix-based catalog lookup |
| **Data** | Structural equality wrapper | `Data.struct()`, `Data.Class`, `Data.TaggedClass`. Auto-implements `Equal`+`Hash`. | N/A | **UIElement** — structural equality for memo/dedup |

### 1.2 Mutable Collections (Performance-Critical Paths)

| Module | Use Case |
|--------|----------|
| **MutableHashMap** | Hot-path tokenizer state, streaming parser internals |
| **MutableHashSet** | BFTA validator's `visitedNodes` during a single validation pass |
| **MutableList** | Double-ended queue for token processing |

### 1.3 Concurrent/Transactional Collections

| Module | Structure | Key Properties |
|--------|-----------|---------------|
| **TMap** | STM Transactional Map | Atomic multi-key updates, composable transactions. `set`, `get`, `updateWith`, `transform`. Runs inside `STM.commit`. |
| **TSet** | STM Transactional Set | Atomic set operations in STM context. |
| **TRef** | STM Transactional Ref | Single mutable cell with STM semantics. |

### 1.4 Effectful Caching

| Module | Key Properties |
|--------|---------------|
| **Cache** | Effect-native LRU with TTL. Concurrent-safe: duplicate lookups coalesce (fiber-based dedup). Auto-eviction by capacity + age. Built-in metrics (hits/misses). Lookup function is `(key: K) => Effect<V, E, R>`. |

---

## 2. Where Each Structure Fits in Genifer

### 2.1 UITree — HashMap + Data

**Current**: `elements: Record<string, UIElement>` (plain JS object)

**Problem**: 
- `Record` is a plain object — no structural equality, no O(1) immutable update
- Every `setElement()` spreads the entire record: `{ ...this.elements, [key]: element }` — O(n)
- No change detection without deep comparison

**Proposed**: `HashMap<string, UIElement>` where UIElement implements `Equal`+`Hash` via `Data.Class`

```typescript
import { HashMap, Data, Equal, Hash } from 'effect'

// UIElement with structural equality
class UIElement extends Data.Class<{
  key: string
  type: string
  props: HashMap<string, unknown>
  children: ReadonlyArray<string>
  parentKey: string | null
  // ... ARIA fields etc
}> {}

// UITree with HashMap
class UITree extends Data.Class<{
  root: string
  elements: HashMap.HashMap<string, UIElement>
}> {
  getElement(key: string) {
    return HashMap.get(this.elements, key)  // O(1) avg, returns Option
  }
  setElement(key: string, el: UIElement) {
    return new UITree({
      root: this.root,
      elements: HashMap.set(this.elements, key, el)  // O(1) avg, structural sharing
    })
  }
  removeElement(key: string) {
    return new UITree({
      root: this.root,
      elements: HashMap.remove(this.elements, key)
    })
  }
}
```

**Benefit**: O(1) immutable updates with structural sharing. `Equal.equals(tree1, tree2)` gives deep equality for free — perfect for React memo boundaries.

### 2.2 TreeCache — Cache (Effect-native)

**Current**: Our `TreeCache` uses plain `Map` with manual TTL and LRU.

**Proposed**: `Cache.make` — Effect-native, concurrent-safe, fiber-coalescing.

```typescript
import { Cache, Duration, Effect } from 'effect'

// Lookup: if cache miss, generate the UITree
const treeCache = Cache.make({
  capacity: 50,
  timeToLive: Duration.minutes(5),
  lookup: (promptHash: string) => 
    Effect.gen(function* () {
      // This would be the actual generation — but for cache-only usage,
      // we'd use a different pattern. Cache.make requires a lookup.
      // For pure cache (no auto-compute), we need a different approach.
    })
})
```

**Caveat**: Effect's `Cache` is designed for **compute-on-miss** patterns (memoization). For a pure "store and retrieve" cache where the value is computed externally, we'd need to either:
1. Use `Cache` with a lookup that reads from a `Ref<HashMap>` (indirect)
2. Keep our manual `TreeCache` but build it on `HashMap` + `SortedMap` for eviction ordering

**Recommendation**: Keep the manual `TreeCache` for #1756 (already done and tested) but rebuild internals with Effect structures:

```typescript
// Internal: SortedMap<timestamp, key> for LRU ordering
// Internal: HashMap<key, CacheEntry> for O(1) lookup
// Eviction: SortedMap.headOption gives oldest entry
```

### 2.3 CatalogService — Trie

**Current**: `Map<string, ComponentDef>` with COW snapshots

**Proposed**: `Trie<ComponentDef>` — prefix-based lookup enables:
- `keysWithPrefix("layout")` → all layout components
- `valuesWithPrefix("chart")` → all chart components
- `longestPrefixOf(type)` → best-match component lookup

```typescript
import { Trie } from 'effect'

const catalog = Trie.empty<ComponentDef>().pipe(
  Trie.insert('layout/Grid', gridDef),
  Trie.insert('layout/VStack', vstackDef),
  Trie.insert('chart/LineChart', lineChartDef),
)

// Get all layout components
const layoutComponents = Trie.valuesWithPrefix(catalog, 'layout/')
```

**Benefit**: Domain-scoped queries without filtering. Already immutable (COW for free). O(k) where k = key length.

**Trade-off**: Current keys are flat (`"Grid"`, `"VStack"`). Would require namespacing (`"layout/Grid"`). This is a larger refactor — defer to a future feature.

### 2.4 Streaming Token Buffer — Chunk

**Current**: `Array<JSONToken>` built via `push()` in tokenizer

**Proposed**: `Chunk<JSONToken>` — optimized for repeated concatenation

```typescript
import { Chunk } from 'effect'

let tokens = Chunk.empty<JSONToken>()
// In hot loop:
tokens = Chunk.append(tokens, newToken)  // O(1) amortized
// At end:
const arr = Chunk.toReadonlyArray(tokens)  // O(n) materialization
```

**Benefit**: The tokenizer currently creates a new array per `feed()` call. Chunk's tree structure avoids the O(n) copy on each append.

**Caveat**: Chunk overhead matters on small inputs. Only use for streaming scenarios where tokens accumulate across many chunks.

### 2.5 Stream Isolation (#1751) — No special structure needed

The race condition in `useUIStream` is about **atom singletons**, not data structure choice. The fix is `Atom.family` keyed by stream ID — same pattern as `GenerativeContainer`. No new Effect data structure required here.

### 2.6 BFTA Validator — HashSet for Grammar, MutableHashSet for Hot Path

**Already done**: Grammar layer uses `HashMap`/`HashSet` (Effect immutable). Validator uses `Map`/`Set` (JS mutable for hot path). This is the correct split per our constraint.

---

## 3. Prioritized Implementation Plan

### Phase 1: Structural Equality (Low Risk, High Value)
1. **UIElement as Data.Class** — enables `Equal.equals` for memo boundaries
2. **UITree.elements as HashMap** — O(1) immutable updates

### Phase 2: Cache Internals (Medium Risk)  
3. **TreeCache internal: HashMap + SortedMap** — ordered eviction, O(1) lookup
4. **Effect Cache consideration** — for future compute-on-miss patterns (AI generation caching)

### Phase 3: Collection Upgrades (Future)
5. **Trie for CatalogService** — requires namespaced keys, larger refactor
6. **Chunk for tokenizer** — benchmark before committing (overhead on small inputs)
7. **List for Thread history** — prepend-heavy access pattern fits perfectly

---

## 4. Key Decisions

### D1: UIElement Equality Strategy
**Options**:
- (a) `Schema.Data(Schema.Struct(...))` — auto-implements Equal+Hash but loses Schema.Class methods
- (b) Manual `Equal.symbol` + `Hash.symbol` on existing Schema.Class 
- (c) `Data.Class` parallel to Schema.Class — separate data layer

**Recommendation**: (b) — add Equal+Hash to existing Schema.Class. Least disruption. Schema.Class already gives us `_tag`, methods stay intact.

### D2: HashMap vs Record for UITree.elements
**Options**:
- (a) Full migration to `HashMap<string, UIElement>` — breaks all existing code that does `tree.elements[key]`
- (b) Keep `Record` but add HashMap-backed operations alongside — gradual migration
- (c) Wrap Record in a newtype with HashMap semantics — proxy pattern

**Recommendation**: (a) with a migration adapter. The 354 tests give us confidence. The streaming pipeline already uses callbacks (`getElement(key)`), not direct property access.

### D3: Effect Cache vs Manual TreeCache
**Options**:
- (a) Replace TreeCache with Effect.Cache — native concurrent safety
- (b) Keep TreeCache, rebuild internals with Effect collections
- (c) Keep TreeCache as-is (already working, tested)

**Recommendation**: (c) for now, (a) for future when we add compute-on-miss (AI generation memoization). The current TreeCache is pure store-and-retrieve.

---

## 5. References

- [Effect HashMap docs](https://effect.website/docs/data-types/hash-map)
- [Effect HashSet docs](https://effect.website/docs/data-types/hash-set)
- [Effect RedBlackTree API](https://effect-ts.github.io/effect/effect/RedBlackTree.ts.html)
- [Effect SortedMap API](https://effect-ts.github.io/effect/effect/SortedMap.ts.html)
- [Effect Cache docs](https://effect.website/docs/caching/cache)
- [Effect Chunk docs](https://effect.website/docs/data-types/chunk)
- [Effect Trie API](https://effect-ts.github.io/effect/effect/Trie.ts.html)
- [Effect Data docs](https://effect.website/docs/data-types/data)
- [Effect TMap API](https://effect-ts.github.io/effect/effect/TMap.ts.html) (STM transactional map)
