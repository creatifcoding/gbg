/**
 * TMNL Overhaul Documentation Registry
 *
 * Comprehensive documentation for TMNL subsystems inspired by AFFiNE patterns.
 * NOT an integration — these are TMNL-native implementations informed by research.
 *
 * @module docs/overhaul
 */

import { Schema } from "effect"

// =============================================================================
// Schema
// =============================================================================

export const DocId = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9-]{0,63}$/),
  Schema.brand("DocId")
)
export type DocId = typeof DocId.Type

export const DocCategory = Schema.Literal(
  "overview",
  "architecture",
  "patterns",
  "guide",
  "reference"
)
export type DocCategory = typeof DocCategory.Type

export const CodeExample = Schema.Struct({
  language: Schema.String,
  filename: Schema.optional(Schema.String),
  code: Schema.String,
  caption: Schema.optional(Schema.String),
})
export type CodeExample = typeof CodeExample.Type

export const PatternMapping = Schema.Struct({
  affinePattern: Schema.String,
  tmnlImplementation: Schema.String,
  notes: Schema.optional(Schema.String),
})
export type PatternMapping = typeof PatternMapping.Type

export const DocSection = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  content: Schema.String,
  codeExamples: Schema.optional(Schema.Array(CodeExample)),
  diagramId: Schema.optional(Schema.String),
  patternMappings: Schema.optional(Schema.Array(PatternMapping)),
})
export type DocSection = typeof DocSection.Type

export const DocEntry = Schema.Struct({
  id: DocId,
  title: Schema.NonEmptyString,
  description: Schema.String,
  category: DocCategory,
  sections: Schema.Array(DocSection),
  relatedDocs: Schema.optional(Schema.Array(Schema.String)),
  updatedAt: Schema.optional(Schema.String),
})
export type DocEntry = typeof DocEntry.Type

// =============================================================================
// Documentation Content
// =============================================================================

/**
 * TMNL Overhaul Overview
 */
const OVERHAUL_OVERVIEW: DocEntry = {
  id: "overhaul-overview" as DocId,
  title: "TMNL Overhaul Overview",
  description: "Strategic vision for TMNL subsystems inspired by AFFiNE's architecture.",
  category: "overview",
  updatedAt: "2025-12-22",
  relatedDocs: ["block-editor-architecture", "implementation-roadmap"],
  sections: [
    {
      id: "what-we-learned",
      title: "What We Learned from AFFiNE",
      content: `**AFFiNE** is a local-first, open-source workspace that demonstrates several patterns worth adopting in TMNL:

### Key Insights

1. **Block-Based Editing** — Documents as trees of typed blocks with schema validation
2. **Local-First Storage** — IndexedDB/SQLite with optional cloud sync
3. **CRDT Collaboration** — Conflict-free editing via Yjs
4. **Mode Duality** — Same data, different views (Page mode vs Canvas mode)
5. **Service Architecture** — DI-based services with reactive state

### What We're Building

TMNL will implement **native subsystems** inspired by these patterns:

| AFFiNE Concept | TMNL Native Implementation |
|----------------|---------------------------|
| BlockSuite (Lit) | TMNL Block Editor (React + Effect) |
| Jotai + LiveData | effect-atom (already in use) |
| @toeverything/infra DI | Effect.Service (already in use) |
| nbstore | TMNL Storage Service (Effect-native) |
| Y.js CRDT | Effect-native CRDT (future) |

**This is not an integration.** We're not importing AFFiNE code. We're using their architecture as a reference to build TMNL-native equivalents.`,
    },
    {
      id: "strategic-objectives",
      title: "Strategic Objectives",
      content: `### What We're Building

1. **TMNL Block Editor** — React-based block editor with Effect.Service architecture
2. **Document Schema System** — Effect Schema for block types and validation
3. **Storage Service** — Effect-native persistence (IndexedDB + Tauri SQLite)
4. **Canvas Mode** — tldraw-style infinite canvas alongside document mode
5. **Real-time Collaboration** — Effect-native CRDT patterns (future phase)

### Design Principles

- **Effect-First** — All services as Effect.Service, all state as effect-atom
- **Schema-Backed** — Block types defined with Effect Schema
- **Platform-Agnostic** — Same code for web and Tauri desktop
- **Incrementally Adoptable** — Each subsystem works standalone`,
    },
    {
      id: "architecture-comparison",
      title: "Architecture Comparison",
      content: `### AFFiNE Stack (Reference)

\`\`\`
React Application (Jotai atoms)
    ↓
BlockSuite Editor (Lit Components)
    ↓
CRDT Data Layer (Yjs / Y-OCTO)
    ↓
Storage (nbstore: IndexedDB / SQLite)
\`\`\`

### TMNL Stack (Native Implementation)

\`\`\`
React Application (effect-atom)
    ↓
TMNL Block Editor (React + Effect.Service)
    ↓
Effect-native State (Schema + Ref)
    ↓
Storage Service (Effect-native IndexedDB / Tauri SQLite)
\`\`\`

The key difference: TMNL uses **Effect throughout** — no Lit, no Jotai, no external DI framework.`,
      diagramId: "tmnl-architecture-stack"
    }
  ]
}

