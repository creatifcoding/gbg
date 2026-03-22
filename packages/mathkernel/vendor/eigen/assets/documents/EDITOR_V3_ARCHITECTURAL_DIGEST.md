# Editor v3 Architectural Digest

> **Status**: Decision Record | **Date**: 2025-12-25
> **Author**: Val (Architectural Conscience) | **Approver**: Prime

---

## Decisions Summary

| Domain | Decision | Rationale |
|--------|----------|-----------|
| **State Model** | Hybrid (coarse core, fine derived) | Balance simplicity with surgical re-renders |
| **Storage** | SQLite + y-Sweet + File Export | Collaboration-first, with offline capability |
| **Collaboration** | y-Sweet (self-hosted Docker) | Full Yjs CRDT, control plane/data plane separation |
| **AI** | Full suite, multi-provider | OpenAI + Anthropic switchable, Gemini when available |
| **Export** | Markdown, JSON, PDF | Portable, lossless, print-ready |

---

## Part I: State Architecture

### Hybrid Atom Model

```
editorRuntimeAtom (Runtime from service layers)
│
├── Coarse State Atoms (service-owned)
│   ├── documentAtom: Y.Doc              # Yjs document (single source of truth)
│   ├── editorAtom: Editor               # Tiptap instance reference
│   └── connectionAtom: ConnectionState  # y-Sweet connection status
│
├── Fine-Grained Derived Atoms (computed)
│   ├── selectionAtom: Selection | null  # Derived from editor state
│   ├── cursorPositionAtom: { from, to } # Derived from selection
│   ├── activeMarksAtom: Set<string>     # Bold, italic, etc.
│   ├── canUndoAtom: boolean             # Derived from history
│   ├── canRedoAtom: boolean             # Derived from history
│   ├── wordCountAtom: number            # Derived from document
│   └── isDirtyAtom: boolean             # Derived from sync state
│
└── Operation Atoms (mutations)
    ├── formatOps: toggleBold, toggleItalic, ...
    ├── blockOps: insertParagraph, insertHeading, ...
    ├── historyOps: undo, redo
    ├── documentOps: save, load, export
    └── aiOps: suggest, rephrase, summarize
```

### Data Flow

```
User Interaction
    ↓
Operation Atom (runtimeAtom.fn)
    ↓
Effect.gen (with EditorService)
    ├── Tiptap command execution
    ├── Y.Doc mutation (CRDT)
    └── ctx.set(atom, value) for UI state
    ↓
y-Sweet sync (automatic via Yjs provider)
    ↓
Derived Atoms recompute
    ↓
React re-renders (surgical, via useAtomValue)
```

---

## Part II: Collaboration Architecture (y-Sweet)

### Deployment Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Host (Local Server)                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  y-sweet Container                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │ │
│  │  │ Control     │  │ Data Plane  │  │ Storage         │  │ │
│  │  │ Plane       │  │ (WebSocket) │  │ (FileSystem/S3) │  │ │
│  │  │ :8080       │  │ :8080/ws    │  │ /data           │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
              │                    │
              ▼                    ▼
    ┌─────────────────┐   ┌─────────────────┐
    │ TMNL Client 1   │   │ TMNL Client 2   │
    │ (Tauri/Browser) │   │ (Browser)       │
    └─────────────────┘   └─────────────────┘
```

### Integration Pattern

```typescript
// services/CollaborationService.ts
import { createYjsProvider } from '@y-sweet/client'
import * as Y from 'yjs'

class CollaborationService extends Effect.Service<CollaborationService>()(
  "tmnl/CollaborationService",
  {
    effect: Effect.gen(function* () {
      const doc = new Y.Doc()
      const connectionAtom = Atom.make<'disconnected' | 'connecting' | 'connected'>('disconnected')
      const awarenessAtom = Atom.make<Map<number, AwarenessState>>(new Map())

      return {
        atoms: { connection: connectionAtom, awareness: awarenessAtom },
        doc,

        connect: (docId: string) => Effect.gen(function* () {
          Atom.set(connectionAtom, 'connecting')

          const provider = yield* Effect.tryPromise(() =>
            createYjsProvider(doc, docId, '/api/y-sweet/auth')
          )

          provider.on('status', (status) => {
            Atom.set(connectionAtom, status.connected ? 'connected' : 'disconnected')
          })

          provider.awareness.on('change', () => {
            Atom.set(awarenessAtom, new Map(provider.awareness.getStates()))
          })

          return provider
        }),

        disconnect: () => Effect.sync(() => { /* cleanup */ })
      }
    })
  }
) {}
```

### Tiptap + Yjs Binding

```typescript
// extensions/Collaboration.ts
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor'

