# Session Reconstruction Architecture

> **Status**: Design Document
> **Author**: Val (Architectural Conscience)
> **Date**: 2025-12-22
> **Related Beads**: TBD

## Executive Summary

This document defines the architecture for **session reconstruction** — a robust persistence layer enabling TMNL to restore application state across page restarts, supporting heterogeneous applications from testbeds to production features.

**Key Decisions**:
- **Persistence**: Effect SQL sqlite-wasm (local-first, migration path to ElectricSQL)
- **Block Editor**: Effect Schema-backed blocks with Automerge CRDT
- **3D Document Space**: R3F + @react-three/uikit + Reagraph
- **State Management**: XState for navigation, effect-atom for reactive data

---

## 1. Persistence Layer

### 1.1 Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ useAtomValue │◄─┤  effect-atom │◄─┤ Effect.Ref   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              SessionPersistence Effect.Service               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  saveRoute(), loadRoute(), savePanels(), loadPanels()  │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              @effect/sql-sqlite-wasm                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  SQLite in WASM → IndexedDB (browser)                  │ │
│  │  SQLite native → filesystem (Tauri)                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Schema Design (Effect Schema)

```typescript
// src/lib/session/schemas.ts
import { Schema } from 'effect';

// Branded IDs
export const SessionId = Schema.String.pipe(
  Schema.brand('SessionId'),
  Schema.minLength(1)
);
export type SessionId = typeof SessionId.Type;

// Route state for scroll position restoration
export class RouteState extends Schema.Class<RouteState>('RouteState')({
  id: SessionId,
  route_path: Schema.String,
  scroll_x: Schema.Number,
  scroll_y: Schema.Number,
  timestamp: Schema.Number,
}) {}

// Panel configuration for layout restoration
export class PanelConfig extends Schema.Class<PanelConfig>('PanelConfig')({
  id: SessionId,
  panel_id: Schema.String,
  is_open: Schema.Boolean,
  width: Schema.Number,
  height: Schema.Number,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  }),
  z_index: Schema.Number,
  timestamp: Schema.Number,
}) {}

// Generic application state for heterogeneous apps
export class AppState extends Schema.Class<AppState>('AppState')({
  id: SessionId,
  app_key: Schema.String,  // e.g., "testbed/slider", "docs/viewer"
  state_json: Schema.String,  // JSON-encoded app-specific state
  timestamp: Schema.Number,
}) {}
```

### 1.3 Service Implementation