/**
 * Block Editor Architecture
 */
const BLOCK_EDITOR_ARCHITECTURE: DocEntry = {
  id: "block-editor-architecture" as DocId,
  title: "TMNL Block Editor Architecture",
  description: "Design for TMNL's native block-based document editor.",
  category: "architecture",
  updatedAt: "2025-12-22",
  relatedDocs: ["overhaul-overview", "block-types-reference"],
  sections: [
    {
      id: "block-model",
      title: "Block Model",
      content: `### Core Concept

Documents are trees of **blocks**. Each block has:

- **Type** (flavour) — paragraph, heading, list, code, etc.
- **Props** — Type-specific properties (text, level, language)
- **Children** — Nested blocks
- **ID** — Unique identifier

### Block Roles

| Role | Purpose | Examples |
|------|---------|----------|
| **root** | Document container | DocumentRoot |
| **container** | Groups blocks | Note, Callout, Column |
| **content** | Leaf blocks | Paragraph, Heading, Code, Image |

### TMNL Block Schema

Blocks are defined using Effect Schema:`,
      codeExamples: [
        {
          language: "typescript",
          filename: "block-schema.ts",
          code: `import { Schema } from "effect";

// Base block structure
const BlockBase = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("BlockId")),
  children: Schema.Array(Schema.suspend(() => Block)),
});

// Paragraph block
const ParagraphBlock = Schema.TaggedStruct("Paragraph", {
  ...BlockBase.fields,
  text: Schema.String,
  marks: Schema.Array(TextMark),
});

// Heading block
const HeadingBlock = Schema.TaggedStruct("Heading", {
  ...BlockBase.fields,
  text: Schema.String,
  level: Schema.Literal(1, 2, 3, 4, 5, 6),
});

// Code block
const CodeBlock = Schema.TaggedStruct("Code", {
  ...BlockBase.fields,
  code: Schema.String,
  language: Schema.String,
});

// Union of all block types
const Block = Schema.Union(
  ParagraphBlock,
  HeadingBlock,
  CodeBlock,
  // ... more block types
);
type Block = typeof Block.Type;`,
          caption: "Effect Schema for block types with discriminated unions"
        }
      ]
    },
    {
      id: "block-components",
      title: "Block Components",
      content: `### React Components for Blocks

Each block type has a corresponding React component:

\`\`\`typescript
// Block component registry
const BLOCK_COMPONENTS: Record<string, React.ComponentType<BlockProps>> = {
  Paragraph: ParagraphBlockComponent,
  Heading: HeadingBlockComponent,
  Code: CodeBlockComponent,
  // ...
};

// Render a block by type
function BlockRenderer({ block }: { block: Block }) {
  const Component = BLOCK_COMPONENTS[block._tag];
  if (!Component) return null;
  return <Component block={block} />;
}
\`\`\`

### Component Pattern

Block components follow a consistent pattern:`,
      codeExamples: [
        {
          language: "typescript",
          filename: "paragraph-block.tsx",
          code: `import { useBlockService } from "@/lib/editor/hooks";

interface ParagraphBlockProps {
  block: ParagraphBlock;
}

export function ParagraphBlockComponent({ block }: ParagraphBlockProps) {
  const { updateBlock, deleteBlock } = useBlockService();

  const handleChange = (text: string) => {
    updateBlock(block.id, { text });
  };

  return (
    <div className="tmnl-block tmnl-paragraph" data-block-id={block.id}>
      <RichTextEditor
        value={block.text}
        marks={block.marks}
        onChange={handleChange}
        placeholder="Type something..."
      />
      {block.children.map(child => (
        <BlockRenderer key={child.id} block={child} />
      ))}
    </div>
  );
}`,
          caption: "Block component with Effect service integration"
        }
      ]
    },
    {
      id: "editor-service",
      title: "Editor Service",
      content: `### Effect.Service for Editor State

The editor state is managed by an Effect service:`,
      codeExamples: [
        {
          language: "typescript",
          filename: "editor-service.ts",
          code: `import { Effect, Layer, Context } from "effect";
import { Atom } from "@effect-atom/atom-react";

// Document state
interface EditorState {
  root: Block;
  selection: Selection | null;
  history: HistoryStack;
}

// Editor service
class EditorService extends Effect.Service<EditorService>()(
  "tmnl/EditorService",
  {
    effect: Effect.gen(function* () {
      // State atom (Atom-as-State pattern)
      const stateAtom = Atom.make<EditorState>({
        root: createEmptyDocument(),
        selection: null,
        history: { past: [], future: [] },
      });

      return {
        atoms: { state: stateAtom },

        // Block operations
        addBlock: (parentId: string, block: Block, index?: number) =>
          Effect.sync(() => {
            Atom.update(stateAtom, state => ({
              ...state,
              root: insertBlock(state.root, parentId, block, index),
            }));
          }),

        updateBlock: (id: string, props: Partial<BlockProps>) =>
          Effect.sync(() => {
            Atom.update(stateAtom, state => ({
              ...state,
              root: updateBlockProps(state.root, id, props),
            }));
          }),

        deleteBlock: (id: string) =>
          Effect.sync(() => {
            Atom.update(stateAtom, state => ({
              ...state,
              root: removeBlock(state.root, id),
            }));
          }),

        // Selection
        setSelection: (selection: Selection | null) =>
          Effect.sync(() => {
            Atom.update(stateAtom, state => ({ ...state, selection }));
          }),

        // History
        undo: () => Effect.sync(() => { /* ... */ }),
        redo: () => Effect.sync(() => { /* ... */ }),
      };
    }),
  }
) {}`,
          caption: "Effect.Service with Atom-as-State for editor management"
        }
      ],
      patternMappings: [
        {
          affinePattern: "BlockSuite Store with Yjs",
          tmnlImplementation: "EditorService with effect-atom",
          notes: "No CRDT initially — simple immutable updates, CRDT added later"
        },
        {
          affinePattern: "std.command.exec()",
          tmnlImplementation: "Effect.gen() pipelines",
          notes: "Commands are Effect functions, composable via pipe()"
        }
      ]
    },
    {
      id: "selection-system",
      title: "Selection System",
      content: `### Selection Model

Selections are data-driven and serializable:

\`\`\`typescript
const TextSelection = Schema.TaggedStruct("TextSelection", {
  blockId: BlockId,
  anchor: Schema.Number,
  focus: Schema.Number,
});

const BlockSelection = Schema.TaggedStruct("BlockSelection", {
  blockIds: Schema.Array(BlockId),
});

const Selection = Schema.Union(TextSelection, BlockSelection);
\`\`\`

### Selection Service

Selection is managed separately from document state for clean separation:`,
      codeExamples: [
        {
          language: "typescript",
          filename: "selection-service.ts",
          code: `class SelectionService extends Effect.Service<SelectionService>()(
  "tmnl/SelectionService",
  {
    effect: Effect.gen(function* () {
      const selectionAtom = Atom.make<Selection | null>(null);

      return {
        atoms: { selection: selectionAtom },

        select: (selection: Selection) =>
          Effect.sync(() => Atom.set(selectionAtom, selection)),

        clear: () =>
          Effect.sync(() => Atom.set(selectionAtom, null)),

        // Expand selection to include block
        expandTo: (blockId: string) =>
          Effect.sync(() => {
            const current = Atom.get(selectionAtom);
            if (current?._tag === "BlockSelection") {
              Atom.set(selectionAtom, {
                ...current,
                blockIds: [...current.blockIds, blockId],
              });
            }
          }),
      };
    }),
  }
) {}`,
          caption: "Standalone selection service"
        }
      ]
    },
    {
      id: "editor-modes",
      title: "Editor Modes",
      content: `### Page Mode vs Canvas Mode

Like AFFiNE's Page/Edgeless duality, TMNL supports two views of the same document:

| Mode | Purpose | Rendering |
|------|---------|-----------|
| **Page** | Linear document editing | React DOM |
| **Canvas** | Freeform spatial layout | tldraw/React Flow |

### Mode Switching

The same block tree renders differently based on mode:

\`\`\`typescript
const EditorModeAtom = Atom.make<"page" | "canvas">("page");

function Editor({ document }: { document: Document }) {
  const mode = useAtomValue(EditorModeAtom);

  return mode === "page"
    ? <PageEditor document={document} />
    : <CanvasEditor document={document} />;
}
\`\`\`

Blocks can specify mode visibility:

\`\`\`typescript
const BlockMetadata = Schema.Struct({
  displayMode: Schema.Literal("both", "page", "canvas"),
});
\`\`\``,
      diagramId: "editor-modes"
    }
  ]
}