export const createCollaborationExtensions = (ydoc: Y.Doc, provider: YSweetProvider) => [
  Collaboration.configure({
    document: ydoc,
  }),
  CollaborationCursor.configure({
    provider: provider,
    user: {
      name: 'Anonymous',
      color: '#f783ac',
    },
  }),
]
```

---

## Part III: Persistence Architecture

### Storage Layers

| Layer | Technology | Data |
|-------|------------|------|
| **Real-time** | y-Sweet (Yjs CRDT) | Live document state |
| **Durable** | SQLite | Document metadata, versions, search index |
| **Export** | File System | Markdown, JSON, PDF files |

### SQLite Schema

```typescript
// persistence/schemas.ts
export class DocumentMeta extends Schema.Class<DocumentMeta>("DocumentMeta")({
  id: Schema.String.pipe(Schema.brand("DocumentId")),
  title: Schema.String,
  ySweetDocId: Schema.String,  // y-Sweet document reference
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
  tags: Schema.Array(Schema.String),
  wordCount: Schema.Number,
  lastExportedAt: Schema.NullOr(Schema.DateFromSelf),
}) {}

export class DocumentSnapshot extends Schema.Class<DocumentSnapshot>("DocumentSnapshot")({
  id: Schema.String.pipe(Schema.brand("SnapshotId")),
  documentId: Schema.String.pipe(Schema.brand("DocumentId")),
  yjsState: Schema.Uint8Array,  // Y.encodeStateAsUpdate(doc)
  createdAt: Schema.DateFromSelf,
  reason: Schema.Literal("manual", "auto", "export"),
}) {}
```

### Export Pipeline

```typescript
// persistence/ExportService.ts
class ExportService extends Effect.Service<ExportService>()("tmnl/ExportService", {
  effect: Effect.gen(function* () {
    return {
      toMarkdown: (doc: Y.Doc) => Effect.gen(function* () {
        const editor = yield* EditorService
        const html = editor.getHTML()
        const markdown = yield* htmlToMarkdown(html)
        return markdown
      }),

      toJSON: (doc: Y.Doc) => Effect.sync(() => {
        const editor = yield* EditorService
        return JSON.stringify(editor.getJSON(), null, 2)
      }),

      toPDF: (doc: Y.Doc) => Effect.gen(function* () {
        // Worker-based PDF generation
        const worker = yield* Worker.Worker
        const html = editor.getHTML()
        const pdf = yield* worker.executeEffect(
          new GeneratePDF({ html, options: { format: 'A4' } })
        )
        return pdf
      }),

      saveToFile: (content: string | Uint8Array, path: string) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem
          yield* fs.writeFile(path, content)
        })
    }
  })
}) {}
```

---

## Part IV: AI Architecture

### Provider Abstraction Strategy

Given @effect/ai's current provider support limitations, we'll implement a **hybrid approach**:

1. **Use @effect/ai** for OpenAI and Anthropic (native support)
2. **Custom Effect wrapper** for Gemini and other providers
3. **Layer-based switching** for runtime provider selection

```typescript
// ai/providers/index.ts
import { LanguageModel } from "@effect/ai"
import { OpenAiLanguageModel } from "@effect/ai-openai"
import { AnthropicLanguageModel } from "@effect/ai-anthropic"

// Native @effect/ai providers
export const OpenAI = OpenAiLanguageModel.model("gpt-4o")
export const Claude = AnthropicLanguageModel.model("claude-3-5-sonnet-latest")

// Custom Gemini wrapper (until @effect/ai supports it)
export const Gemini = GeminiLanguageModel.model("gemini-2.0-flash-exp")

// Provider registry atom
export const aiProviderAtom = Atom.make<'openai' | 'anthropic' | 'gemini'>('openai')

// Dynamic provider layer
export const AIProviderLive = Layer.effect(
  LanguageModel.LanguageModel,
  Effect.gen(function* () {
    const provider = Atom.get(aiProviderAtom)
    switch (provider) {
      case 'openai': return yield* OpenAI
      case 'anthropic': return yield* Claude
      case 'gemini': return yield* Gemini
    }
  })
)
```

### Custom Gemini Provider

```typescript
// ai/providers/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai"

class GeminiLanguageModel {
  static model(modelId: string) {
    return Layer.effect(
      LanguageModel.LanguageModel,
      Effect.gen(function* () {
        const apiKey = yield* Config.string("GEMINI_API_KEY")
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: modelId })

        return {
          generateText: (request) => Effect.tryPromise(async () => {
            const result = await model.generateContent(request.prompt)
            return { text: result.response.text() }
          }),

          streamText: (request) => Stream.async((emit) => {
            const stream = model.generateContentStream(request.prompt)
            // ... emit text deltas
          })
        }
      })
    )
  }
}
```

### AI Feature Set

| Feature | Trigger | Implementation |
|---------|---------|----------------|
| **Continue Writing** | Tab at cursor | `streamText` with document context |
| **Rephrase Selection** | Command palette | `generateText` with tone parameter |
| **Summarize Document** | Command palette | `generateText` with full document |
| **Explain Code Block** | Right-click | `generateText` with code + language |
| **Grammar Check** | Background | `generateText` + diff application |
| **Translate Selection** | Command palette | `generateText` with target language |

### Streaming to Editor

```typescript
// ai/operations.ts
export const continueWritingOp = aiRuntimeAtom.fn<void>()((_, ctx) =>
  Effect.gen(function* () {
    const editor = yield* EditorService
    const context = editor.getTextBeforeCursor(2000) // tokens

    ctx.set(aiStatusAtom, 'streaming')

    const stream = yield* LanguageModel.streamText({
      prompt: `Continue writing naturally:\n\n${context}`
    })

    let insertedText = ''
    yield* Stream.runForEach(stream, (part) =>
      Effect.gen(function* () {
        if (part.type === 'text-delta') {
          insertedText += part.delta
          editor.commands.insertContent(part.delta)
          ctx.set(aiSuggestionAtom, insertedText)
        }
      })
    )

    ctx.set(aiStatusAtom, 'complete')
  })
)
```

---

## Part V: Service Layer Composition

### Full Layer Stack

```typescript
// layers/index.ts
import { Layer } from "effect"

