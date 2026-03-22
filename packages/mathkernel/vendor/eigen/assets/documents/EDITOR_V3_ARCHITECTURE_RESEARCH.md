# Editor v3 Architecture Research

> **Status**: Research Complete | **Date**: 2025-12-25
> **Context**: Pivoting from BlockSuite to Tiptap for TMNL editor

---

## Executive Summary

This document synthesizes research across four domains to establish the architectural foundation for Editor v3:

1. **Effect Core** — Service patterns, state management, streams, fibers
2. **effect-atom** — React state bridge, operation atoms, derived state
3. **Effect Platform/SQL** — Persistence, workers, background sync
4. **Effect AI** — Provider abstraction, streaming, tool calling
5. **Tiptap** — Extension points, lifecycle hooks, transaction wrapping

---

## Part I: Effect Core Patterns for Editor Services

### 1.1 Service Pattern (`Effect.Service<>()`)

**When to use**: Define editor services with dependencies, state, and operations.

```typescript
class EditorService extends Effect.Service<EditorService>()("tmnl/EditorService", {
  effect: Effect.gen(function* () {
    // Service-scoped atoms (public, for React)
    const documentAtom = Atom.make<Document | null>(null)
    const selectionAtom = Atom.make<Selection | null>(null)

    return {
      atoms: { document: documentAtom, selection: selectionAtom },
      loadDocument: (id: string) => Effect.gen(function* () { /* ... */ }),
      saveDocument: () => Effect.gen(function* () { /* ... */ }),
    }
  })
}) {}
```

**Integration Point**: Wrap Tiptap `Editor` instance inside service, expose atoms for React.

### 1.2 Effect.Ref vs Atom.make

| Use Case | Pattern | Example |
|----------|---------|---------|
| Internal service state | `Effect.Ref` | Tiptap editor instance, plugin state |
| React-consumed state | `Atom.make` | Document content, selection, isDirty |
| Private counters/caches | `Effect.Ref` | Transaction counter, undo stack pointer |

**Cardinal Rule**: Service methods mutate atoms via `Atom.set()`, React subscribes via `useAtomValue()`.

### 1.3 Effect.Stream for Editor Events

```typescript
// Wrap Tiptap transaction events as Effect.Stream
const transactionStream = Stream.async<Transaction, never>((emit) => {
  editor.on('transaction', ({ transaction }) => {
    emit(Effect.succeed(Chunk.of(transaction)))
  })
  return Effect.sync(() => editor.off('transaction'))
})
```

**Use Cases**:
- Document change tracking
- Collaboration events (Yjs updates)
- Auto-save triggers

### 1.4 Effect.Fiber for Background Operations

```typescript
// Fork auto-save fiber
const autoSaveFiber = yield* Effect.fork(
  Stream.fromSchedule(Schedule.spaced('30 seconds')).pipe(
    Stream.mapEffect(() => saveDocument()),
    Stream.runDrain
  )
)

// Interrupt on cleanup
yield* Effect.addFinalizer(() => Fiber.interrupt(autoSaveFiber))
```

**Use Cases**:
- Auto-save (periodic)
- Spell-check (background worker)
- Collaboration sync (event-driven)

### 1.5 Layer Composition

```typescript
// Compose editor layers
export const editorRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    EditorService.Default,           // Core editor
    PersistenceService.Default,      // SQLite storage
    CollaborationService.Default,    // Optional: Yjs
    AIAssistService.Default,         // Optional: AI features
  )
)
```

---

## Part II: effect-atom Patterns

### 2.1 Atom.runtime(Layer) — Runtime Atoms

Creates an `AtomRuntime` providing Effect services to atoms.

```typescript
export const editorRuntimeAtom = Atom.runtime(EditorServiceLive)
```

### 2.2 runtimeAtom.fn<T>()() — Operation Atoms

Operations that accept args, execute Effects, mutate state via `ctx.set()`.

```typescript
export const editorOps = {
  toggleBold: editorRuntimeAtom.fn<void>()((_, ctx) =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      yield* editor.chain().focus().toggleBold().run()
      ctx.set(isBoldActiveAtom, !Atom.get(isBoldActiveAtom))
    })
  ),

  insertBlock: editorRuntimeAtom.fn<{ type: string }>()((args, ctx) =>
    Effect.gen(function* () {
      const editor = yield* EditorService
      yield* editor.commands.insertContent({ type: args.type })
      ctx.set(blockCountAtom, (prev) => prev + 1)
    })
  ),
}
```