/**
 * State Management Patterns
 */
const STATE_MANAGEMENT_PATTERNS: DocEntry = {
  id: "state-management-patterns" as DocId,
  title: "State Management Patterns",
  description: "Effect-native state patterns inspired by AFFiNE's reactive architecture.",
  category: "patterns",
  updatedAt: "2025-12-22",
  relatedDocs: ["overhaul-overview", "block-editor-architecture"],
  sections: [
    {
      id: "affine-state-reference",
      title: "AFFiNE State (Reference)",
      content: `### What AFFiNE Uses

AFFiNE has a three-layer state model:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Document** | Yjs CRDT | Block content, collaboration |
| **Service** | @toeverything/infra DI | Business logic |
| **UI** | Jotai atoms | React component state |

### LiveData Pattern

AFFiNE's \`LiveData\` wraps RxJS BehaviorSubject:

\`\`\`typescript
// AFFiNE pattern (for reference, NOT to copy)
class LiveData<T> extends Observable<T> {
  get value(): T;  // Sync read
  $: Observable<T>;  // Stream
}
\`\`\`

### Why We Don't Copy This

TMNL already has **effect-atom** which provides the same reactive patterns but integrated with Effect:

- \`Atom.make()\` = LiveData creation
- \`Atom.get()\` = LiveData.value
- \`useAtomValue()\` = LiveData subscription
- \`Atom.runtime()\` = Service-scoped atoms`,
    },
    {
      id: "tmnl-atom-patterns",
      title: "TMNL Atom Patterns",
      content: `### Atom-as-State Doctrine

In TMNL, \`Atom.make()\` is the primary state container — services expose atoms, not internal Refs.

### Service + Atom Pattern`,
      codeExamples: [
        {
          language: "typescript",
          filename: "service-atom-pattern.ts",
          code: `import { Effect, Layer } from "effect";
import { Atom } from "@effect-atom/atom-react";

// 1. Define service with atom state
class MyService extends Effect.Service<MyService>()(
  "tmnl/MyService",
  {
    effect: Effect.gen(function* () {
      // State lives in atoms
      const itemsAtom = Atom.make<Item[]>([]);
      const statusAtom = Atom.make<Status>("idle");

      return {
        // Expose atoms for React subscription
        atoms: {
          items: itemsAtom,
          status: statusAtom,
        },

        // Mutations update atoms directly
        addItem: (item: Item) =>
          Effect.sync(() => {
            Atom.update(itemsAtom, items => [...items, item]);
          }),

        setStatus: (status: Status) =>
          Effect.sync(() => {
            Atom.set(statusAtom, status);
          }),
      };
    }),
  }
) {}

// 2. Create runtime atom
const myRuntimeAtom = Atom.runtime(MyService.Default);

// 3. Derive atoms for React
const itemsAtom = myRuntimeAtom.atom(
  Effect.gen(function* () {
    const svc = yield* MyService;
    return Atom.get(svc.atoms.items);
  })
);

// 4. Create operation functions
const addItem = myRuntimeAtom.fn(
  (item: Item) => Effect.gen(function* () {
    const svc = yield* MyService;
    yield* svc.addItem(item);
  })
);

// 5. React consumption
function MyComponent() {
  const items = useAtomValue(itemsAtom);
  const add = useAtomValue(addItem);

  return (
    <button onClick={() => add({ id: "1", name: "New" })}>
      Add ({items.length} items)
    </button>
  );
}`,
          caption: "Complete Atom-as-State pattern"
        }
      ],
      patternMappings: [
        {
          affinePattern: "Jotai atom()",
          tmnlImplementation: "Atom.make()",
          notes: "Same concept, Effect integration"
        },
        {
          affinePattern: "useAtom()",
          tmnlImplementation: "useAtomValue() + service mutations",
          notes: "Separate read from write for better control"
        },
        {
          affinePattern: "LiveData.$()",
          tmnlImplementation: "Atom subscription via useAtomValue",
          notes: "Automatic subscription management"
        },
        {
          affinePattern: "useService(Service)",
          tmnlImplementation: "useAtomValue(runtimeAtom.atom(...))",
          notes: "Service access through runtime atoms"
        }
      ]
    },
    {
      id: "reactive-streams",
      title: "Reactive Streams",
      content: `### Progressive Data Loading

For streaming data (search results, paginated content), use Effect streams with atom updates:`,
      codeExamples: [
        {
          language: "typescript",
          filename: "streaming-pattern.ts",
          code: `class SearchService extends Effect.Service<SearchService>()(
  "tmnl/SearchService",
  {
    effect: Effect.gen(function* () {
      const resultsAtom = Atom.make<SearchResult[]>([]);
      const statusAtom = Atom.make<"idle" | "searching" | "done">("idle");

      return {
        atoms: { results: resultsAtom, status: statusAtom },

        search: (query: string) =>
          Effect.gen(function* () {
            Atom.set(statusAtom, "searching");
            Atom.set(resultsAtom, []);

            // Stream results progressively
            yield* searchStream(query).pipe(
              Stream.tap(result =>
                Effect.sync(() => {
                  Atom.update(resultsAtom, r => [...r, result]);
                })
              ),
              Stream.runDrain
            );

            Atom.set(statusAtom, "done");
          }),
      };
    }),
  }
) {}`,
          caption: "Stream-to-atom pattern for progressive updates"
        }
      ]
    }
  ]
}