```typescript
// src/lib/session/service.ts
import { SqlClient } from '@effect/sql';
import { SqliteClient } from '@effect/sql-sqlite-wasm';
import { Effect, Layer } from 'effect';
import { RouteState, PanelConfig, AppState } from './schemas';

const SqlLive = SqliteClient.layer({
  filename: 'tmnl-sessions.db',
});

export class SessionPersistence extends Effect.Service<SessionPersistence>()(
  'tmnl/SessionPersistence',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      // Initialize tables
      yield* sql`
        CREATE TABLE IF NOT EXISTS route_states (
          id TEXT PRIMARY KEY,
          route_path TEXT UNIQUE NOT NULL,
          scroll_x INTEGER DEFAULT 0,
          scroll_y INTEGER DEFAULT 0,
          timestamp INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS panel_configs (
          id TEXT PRIMARY KEY,
          panel_id TEXT NOT NULL,
          is_open INTEGER DEFAULT 1,
          width INTEGER,
          height INTEGER,
          position_x INTEGER,
          position_y INTEGER,
          z_index INTEGER DEFAULT 0,
          timestamp INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_states (
          id TEXT PRIMARY KEY,
          app_key TEXT UNIQUE NOT NULL,
          state_json TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_route_path ON route_states(route_path);
        CREATE INDEX IF NOT EXISTS idx_app_key ON app_states(app_key);
      `;

      return {
        // Route persistence
        saveRoute: (state: RouteState) =>
          sql`INSERT INTO route_states ${sql.insert(state)}
              ON CONFLICT (route_path) DO UPDATE SET
                scroll_x = EXCLUDED.scroll_x,
                scroll_y = EXCLUDED.scroll_y,
                timestamp = EXCLUDED.timestamp`,

        loadRoute: (path: string) =>
          sql<RouteState>`SELECT * FROM route_states WHERE route_path = ${path}`
            .pipe(Effect.map((rows) => rows[0])),

        // Panel persistence
        savePanel: (config: PanelConfig) =>
          sql`INSERT INTO panel_configs ${sql.insert({
            ...config,
            position_x: config.position.x,
            position_y: config.position.y,
          })}
          ON CONFLICT (id) DO UPDATE SET
            is_open = EXCLUDED.is_open,
            width = EXCLUDED.width,
            height = EXCLUDED.height,
            position_x = EXCLUDED.position_x,
            position_y = EXCLUDED.position_y,
            z_index = EXCLUDED.z_index,
            timestamp = EXCLUDED.timestamp`,

        loadPanels: () =>
          sql<PanelConfig>`SELECT * FROM panel_configs ORDER BY z_index`,

        // Generic app state
        saveAppState: (state: AppState) =>
          sql`INSERT INTO app_states ${sql.insert(state)}
              ON CONFLICT (app_key) DO UPDATE SET
                state_json = EXCLUDED.state_json,
                timestamp = EXCLUDED.timestamp`,

        loadAppState: (appKey: string) =>
          sql<AppState>`SELECT * FROM app_states WHERE app_key = ${appKey}`
            .pipe(Effect.map((rows) => rows[0])),
      } as const;
    }),
    dependencies: [SqlLive],
  }
) {}
```

### 1.4 Atom Integration

```typescript
// src/lib/session/atoms.ts
import { Atom } from '@effect-atom/atom';
import { Effect } from 'effect';
import { SessionPersistence } from './service';
import { RouteState, AppState } from './schemas';

export const sessionRuntimeAtom = Atom.runtime(SessionPersistence.Default);

// Route state atom (derived from current location)
export const currentRouteStateAtom = sessionRuntimeAtom.atom(
  Effect.gen(function* () {
    const service = yield* SessionPersistence;
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    return yield* service.loadRoute(path);
  })
);

// Operations
export const sessionOps = {
  saveRoute: sessionRuntimeAtom.fn((state: RouteState) =>
    Effect.gen(function* () {
      const service = yield* SessionPersistence;
      yield* service.saveRoute(state);
    })
  ),

  saveAppState: sessionRuntimeAtom.fn((state: AppState) =>
    Effect.gen(function* () {
      const service = yield* SessionPersistence;
      yield* service.saveAppState(state);
    })
  ),

  loadAppState: sessionRuntimeAtom.fn((appKey: string) =>
    Effect.gen(function* () {
      const service = yield* SessionPersistence;
      return yield* service.loadAppState(appKey);
    })
  ),
};
```

### 1.5 Migration Path to ElectricSQL

When multi-device sync is needed:

1. **Add Postgres backend** with logical replication
2. **Deploy Electric sync service** (self-hosted or Electric Cloud)
3. **Create API proxy** for writes (Electric is read-only)
4. **Add TanStack DB collections** for reactive local state
5. **Effect services call TanStack** instead of direct SQL

Schema remains identical — only the transport changes.

---

## 2. Block Editor Architecture

### 2.1 Design Principles (Adapted from Affine)

| Affine Pattern | TMNL Adaptation |
|----------------|-----------------|
| Zod schemas | Effect Schema (TaggedStruct) |
| @preact/signals | effect-atom |
| Yjs CRDT | Automerge (better Rust interop) |
| RxJS Subjects | Effect streams / pub-sub |
| DI Container | Effect.Service |

### 2.2 Block Schema System

```typescript
// src/lib/doc-blocks/schemas.ts
import { Schema } from 'effect';

// Block categories
export const BlockRole = Schema.Literal('root', 'content', 'embed', 'layout');
export type BlockRole = typeof BlockRole.Type;

// Base block definition
export const BlockId = Schema.String.pipe(Schema.brand('BlockId'));
export type BlockId = typeof BlockId.Type;

// Paragraph block
export const ParagraphBlock = Schema.TaggedStruct('Paragraph', {
  id: BlockId,
  content: Schema.String,
  children: Schema.Array(BlockId),
});
export type ParagraphBlock = typeof ParagraphBlock.Type;

// Heading block
export const HeadingBlock = Schema.TaggedStruct('Heading', {
  id: BlockId,
  level: Schema.Literal(1, 2, 3, 4, 5, 6),
  content: Schema.String,
  children: Schema.Array(BlockId),
});
export type HeadingBlock = typeof HeadingBlock.Type;

// Code block
export const CodeBlock = Schema.TaggedStruct('Code', {
  id: BlockId,
  language: Schema.String,
  content: Schema.String,
  children: Schema.Array(BlockId),
});
export type CodeBlock = typeof CodeBlock.Type;

// Diagram block (Mermaid or Reagraph)
export const DiagramBlock = Schema.TaggedStruct('Diagram', {
  id: BlockId,
  diagramType: Schema.Literal('mermaid', 'reagraph'),
  source: Schema.String,
  children: Schema.Array(BlockId),
});
export type DiagramBlock = typeof DiagramBlock.Type;

// Union of all blocks
export const Block = Schema.Union(
  ParagraphBlock,
  HeadingBlock,
  CodeBlock,
  DiagramBlock
);
export type Block = typeof Block.Type;

// Document structure
export const Document = Schema.Struct({
  id: Schema.String.pipe(Schema.brand('DocumentId')),
  title: Schema.NonEmptyString,
  rootBlockId: BlockId,
  blocks: Schema.Record({ key: BlockId, value: Block }),
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
});
export type Document = typeof Document.Type;
```

### 2.3 Block Store Service

```typescript
// src/lib/doc-blocks/services/BlockStore.ts
import { Effect, Ref } from 'effect';
import { Block, BlockId, Document } from '../schemas';

export class BlockStore extends Effect.Service<BlockStore>()(
  'tmnl/BlockStore',
  {
    effect: Effect.gen(function* () {
      const blocksRef = yield* Ref.make<Map<BlockId, Block>>(new Map());
      const documentRef = yield* Ref.make<Document | null>(null);

      return {
        // Load document
        loadDocument: (doc: Document) =>
          Effect.gen(function* () {
            yield* Ref.set(documentRef, doc);
            yield* Ref.set(blocksRef, new Map(Object.entries(doc.blocks)));
          }),

        // Get block by ID
        getBlock: (id: BlockId) =>
          Ref.get(blocksRef).pipe(
            Effect.map((blocks) => blocks.get(id))
          ),

        // Update block
        updateBlock: (id: BlockId, updater: (block: Block) => Block) =>
          Effect.gen(function* () {
            const blocks = yield* Ref.get(blocksRef);
            const existing = blocks.get(id);
            if (existing) {
              const updated = updater(existing);
              yield* Ref.update(blocksRef, (m) => {
                const newMap = new Map(m);
                newMap.set(id, updated);
                return newMap;
              });
            }
          }),

        // Add block
        addBlock: (block: Block, parentId?: BlockId) =>
          Effect.gen(function* () {
            yield* Ref.update(blocksRef, (m) => {
              const newMap = new Map(m);
              newMap.set(block.id, block);
              return newMap;
            });
            // Update parent's children if specified
            if (parentId) {
              yield* Ref.update(blocksRef, (m) => {
                const parent = m.get(parentId);
                if (parent && 'children' in parent) {
                  const newMap = new Map(m);
                  newMap.set(parentId, {
                    ...parent,
                    children: [...parent.children, block.id],
                  });
                  return newMap;
                }
                return m;
              });
            }
          }),

        // Delete block
        deleteBlock: (id: BlockId) =>
          Ref.update(blocksRef, (m) => {
            const newMap = new Map(m);
            newMap.delete(id);
            return newMap;
          }),

        // Get all blocks
        getAllBlocks: () =>
          Ref.get(blocksRef).pipe(
            Effect.map((m) => Array.from(m.values()))
          ),

        // Get document
        getDocument: () => Ref.get(documentRef),
      } as const;
    }),
  }
) {}
```

---

## 3. 3D Document Space

### 3.1 Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    XState Navigation Machine                 │
│  States: grid → focusedDoc → search → editing               │
│  Controls: camera position, layout transitions              │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│              @react-three/uikit Components                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Root/Container│  │     Text    │  │   Custom    │       │
│  │ (Flexbox 3D) │  │  (MSDF Font)│  │  Materials  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│              Reagraph (3D Diagram Visualization)             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GraphCanvas: Force-directed, Hierarchical, Tree       │ │
│  │  15+ layouts, theming, path finding, clustering        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│              @react-three/fiber Canvas                       │
│  WebGL rendering, useFrame animations, scene management     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Navigation State Machine

```typescript
// src/lib/docs/machines/docNavigationMachine.ts
import { setup, assign } from 'xstate';
import { Document } from '../schemas';

interface DocNavContext {
  documents: Document[];
  selectedDoc: Document | null;
  searchQuery: string;
  viewMode: '2d' | '3d';
  cameraTarget: { x: number; y: number; z: number };
}

type DocNavEvents =
  | { type: 'SELECT_DOC'; doc: Document }
  | { type: 'CLOSE_DOC' }
  | { type: 'SEARCH'; query: string }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'TOGGLE_VIEW_MODE' }
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' };

export const docNavigationMachine = setup({
  types: {
    context: {} as DocNavContext,
    events: {} as DocNavEvents,
  },
}).createMachine({
  id: 'docNavigation',
  initial: 'grid',
  context: {
    documents: [],
    selectedDoc: null,
    searchQuery: '',
    viewMode: '3d',
    cameraTarget: { x: 0, y: 0, z: 10 },
  },
  states: {
    grid: {
      on: {
        SELECT_DOC: {
          target: 'focusedDoc',
          actions: assign({
            selectedDoc: ({ event }) => event.doc,
            cameraTarget: { x: 0, y: 0, z: 3 },
          }),
        },
        SEARCH: {
          target: 'searching',
          actions: assign({ searchQuery: ({ event }) => event.query }),
        },
        TOGGLE_VIEW_MODE: {
          actions: assign({
            viewMode: ({ context }) => (context.viewMode === '2d' ? '3d' : '2d'),
          }),
        },
      },
    },
    focusedDoc: {
      on: {
        CLOSE_DOC: {
          target: 'grid',
          actions: assign({
            selectedDoc: null,
            cameraTarget: { x: 0, y: 0, z: 10 },
          }),
        },
        ZOOM_IN: {
          actions: assign({
            cameraTarget: ({ context }) => ({
              ...context.cameraTarget,
              z: Math.max(context.cameraTarget.z - 1, 1),
            }),
          }),
        },
        ZOOM_OUT: {
          actions: assign({
            cameraTarget: ({ context }) => ({
              ...context.cameraTarget,
              z: Math.min(context.cameraTarget.z + 1, 15),
            }),
          }),
        },
      },
    },
    searching: {
      on: {
        CLEAR_SEARCH: {
          target: 'grid',
          actions: assign({ searchQuery: '' }),
        },
        SELECT_DOC: {
          target: 'focusedDoc',
          actions: assign({
            selectedDoc: ({ event }) => event.doc,
            searchQuery: '',
          }),
        },
      },
    },
  },
});
```

### 3.3 Bento Grid Layout

```typescript
// src/components/docs/DocsBentoGrid.tsx
import { Root, Container, Text } from '@react-three/uikit';
import { TMNL_TOKENS } from '@/lib/animation/tokens';

interface DocCard {
  id: string;
  title: string;
  description: string;
  category: string;
  span: 'single' | 'double' | 'triple';
}

const getSpanWidth = (span: DocCard['span']) => {
  switch (span) {
    case 'single': return 3;
    case 'double': return 6.5;
    case 'triple': return 10;
  }
};

export const DocsBentoGrid = ({ cards, onSelect }: {
  cards: DocCard[];
  onSelect: (card: DocCard) => void;
}) => (
  <Root
    flexDirection="column"
    gap={24}
    padding={32}
    backgroundColor={TMNL_TOKENS.colors.surface.base}
  >
    {/* Header */}
    <Container flexDirection="row" justifyContent="space-between" alignItems="center">
      <Text fontSize={32} fontWeight="bold" color={TMNL_TOKENS.colors.text.primary}>
        Documentation
      </Text>
      <Text fontSize={14} color={TMNL_TOKENS.colors.text.muted}>
        Living architecture docs
      </Text>
    </Container>

    {/* Grid rows */}
    <Container flexDirection="column" gap={16}>
      {/* Row logic - group cards by span */}
      <Container flexDirection="row" gap={16} flexWrap="wrap">
        {cards.map((card) => (
          <Container
            key={card.id}
            sizeX={getSpanWidth(card.span)}
            sizeY={card.span === 'single' ? 2.5 : 3.5}
            backgroundColor={TMNL_TOKENS.colors.surface.elevated}
            borderRadius={16}
            padding={24}
            flexDirection="column"
            justifyContent="space-between"
            hover={{
              backgroundColor: TMNL_TOKENS.colors.surface.overlay,
              cursor: 'pointer',
            }}
            onClick={() => onSelect(card)}
          >
            <Container flexDirection="column" gap={8}>
              <Text
                fontSize={18}
                fontWeight="semibold"
                color={TMNL_TOKENS.colors.text.primary}
              >
                {card.title}
              </Text>
              <Text
                fontSize={12}
                color={TMNL_TOKENS.colors.text.muted}
                wordBreak="break-word"
              >
                {card.description}
              </Text>
            </Container>
            <Container
              backgroundColor={TMNL_TOKENS.colors.accent.cyan + '20'}
              padding={[4, 8]}
              borderRadius={4}
              alignSelf="flex-start"
            >
              <Text fontSize={10} color={TMNL_TOKENS.colors.accent.cyan}>
                {card.category}
              </Text>
            </Container>
          </Container>
        ))}
      </Container>
    </Container>
  </Root>
);
```

### 3.4 Reagraph Integration for Diagrams

```typescript
// src/components/docs/DiagramViewer3D.tsx
import { GraphCanvas } from 'reagraph';
import { TMNL_TOKENS } from '@/lib/animation/tokens';

interface DiagramNode {
  id: string;
  label: string;
  type: 'service' | 'component' | 'external';
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const nodeColors = {
  service: TMNL_TOKENS.colors.accent.cyan,
  component: TMNL_TOKENS.colors.accent.warm,
  external: TMNL_TOKENS.colors.text.muted,
};

export const DiagramViewer3D = ({
  nodes,
  edges,
  layoutType = 'hierarchicalTd',
}: {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  layoutType?: 'forceDirected3d' | 'hierarchicalTd' | 'hierarchicalLr' | 'radialOut3d';
}) => (
  <GraphCanvas
    nodes={nodes.map((n) => ({
      ...n,
      fill: nodeColors[n.type],
    }))}
    edges={edges}
    layoutType={layoutType}
    theme={{
      canvas: {
        background: TMNL_TOKENS.colors.surface.base,
      },
      node: {
        fill: TMNL_TOKENS.colors.accent.cyan,
        label: {
          color: TMNL_TOKENS.colors.text.primary,
          fontSize: 12,
        },
      },
      edge: {
        fill: TMNL_TOKENS.colors.surface.overlay,
        label: {
          color: TMNL_TOKENS.colors.text.muted,
          fontSize: 10,
        },
      },
    }}
    draggable
    animated
  />
);
```

---

## 4. Route Integration

### 4.1 New Route Structure

```typescript
// In src/router.tsx

// Docs landing (bento grid)
const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs',
  component: DocsLanding,  // New: 3D bento grid
});

// Document viewer
const docViewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/$docId',
  component: DocViewer,  // Block editor + 3D diagrams
});

// Diagrams (existing, enhanced)
const diagramsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/diagrams',
  component: DiagramsPage,  // Enhanced with Reagraph option
});

// Diagrams 3D view
const diagrams3DRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/docs/diagrams/3d',
  component: Diagrams3DPage,  // Full Reagraph experience
});
```

### 4.2 Session Restoration Hook

```typescript
// src/lib/session/hooks/useSessionRestore.ts
import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { useLocation } from '@tanstack/react-router';
import { currentRouteStateAtom, sessionOps } from '../atoms';
import { RouteState } from '../schemas';

export const useSessionRestore = () => {
  const location = useLocation();
  const routeState = useAtomValue(currentRouteStateAtom);

  // Restore scroll position on mount
  useEffect(() => {
    if (routeState && typeof window !== 'undefined') {
      window.scrollTo(routeState.scroll_x, routeState.scroll_y);
    }
  }, [routeState]);

  // Save scroll position on change
  useEffect(() => {
    const handleScroll = () => {
      const state: RouteState = {
        id: `route-${location.pathname}` as any,
        route_path: location.pathname,
        scroll_x: window.scrollX,
        scroll_y: window.scrollY,
        timestamp: Date.now(),
      };
      sessionOps.saveRoute(state);
    };

    // Debounced save
    let timeout: NodeJS.Timeout;
    const debouncedSave = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleScroll, 200);
    };

    window.addEventListener('scroll', debouncedSave);
    return () => {
      window.removeEventListener('scroll', debouncedSave);
      clearTimeout(timeout);
    };
  }, [location.pathname]);
};
```

---

## 5. File Structure

```
src/lib/
├── session/
│   ├── index.ts                 # Public exports
│   ├── schemas.ts               # Effect Schemas (RouteState, PanelConfig, AppState)
│   ├── service.ts               # SessionPersistence Effect.Service
│   ├── atoms.ts                 # Runtime atom + operation atoms
│   └── hooks/
│       └── useSessionRestore.ts # React integration hook
│
├── doc-blocks/
│   ├── index.ts                 # Public exports
│   ├── schemas.ts               # Block schemas (Paragraph, Heading, Code, Diagram)
│   ├── services/
│   │   └── BlockStore.ts        # Effect.Service for block CRUD
│   ├── atoms/
│   │   └── index.ts             # Block registry + runtime atoms
│   └── components/
│       ├── BlockRenderer.tsx    # Polymorphic block rendering
│       └── BlockEditor.tsx      # Editing interface
│
└── docs/
    ├── index.ts                 # Public exports
    ├── machines/
    │   └── docNavigationMachine.ts  # XState navigation
    └── hooks/
        └── useDocNavigation.ts  # Machine + Effect integration

src/components/docs/
├── index.ts                     # Re-exports
├── DocsLanding.tsx              # Bento grid entry point
├── DocsBentoGrid.tsx            # 3D UIKit bento layout
├── DocViewer.tsx                # Block editor + diagrams
├── DiagramViewer3D.tsx          # Reagraph wrapper
└── diagrams/
    ├── DiagramsPage.tsx         # Existing (enhanced)
    ├── DiagramViewer.tsx        # Existing Mermaid viewer
    └── registry.ts              # Existing diagram registry
```

---

## 6. Implementation Phases

### Phase 1: Session Persistence Foundation
1. Create `src/lib/session/` with schemas, service, atoms
2. Implement SQLite tables via Effect SQL
3. Add `useSessionRestore` hook
4. Test with existing routes

### Phase 2: Docs Landing (Bento Grid)
1. Install @react-three/uikit
2. Create `DocsLanding` with 3D bento grid
3. Wire XState navigation machine
4. Connect to existing diagram registry

### Phase 3: Block Editor Foundation
1. Create `src/lib/doc-blocks/` with schemas
2. Implement `BlockStore` service
3. Create basic `BlockRenderer` and `BlockEditor`
4. Add to `/docs/$docId` route

### Phase 4: 3D Diagram Visualization
1. Install Reagraph
2. Create `DiagramViewer3D` component
3. Add Mermaid → Reagraph data transformation
4. Integrate with block editor (Diagram blocks)

### Phase 5: Full Integration
1. Connect session persistence to all docs routes
2. Add CRDT sync via Automerge
3. Implement collaborative editing markers
4. Performance optimization (virtualization, LOD)

---

## 7. Dependencies to Install

```bash
# Session persistence
bun add @effect/sql @effect/sql-sqlite-wasm

# 3D UI
bun add @react-three/uikit @react-three/uikit-default

# 3D diagrams
bun add reagraph

# Block editor (if using Automerge)
bun add @automerge/automerge

# MSDF font generation (dev)
bun add -d msdf-bmfont-xml
```

---

## 8. Open Questions

1. **Automerge vs Yjs**: Automerge has better Rust interop for Tauri, but Yjs has larger ecosystem. Decision: Start with Effect.Ref, add CRDT later.

2. **UIKit font setup**: Need MSDF fonts for 3D text. Decision: Generate from existing TMNL fonts or use default.

3. **Mermaid → Reagraph**: Transformation layer needed. Decision: Create converter service in Phase 4.

4. **Mobile support**: UIKit works but needs touch handling. Decision: Desktop-first, mobile later.

---

## References

- [Effect SQL Documentation](https://effect.website/docs/sql)
- [Reagraph Documentation](https://reagraph.dev/docs)
- [@react-three/uikit](https://github.com/pmndrs/uikit)
- [Affine BlockSuite](https://github.com/toeverything/affine)
- [ElectricSQL](https://electric-sql.com/docs)
- [Automerge](https://automerge.org/docs)