// Core services
export const CoreLive = Layer.mergeAll(
  EditorService.Default,
  SelectionService.Default,
  HistoryService.Default,
)

// Collaboration
export const CollaborationLive = Layer.mergeAll(
  CollaborationService.Default,
).pipe(Layer.provide(CoreLive))

// Persistence
export const PersistenceLive = Layer.mergeAll(
  SqliteClientLive,
  DocumentPersistence.Default,
  ExportService.Default,
).pipe(Layer.provide(CoreLive))

// AI
export const AILive = Layer.mergeAll(
  AIProviderLive,
  AIAssistant.Default,
).pipe(Layer.provide(CoreLive))

// Full editor runtime
export const EditorLive = Layer.mergeAll(
  CoreLive,
  CollaborationLive,
  PersistenceLive,
  AILive,
)

// Runtime atom for React
export const editorRuntimeAtom = Atom.runtime(EditorLive)
```

---

## Part VI: Implementation Phases

### Phase 1: Core Editor (Week 1)
- [ ] Install Tiptap packages
- [ ] Create EditorService with Atom-as-State
- [ ] Build TiptapEditor React component
- [ ] Implement basic formatting operations
- [ ] Create testbed at /testbed/editor-v3

### Phase 2: Collaboration (Week 2)
- [ ] Deploy y-Sweet Docker container
- [ ] Create CollaborationService
- [ ] Integrate Tiptap collaboration extensions
- [ ] Implement cursor presence
- [ ] Test multi-client sync

### Phase 3: Persistence (Week 3)
- [ ] Set up SQLite with @effect/sql
- [ ] Create document metadata schema
- [ ] Implement snapshot/versioning
- [ ] Build export pipeline (MD, JSON, PDF)

### Phase 4: AI Features (Week 4)
- [ ] Integrate @effect/ai (OpenAI, Anthropic)
- [ ] Build custom Gemini provider
- [ ] Implement streaming suggestions
- [ ] Add command palette AI actions
- [ ] Background grammar checking

---

## Part VII: File Structure (Final)

```
src/lib/editor/v3/
├── index.ts
├── types.ts
│
├── services/
│   ├── EditorService.ts
│   ├── SelectionService.ts
│   ├── HistoryService.ts
│   └── CollaborationService.ts
│
├── extensions/
│   ├── EffectBridge.ts
│   ├── Collaboration.ts
│   ├── AutoSave.ts
│   └── AIAssist.ts
│
├── atoms/
│   ├── index.ts
│   ├── derived.ts
│   └── operations.ts
│
├── persistence/
│   ├── schemas.ts
│   ├── DocumentPersistence.ts
│   ├── ExportService.ts
│   └── migrations/
│
├── ai/
│   ├── providers/
│   │   ├── index.ts
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── gemini.ts
│   ├── toolkit.ts
│   ├── handlers.ts
│   └── AIAssistant.ts
│
├── layers/
│   └── index.ts
│
├── hooks/
│   └── useTiptapEditor.ts
│
└── components/
    ├── TiptapEditor.tsx
    ├── Toolbar.tsx
    ├── CursorPresence.tsx
    └── AIPanel.tsx
```

---

## Appendix: Package Dependencies

```json
{
  "dependencies": {
    "@tiptap/react": "^2.x",
    "@tiptap/starter-kit": "^2.x",
    "@tiptap/extension-collaboration": "^2.x",
    "@tiptap/extension-collaboration-cursor": "^2.x",
    "@y-sweet/client": "^0.x",
    "@y-sweet/react": "^0.x",
    "yjs": "^13.x",
    "@effect/ai": "^0.x",
    "@effect/ai-openai": "^0.x",
    "@effect/ai-anthropic": "^0.x",
    "@google/generative-ai": "^0.x",
    "@effect/sql-sqlite-bun": "^0.x"
  }
}
```

---

## Sign-Off

**Architectural decisions are final pending implementation feedback.**

Next action: Create beads for Phase 1 implementation.