/**
 * Storage Architecture
 */
const STORAGE_ARCHITECTURE: DocEntry = {
  id: "storage-architecture" as DocId,
  title: "Storage Architecture",
  description: "TMNL-native local-first storage patterns.",
  category: "architecture",
  updatedAt: "2025-12-22",
  relatedDocs: ["overhaul-overview", "state-management-patterns"],
  sections: [
    {
      id: "local-first-principles",
      title: "Local-First Principles",
      content: `### What We Learned from AFFiNE

AFFiNE's local-first approach:
1. Data stored locally first (IndexedDB/SQLite)
2. Cloud sync optional
3. Offline-capable
4. Conflict resolution via CRDT

### TMNL Approach

We adopt the same principles with Effect-native implementation:

| Principle | Implementation |
|-----------|----------------|
| Local-first | IndexedDB (web), SQLite (Tauri) |
| Effect-native | Storage as Effect.Service |
| Platform-aware | Backend selection via Layer |
| Schema-validated | Effect Schema for documents |`,
    },
    {
      id: "storage-service",
      title: "Storage Service",
      content: `### Effect-Native Storage`,
      codeExamples: [
        {
          language: "typescript",
          filename: "storage-service.ts",
          code: `import { Effect, Layer, Context } from "effect";
import { Schema } from "effect";

// Storage backend protocol
interface StorageBackend {
  readonly get: (key: string) => Effect.Effect<Uint8Array | null>;
  readonly set: (key: string, value: Uint8Array) => Effect.Effect<void>;
  readonly delete: (key: string) => Effect.Effect<void>;
  readonly list: (prefix: string) => Effect.Effect<string[]>;
}

// Backend tag
class StorageBackend extends Context.Tag("tmnl/StorageBackend")<
  StorageBackend,
  StorageBackend
>() {}

// IndexedDB implementation
const IndexedDBBackend = Layer.effect(
  StorageBackend,
  Effect.gen(function* () {
    const db = yield* openDatabase("tmnl-docs");

    return {
      get: (key) => Effect.tryPromise(() => db.get("documents", key)),
      set: (key, value) => Effect.tryPromise(() => db.put("documents", value, key)),
      delete: (key) => Effect.tryPromise(() => db.delete("documents", key)),
      list: (prefix) => Effect.tryPromise(async () => {
        const keys = await db.getAllKeys("documents");
        return keys.filter(k => k.startsWith(prefix));
      }),
    };
  })
);

// Tauri SQLite implementation
const TauriSqliteBackend = Layer.effect(
  StorageBackend,
  Effect.gen(function* () {
    const db = yield* Effect.tryPromise(() =>
      Database.load("sqlite:tmnl.db")
    );

    return {
      get: (key) => Effect.tryPromise(async () => {
        const rows = await db.select("SELECT data FROM documents WHERE key = ?", [key]);
        return rows[0]?.data ?? null;
      }),
      set: (key, value) => Effect.tryPromise(() =>
        db.execute("INSERT OR REPLACE INTO documents (key, data) VALUES (?, ?)", [key, value])
      ),
      delete: (key) => Effect.tryPromise(() =>
        db.execute("DELETE FROM documents WHERE key = ?", [key])
      ),
      list: (prefix) => Effect.tryPromise(async () => {
        const rows = await db.select("SELECT key FROM documents WHERE key LIKE ?", [prefix + "%"]);
        return rows.map(r => r.key);
      }),
    };
  })
);`,
          caption: "Platform-aware storage backend with Effect Layer"
        }
      ]
    },
    {
      id: "document-storage",
      title: "Document Storage",
      content: `### High-Level Document Service`,
      codeExamples: [
        {
          language: "typescript",
          filename: "document-storage.ts",
          code: `class DocumentStorage extends Effect.Service<DocumentStorage>()(
  "tmnl/DocumentStorage",
  {
    effect: Effect.gen(function* () {
      const backend = yield* StorageBackend;

      // Encode/decode documents
      const encode = Schema.encode(Document);
      const decode = Schema.decode(Document);

      return {
        load: (id: string) =>
          Effect.gen(function* () {
            const data = yield* backend.get(\`doc:\${id}\`);
            if (!data) return null;
            const json = new TextDecoder().decode(data);
            return yield* decode(JSON.parse(json));
          }),

        save: (doc: Document) =>
          Effect.gen(function* () {
            const json = JSON.stringify(yield* encode(doc));
            const data = new TextEncoder().encode(json);
            yield* backend.set(\`doc:\${doc.id}\`, data);
          }),

        delete: (id: string) =>
          backend.delete(\`doc:\${id}\`),

        list: () =>
          Effect.gen(function* () {
            const keys = yield* backend.list("doc:");
            return keys.map(k => k.slice(4)); // Remove "doc:" prefix
          }),
      };
    }),
  }
) {}

// Provide appropriate backend based on platform
const StorageLayer = Effect.gen(function* () {
  const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
  return isTauri ? TauriSqliteBackend : IndexedDBBackend;
}).pipe(Layer.unwrapEffect);`,
          caption: "Document storage with schema validation and platform detection"
        }
      ],
      patternMappings: [
        {
          affinePattern: "nbstore StoreConsumer",
          tmnlImplementation: "StorageBackend + Layer selection",
          notes: "Same abstraction, Effect-native"
        },
        {
          affinePattern: "DocFrontend observable",
          tmnlImplementation: "Atom + service subscription",
          notes: "Documents exposed as atoms for React"
        }
      ]
    }
  ]
}

