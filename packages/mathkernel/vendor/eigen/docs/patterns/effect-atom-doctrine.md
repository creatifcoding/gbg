# Effect-Atom Pattern Registry

> **Canonical Source**: `.edin/EFFECT_PATTERNS.md`
> **Consolidated**: 2026-02-09

This registry documents the established patterns for integrating Effect-TS with React via `effect-atom` in the TMNL project.

---

## CRITICAL DOCTRINE: Atom-as-State

**NO EFFECT.REF. EVER.**

When React is the consumer via effect-atom, `Atom.make()` is the primary state mechanism -- not `Effect.Ref` inside services.

- Service methods mutate Atoms directly (`Atom.set`, `ctx.set`)
- React subscribes directly to atoms
- This eliminates the Ref-to-Atom bridge: no polling, no SubscriptionRef, no streams-to-consume-streams

**The Pattern:**
```typescript
// State lives in Atoms at module level
const resultsAtom = Atom.make<SearchResult[]>([])
const statusAtom = Atom.make<'idle' | 'loading' | 'complete'>('idle')

// Service methods update Atoms directly
const searchOp = runtimeAtom.fn<string>()((query, ctx) =>
  Effect.gen(function* () {
    ctx.set(statusAtom, 'loading')
    const results = yield* performSearch(query)
    ctx.set(resultsAtom, results)
    ctx.set(statusAtom, 'complete')
  })
)

// React subscribes directly
function Results() {
  const results = useAtomValue(resultsAtom)
  return <List items={results} />
}
```

---

## Core State Primitives

| Need               | Pattern                     | Example                                 |
| ------------------ | --------------------------- | --------------------------------------- |
| Simple UI state    | `Atom.make(value)`          | `Atom.make(false)`                      |
| Derived value      | `Atom.make((get) => ...)`   | `Atom.make((get) => get(a) + get(b))`   |
| Async data         | `Atom.make(Effect)`         | `Atom.make(Effect.promise(fetch))`      |
| Service access     | `Atom.runtime(Layer)`       | `Atom.runtime(MyService.Default)`       |
| Mutation/action    | `runtime.fn<Arg>()`         | `runtime.fn<string>()((q, ctx) => ...)` |
| Progressive stream | `runtime.pull(Stream)`      | `runtime.pull(largeStream)`             |
| Keyed atoms        | `Atom.family((key) => ...)` | `Atom.family((id) => Atom.make(...))`   |
| Long-lived         | `Atom.keepAlive(atom)`      | `Atom.keepAlive(runtimeAtom)`           |

---

## Anti-Patterns (BANNED)

| Tag | Description | Fix |
|-----|-------------|-----|
| `ANTIPATTERN:EFFECT_REF` | Using Effect.Ref for React-facing state | Use Atom.make() at module level |
| `ANTIPATTERN:USESTATE_CROSSBOUND` | useState for cross-component state | Use effect-atom primitives |
| `ANTIPATTERN:ATOMS_IN_COMPONENT` | Creating atoms inside render | Define atoms at module level |
| `ANTIPATTERN:SYNC_ATOM_OPS` | Calling Atom.get/set synchronously | yield* Atom.get/set inside Effect.gen |
| `ANTIPATTERN:RAW_PROMISE` | Passing raw Promise to Atom.make | Wrap in Effect.promise() |
| `ANTIPATTERN:STREAM_BRIDGE` | SubscriptionRef-to-Stream-to-Atom pipeline | ctx.set(atom, value) directly |

See the full original at `.edin/EFFECT_PATTERNS.md` for complete code examples and file location matrix.