### 2.3 Derived Atoms

Computed values that auto-recompute when dependencies change.

```typescript
// Selection-dependent formatting state
export const canFormatAtom = Atom.make((get) => {
  const selection = get(selectionAtom)
  return selection !== null && !selection.empty
})

// Document statistics
export const wordCountAtom = Atom.make((get) => {
  const content = get(contentAtom)
  return content.split(/\s+/).filter(Boolean).length
})
```

### 2.4 React Consumption Pattern

```tsx
function Toolbar() {
  const isBold = useAtomValue(isBoldActiveAtom)
  const canFormat = useAtomValue(canFormatAtom)

  return (
    <button
      onClick={() => editorOps.toggleBold()}
      disabled={!canFormat}
      className={isBold ? 'active' : ''}
    >
      Bold
    </button>
  )
}
```

### 2.5 Anti-Patterns (CRITICAL)

| Anti-Pattern | Correct Pattern |
|--------------|-----------------|
| `useState` for editor state | `Atom.make` at module level |
| Setter callbacks in handlers | Operation atoms with `ctx.set()` |
| Creating atoms in components | Define atoms at module level |
| Ignoring Result types | Handle `isSuccess()`, `isFailure()` |

---

## Part III: Persistence Architecture

### 3.1 Document Storage Strategy

**Recommendation**: SQLite via `@effect/sql-sqlite-bun`

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| Document content | SQLite | Structured queries, versioning, ACID |
| Version history | SQLite | Natural relational fit |
| Preferences | KeyValueStore | Simple, survives schema changes |
| Undo stack | In-memory atoms | Ephemeral, session-scoped |

### 3.2 Schema Design

```typescript
export class Document extends Schema.Class<Document>("Document")({
  id: Schema.String.pipe(Schema.brand("DocumentId")),
  title: Schema.String,
  content: Schema.String, // JSON-serialized Tiptap state
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
  tags: Schema.Array(Schema.String),
}) {}

export class DocumentVersion extends Schema.Class<DocumentVersion>("DocumentVersion")({
  id: Schema.String.pipe(Schema.brand("VersionId")),
  documentId: Schema.String.pipe(Schema.brand("DocumentId")),
  content: Schema.String,
  createdAt: Schema.DateFromSelf,
  diffSize: Schema.Number,
}) {}
```

### 3.3 Background Workers

Use `@effect/platform Worker` for expensive operations:
- Document serialization
- Compression before storage
- Search indexing
- Export (Markdown, PDF)

---

## Part IV: AI Integration

### 4.1 Provider Abstraction

```typescript
import { LanguageModel } from "@effect/ai"
import { OpenAiLanguageModel } from "@effect/ai-openai"

// Provider-agnostic usage
const response = yield* LanguageModel.generateText({
  prompt: "Continue writing..."
})

// Provider selected at runtime via Layer
const Gpt4o = OpenAiLanguageModel.model("gpt-4o")
```

### 4.2 Streaming to Atoms

```typescript
export const streamSuggestionOp = aiRuntimeAtom.fn<{ prompt: string }>()((args, ctx) =>
  Effect.gen(function* () {
    ctx.set(statusAtom, "streaming")
    ctx.set(suggestionAtom, "")

    const stream = yield* LanguageModel.streamText({ prompt: args.prompt })

    yield* Stream.runForEach(stream, (part) =>
      Effect.gen(function* () {
        if (part.type === "text-delta") {
          ctx.set(suggestionAtom, (prev) => prev + part.delta)
        }
      })
    )

    ctx.set(statusAtom, "complete")
  })
)
```

### 4.3 AI Commands via Toolkit

```typescript
const RephraseSelection = Tool.make("RephraseSelection", {
  description: "Rephrase selected text with a specific tone",
  parameters: {
    tone: Schema.Literal("formal", "casual", "concise")
  },
  success: Schema.String
})

const EditorToolkit = Toolkit.make(RephraseSelection, SummarizeDocument, ExplainCode)
```

---

## Part V: Tiptap Extension Points

### 5.1 Extension Storage → Atoms Bridge

Tiptap's `extension.storage` can be bridged to effect-atom:

```typescript
const MyExtension = Extension.create({
  name: 'effectBridge',

  addStorage() {
    return {
      // Storage is per-editor instance
      atomBridge: null as AtomBridge | null
    }
  },

  onCreate() {
    // Bridge Tiptap storage to effect-atom
    this.storage.atomBridge = createAtomBridge(this.editor)
  },

  onDestroy() {
    this.storage.atomBridge?.cleanup()
  }
})
```

### 5.2 ProseMirror Plugin Integration

```typescript
addProseMirrorPlugins() {
  return [
    new Plugin({
      key: new PluginKey('effectSync'),

      view: () => ({
        update: (view, prevState) => {
          // Sync ProseMirror state → Atoms
          if (!view.state.doc.eq(prevState.doc)) {
            Atom.set(contentAtom, view.state.doc.toJSON())
          }
          if (!view.state.selection.eq(prevState.selection)) {
            Atom.set(selectionAtom, view.state.selection.toJSON())
          }
        }
      }),

      appendTransaction: (transactions, oldState, newState) => {
        // Effect-driven transaction modification
        return runEffectSync(modifyTransaction(transactions))
      }
    })
  ]
}
```

### 5.3 Lifecycle Hooks

| Hook | Effect Integration |
|------|-------------------|
| `onBeforeCreate` | Initialize service atoms |
| `onCreate` | Start background fibers (auto-save) |
| `onTransaction` | Sync state to atoms |
| `onDestroy` | Interrupt fibers, cleanup |

### 5.4 Transaction Wrapping

```typescript
// Wrap dispatchTransaction with Effect tracing
const editor = new Editor({
  // ...
  onTransaction: ({ transaction }) => {
    Effect.runSync(
      Effect.withSpan("editor.transaction", {
        attributes: {
          "transaction.steps": transaction.steps.length,
          "transaction.selectionChanged": !transaction.selection.eq(transaction.before.selection)
        }
      })(Effect.sync(() => {
        // Sync to atoms
        Atom.set(transactionCountAtom, (prev) => prev + 1)
      }))
    )
  }
})
```

---

## Part VI: Proposed File Structure

```
src/lib/editor/v3/
├── index.ts                      # Public exports
├── types.ts                      # Schema definitions
│
├── services/
│   ├── EditorService.ts          # Core Tiptap wrapper
│   ├── SelectionService.ts       # Selection tracking
│   ├── HistoryService.ts         # Undo/redo management
│   └── CollaborationService.ts   # Optional: Yjs integration
│
├── extensions/
│   ├── EffectBridge.ts           # ProseMirror → Atoms sync
│   ├── AutoSave.ts               # Periodic save fiber
│   └── AIAssist.ts               # AI writing assistant
│
├── atoms/
│   ├── index.ts                  # State atoms
│   ├── derived.ts                # Computed atoms
│   └── operations.ts             # Operation atoms
│
├── persistence/
│   ├── schemas.ts                # Document, Version schemas
│   ├── service.ts                # EditorPersistence service
│   └── migrations/               # SQLite migrations
│
├── ai/
│   ├── toolkit.ts                # AI command definitions
│   ├── handlers.ts               # Toolkit implementations
│   └── service.ts                # AIAssistant service
│
├── hooks/
│   └── useTiptapEditor.ts        # React hook
│
└── components/
    ├── TiptapEditor.tsx          # Main editor component
    ├── Toolbar.tsx               # Formatting toolbar
    └── StatusBar.tsx             # Word count, status
```

---

## Part VII: Decision Points (Questionnaire Required)

The following architectural decisions require input:

1. **State Granularity**: How fine-grained should atoms be?
2. **Persistence Strategy**: SQLite vs IndexedDB vs hybrid?
3. **Collaboration**: Yjs integration now or later?
4. **AI Features**: Essential for v3 or phased?
5. **Extension Architecture**: Monolithic vs plugin-per-feature?

See questionnaire for detailed options.

---

## References

- Effect Docs: [effect.website](https://effect.website)
- effect-atom: [github.com/tim-smart/effect-atom](https://github.com/tim-smart/effect-atom)
- Tiptap: [tiptap.dev](https://tiptap.dev)
- @effect/ai: [github.com/Effect-TS/effect](https://github.com/Effect-TS/effect/tree/main/packages/ai)