/**
 * UI Component Patterns
 */
const UI_COMPONENT_PATTERNS: DocEntry = {
  id: "ui-component-patterns" as DocId,
  title: "UI Component Patterns",
  description: "UI patterns learned from AFFiNE's component library.",
  category: "patterns",
  updatedAt: "2025-12-22",
  relatedDocs: ["overhaul-overview"],
  sections: [
    {
      id: "affine-components-reference",
      title: "AFFiNE Components (Reference)",
      content: `### What AFFiNE Uses

- **Radix UI Primitives** — Dialog, Popover, Menu, Tooltip, etc.
- **Emotion CSS-in-JS** — Styling
- **CSS Variables** — Theming with \`--affine-*\` tokens
- **anime.js** — Animations

### What TMNL Already Has

TMNL doesn't need to copy these — we have equivalents:

| AFFiNE | TMNL |
|--------|------|
| Radix primitives | Already using Radix |
| Emotion | Tailwind + CSS variables |
| \`--affine-*\` tokens | \`--tmnl-*\` tokens |
| anime.js | GSAP + anime.js drivers |`,
    },
    {
      id: "modal-service-pattern",
      title: "Modal Service Pattern",
      content: `### What We Learned

AFFiNE uses service-based dialog management instead of component state:

\`\`\`typescript
// AFFiNE pattern
dialogService.open('confirm', { title: 'Delete?', onConfirm });
\`\`\`

This is cleaner than \`useState(isOpen)\` scattered everywhere.

### TMNL Implementation`,
      codeExamples: [
        {
          language: "typescript",
          filename: "modal-service.ts",
          code: `import { Effect } from "effect";
import { Atom } from "@effect-atom/atom-react";

interface ModalConfig {
  id: string;
  type: "confirm" | "alert" | "custom";
  props: Record<string, unknown>;
}

class ModalService extends Effect.Service<ModalService>()(
  "tmnl/ModalService",
  {
    effect: Effect.gen(function* () {
      const stackAtom = Atom.make<ModalConfig[]>([]);

      return {
        atoms: { stack: stackAtom },

        open: (config: Omit<ModalConfig, "id">) =>
          Effect.sync(() => {
            const id = crypto.randomUUID();
            Atom.update(stackAtom, stack => [
              ...stack,
              { ...config, id },
            ]);
            return id;
          }),

        close: (id: string) =>
          Effect.sync(() => {
            Atom.update(stackAtom, stack =>
              stack.filter(m => m.id !== id)
            );
          }),

        closeAll: () =>
          Effect.sync(() => Atom.set(stackAtom, [])),
      };
    }),
  }
) {}`,
          caption: "Service-based modal management"
        }
      ]
    },
    {
      id: "toolbar-patterns",
      title: "Toolbar Patterns",
      content: `### Dynamic Toolbar Composition

AFFiNE uses module-based toolbars where actions are registered dynamically.

### TMNL Pattern`,
      codeExamples: [
        {
          language: "typescript",
          filename: "toolbar-registry.ts",
          code: `// Action definition
const ToolbarAction = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  icon: Schema.String,
  shortcut: Schema.optional(Schema.String),
  group: Schema.Literal("format", "insert", "block", "more"),
  isEnabled: Schema.optional(Schema.Any), // Selector function
});

// Registry service
class ToolbarRegistry extends Effect.Service<ToolbarRegistry>()(
  "tmnl/ToolbarRegistry",
  {
    effect: Effect.gen(function* () {
      const actionsAtom = Atom.make<ToolbarAction[]>([]);

      return {
        atoms: { actions: actionsAtom },

        register: (action: ToolbarAction) =>
          Effect.sync(() => {
            Atom.update(actionsAtom, actions => [...actions, action]);
          }),

        unregister: (id: string) =>
          Effect.sync(() => {
            Atom.update(actionsAtom, actions =>
              actions.filter(a => a.id !== id)
            );
          }),

        getByGroup: (group: string) =>
          Effect.sync(() =>
            Atom.get(actionsAtom).filter(a => a.group === group)
          ),
      };
    }),
  }
) {}`,
          caption: "Extensible toolbar action registry"
        }
      ]
    }
  ]
}

/**
 * Implementation Roadmap
 */
const IMPLEMENTATION_ROADMAP: DocEntry = {
  id: "implementation-roadmap" as DocId,
  title: "Implementation Roadmap",
  description: "Phased approach for building TMNL subsystems.",
  category: "guide",
  updatedAt: "2025-12-22",
  relatedDocs: ["overhaul-overview", "block-editor-architecture"],
  sections: [
    {
      id: "phase-0",
      title: "Phase 0: Foundation",
      content: `### Objectives

- Document architecture decisions (this documentation)
- Establish patterns and conventions
- Set up development infrastructure

### Deliverables

- [x] Architecture documentation
- [x] Pattern reference
- [ ] Block Schema definitions
- [ ] Storage service skeleton`,
    },
    {
      id: "phase-1",
      title: "Phase 1: Block Editor Core",
      content: `### Objectives

- Implement core block types (paragraph, heading, list, code)
- Build block tree rendering
- Implement basic selection

### Tasks

- [ ] Define Block schemas with Effect Schema
- [ ] Create BlockRenderer component
- [ ] Implement EditorService with Atom-as-State
- [ ] Build basic selection system
- [ ] Add keyboard navigation

### Success Criteria

- Can create and edit a document with basic blocks
- Selection works for text and blocks
- Undo/redo functional`,
    },
    {
      id: "phase-2",
      title: "Phase 2: Rich Editing",
      content: `### Objectives

- Rich text formatting (bold, italic, code, link)
- Block operations (move, duplicate, delete)
- Slash commands

### Tasks

- [ ] Implement text marks system
- [ ] Add block toolbar
- [ ] Create slash command menu
- [ ] Implement drag-to-reorder
- [ ] Add copy/paste support

### Success Criteria

- Full rich text editing works
- Slash commands insert blocks
- Blocks can be rearranged`,
    },
    {
      id: "phase-3",
      title: "Phase 3: Storage",
      content: `### Objectives

- Local persistence (IndexedDB + SQLite)
- Auto-save
- Document management

### Tasks

- [ ] Implement StorageBackend protocol
- [ ] Build IndexedDB backend
- [ ] Build Tauri SQLite backend
- [ ] Add DocumentStorage service
- [ ] Implement auto-save with debouncing

### Success Criteria

- Documents persist across reloads
- Works in both web and Tauri
- No data loss on crash`,
    },
    {
      id: "phase-4",
      title: "Phase 4: Canvas Mode",
      content: `### Objectives

- Infinite canvas view of documents
- Free positioning of blocks
- Drawing tools

### Tasks

- [ ] Integrate tldraw or React Flow
- [ ] Create canvas block wrappers
- [ ] Implement mode switching
- [ ] Add canvas-specific blocks (shapes, connectors)

### Success Criteria

- Same document viewable in page and canvas modes
- Blocks positioned freely on canvas
- Mode switching preserves state`,
    },
    {
      id: "phase-5",
      title: "Phase 5: Collaboration (Future)",
      content: `### Objectives

- Real-time collaboration
- Conflict-free editing
- Presence awareness

### Considerations

This phase requires CRDT implementation. Options:
1. **Yjs** — Proven, but adds dependency
2. **Effect-native CRDT** — Full control, significant effort
3. **Automerge** — Alternative to Yjs

### Decision Point

Defer CRDT choice until phases 1-4 are solid. Local-first single-user is valuable on its own.`,
    }
  ]
}

// =============================================================================
// Registry
// =============================================================================

export const DOC_REGISTRY: readonly DocEntry[] = [
  OVERHAUL_OVERVIEW,
  BLOCK_EDITOR_ARCHITECTURE,
  STATE_MANAGEMENT_PATTERNS,
  STORAGE_ARCHITECTURE,
  UI_COMPONENT_PATTERNS,
  IMPLEMENTATION_ROADMAP,
] as const

/**
 * Get doc by ID
 */
export const getDoc = (id: string): DocEntry | undefined =>
  DOC_REGISTRY.find((d) => d.id === id)

/**
 * Get docs by category
 */
export const getDocsByCategory = (category: DocCategory): DocEntry[] =>
  DOC_REGISTRY.filter((d) => d.category === category)

/**
 * Get all doc categories with counts
 */
export const getDocCategoryCounts = (): Record<DocCategory, number> => {
  const counts: Record<DocCategory, number> = {
    overview: 0,
    architecture: 0,
    patterns: 0,
    guide: 0,
    reference: 0,
  }
  for (const doc of DOC_REGISTRY) {
    counts[doc.category]++
  }
  return counts
}
