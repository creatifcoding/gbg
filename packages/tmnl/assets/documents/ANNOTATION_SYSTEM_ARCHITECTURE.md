# TMNL Annotation System Architecture

> **Status**: Design Complete, Ready for Implementation
> **Epic**: Annotation System (Intent Marks + Rich Popovers + Graph)
> **Author**: Val × Prime
> **Date**: 2025-12-28

---

## Executive Summary

A comprehensive annotation system for the TipTap/ProseMirror editor that supports:

1. **Intent Marks** — Inline marks with configurable visual styles and semantic intents
2. **Rich Popovers** — Smooth UI-powered popovers for annotation content
3. **Hidden Nodes** — Non-rendered ProseMirror nodes storing annotation content
4. **Annotation Graph** — Annotations can reference other annotations
5. **Agent Tools** — Full schema access for programmatic marking
6. **Effect Executor** — Fiber-per-intent execution model

---

## 1. Core Concepts

### 1.1 Intent Mark (Inline Mark)

The fundamental unit—a ProseMirror mark that wraps text with:

- **Visual Style**: How the mark renders (highlight, pill, squiggle, underline)
- **Intent Type**: What happens on interaction (popover, expand, drawer, action, link)
- **Intent Payload**: Data for the intent (annotation ID, URL, action registry key)
- **Tags**: Freeform strings for filtering/querying

### 1.2 Annotation Node (Hidden Node)

A non-rendered ProseMirror node that stores rich content:

- Lives in the document but isn't visually rendered
- Referenced by Intent Marks via `annotationId`
- Can contain arbitrary block content (paragraphs, lists, code, nested editors)
- Travels with the document (no external sync needed for content)

### 1.3 Annotation Graph

Annotations form a directed graph:

- **Nodes**: Annotation entities (mark + hidden content)
- **Edges**: References between annotations (backlinks, citations, threads)
- **Traversal**: Query related annotations, find backlinks, visualize connections

---

## 2. Schema Definitions (Effect Schema)

```typescript
import { Schema } from "effect";

// ─────────────────────────────────────────────────────────────
// Branded IDs
// ─────────────────────────────────────────────────────────────

export const AnnotationId = Schema.String.pipe(
  Schema.brand("AnnotationId"),
  Schema.pattern(/^ann_[a-zA-Z0-9]{12}$/)
);
export type AnnotationId = typeof AnnotationId.Type;

export const DocumentId = Schema.String.pipe(Schema.brand("DocumentId"));
export type DocumentId = typeof DocumentId.Type;

// ─────────────────────────────────────────────────────────────
// Visual Styles
// ─────────────────────────────────────────────────────────────

export const VisualStyleType = Schema.Literal(
  "highlight",   // Background color
  "pill",        // Rounded container with background
  "squiggle",    // Wavy underline
  "underline",   // Solid/dotted underline
  "none"         // Invisible (intent-only)
);
export type VisualStyleType = typeof VisualStyleType.Type;

export const VisualEffect = Schema.Literal(
  "none",        // No effect
  "grain",       // Subtle texture overlay
  "glow",        // Soft glow edges
  "animate"      // Animated (squiggle crawl, pulse)
);
export type VisualEffect = typeof VisualEffect.Type;

export const VisualStyle = Schema.Struct({
  type: VisualStyleType,
  color: Schema.String,           // TMNL token: "accent.cyan", "status.warning"
  effect: Schema.optional(VisualEffect),
  animated: Schema.optional(Schema.Boolean),
});
export type VisualStyle = typeof VisualStyle.Type;

// ─────────────────────────────────────────────────────────────
// Intent Types + Payloads
// ─────────────────────────────────────────────────────────────

export const InteractionMode = Schema.Literal(
  "hover",       // Popover on hover
  "click",       // Popover on click
  "expand",      // Inline expansion
  "drawer",      // Side drawer
  "navigate",    // Navigate to target
  "execute"      // Run Effect program
);
export type InteractionMode = typeof InteractionMode.Type;

// Hyperlink — external URL
export const HyperlinkIntent = Schema.TaggedStruct("Hyperlink", {
  href: Schema.String,
  target: Schema.optional(Schema.Literal("_blank", "_self")),
});

// Ultralink — internal document/annotation reference
export const UltralinkIntent = Schema.TaggedStruct("Ultralink", {
  documentId: Schema.optional(DocumentId),
  annotationId: Schema.optional(AnnotationId),
  anchor: Schema.optional(Schema.String),  // Section/heading anchor
});

// Popover — rich content in popover
export const PopoverIntent = Schema.TaggedStruct("Popover", {
  annotationId: AnnotationId,              // References hidden node
  interaction: InteractionMode,
});

// Action — executes registered Effect program
export const ActionIntent = Schema.TaggedStruct("Action", {
  registryKey: Schema.String,              // Key in IntentRegistry
  params: Schema.optional(Schema.Unknown), // Parameters for the program
});

// Citation — academic/reference citation
export const CitationIntent = Schema.TaggedStruct("Citation", {
  annotationId: AnnotationId,
  citationKey: Schema.optional(Schema.String),  // BibTeX key
});

export const IntentPayload = Schema.Union(
  HyperlinkIntent,
  UltralinkIntent,
  PopoverIntent,
  ActionIntent,
  CitationIntent
);
export type IntentPayload = typeof IntentPayload.Type;

// ─────────────────────────────────────────────────────────────
// Intent Mark (ProseMirror Mark Schema)
// ─────────────────────────────────────────────────────────────

export const IntentMark = Schema.Struct({
  id: AnnotationId,
  visualStyle: VisualStyle,
  intent: IntentPayload,
  tags: Schema.Array(Schema.String),

  // Metadata
  createdAt: Schema.DateFromSelf,
  createdBy: Schema.Literal("manual", "agent", "system"),

  // Graph edges (outgoing references)
  references: Schema.optional(Schema.Array(AnnotationId)),
});
export type IntentMark = typeof IntentMark.Type;

// ─────────────────────────────────────────────────────────────
// Annotation Node (Hidden ProseMirror Node)
// ─────────────────────────────────────────────────────────────

export const AnnotationNode = Schema.Struct({
  id: AnnotationId,

  // Rich content stored as ProseMirror JSON
  content: Schema.Unknown,  // ProseMirror Node JSON

  // Backlinks (computed, not stored)
  // referencedBy: Schema.Array(AnnotationId),

  // Metadata
  title: Schema.optional(Schema.String),
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
});
export type AnnotationNode = typeof AnnotationNode.Type;
```

---

## 3. Rendering Strategy

### 3.1 Tiered Rendering

| Visual Style | Effect | Renderer | Notes |
|--------------|--------|----------|-------|
| `highlight` | `none` | CSS | `background-color` via decoration |
| `highlight` | `grain` | R3F Drei | Shader-based texture overlay |
| `pill` | any | React Component | Custom node view with styling |
| `squiggle` | `none` | CSS | `text-decoration: wavy underline` |
| `squiggle` | `animate` | R3F Drei | Animated wave shader |
| `underline` | any | CSS | `text-decoration` variants |

### 3.2 Position Tracking (Virtual Positions)

```typescript
interface MarkGeometry {
  annotationId: AnnotationId;
  charRange: { from: number; to: number };
  clientRects: DOMRect[];  // Computed on demand
}

// Measurement service computes pixel positions
class PositionMeasurement extends Effect.Service<PositionMeasurement>()(
  "tmnl/annotation/PositionMeasurement",
  {
    effect: Effect.gen(function* () {
      return {
        measure: (editorView: EditorView, from: number, to: number) =>
          Effect.sync(() => {
            const coords = editorView.coordsAtPos(from);
            // ... compute full geometry
          }),

        invalidate: () => Effect.sync(() => {
          // Clear cache on scroll/resize/edit
        }),
      };
    }),
  }
) {}
```

### 3.3 R3F Overlay Integration

For animated/textured effects, an R3F `<Canvas>` overlays the editor:

```tsx
// Positioned absolutely over editor container
<div className="relative">
  <EditorContent editor={editor} />
  <Canvas
    className="absolute inset-0 pointer-events-none"
    orthographic
    camera={{ zoom: 1 }}
  >
    <AnnotationEffectsLayer marks={animatedMarks} geometry={geometry} />
  </Canvas>
</div>
```

---

## 4. Intent Executor

### 4.1 Execution Model

Each intent activation spawns an **interruptible Effect fiber**:

```typescript
class IntentExecutor extends Effect.Service<IntentExecutor>()(
  "tmnl/annotation/IntentExecutor",
  {
    dependencies: [IntentRegistry, PopoverService, DrawerService, NavigationService],

    effect: Effect.gen(function* () {
      const registry = yield* IntentRegistry;
      const popover = yield* PopoverService;
      const drawer = yield* DrawerService;
      const nav = yield* NavigationService;

      // Active fibers for cancellation
      const activeFibers = yield* Ref.make<Map<AnnotationId, Fiber.Runtime<void, never>>>(
        new Map()
      );

      return {
        execute: (mark: IntentMark, trigger: "hover" | "click") =>
          Effect.gen(function* () {
            // Cancel existing fiber for this mark
            const fibers = yield* Ref.get(activeFibers);
            const existing = fibers.get(mark.id);
            if (existing) yield* Fiber.interrupt(existing);

            // Spawn new fiber
            const fiber = yield* pipe(
              executeIntent(mark, trigger, { registry, popover, drawer, nav }),
              Effect.fork
            );

            yield* Ref.update(activeFibers, (m) => new Map(m).set(mark.id, fiber));
          }),

        cancel: (annotationId: AnnotationId) =>
          Effect.gen(function* () {
            const fibers = yield* Ref.get(activeFibers);
            const fiber = fibers.get(annotationId);
            if (fiber) yield* Fiber.interrupt(fiber);
          }),
      };
    }),
  }
) {}

// Intent dispatch logic
const executeIntent = (
  mark: IntentMark,
  trigger: "hover" | "click",
  services: ExecutorServices
) =>
  Effect.gen(function* () {
    switch (mark.intent._tag) {
      case "Hyperlink":
        if (trigger === "click") {
          window.open(mark.intent.href, mark.intent.target ?? "_blank");
        }
        break;

      case "Ultralink":
        yield* services.nav.navigateTo({
          documentId: mark.intent.documentId,
          annotationId: mark.intent.annotationId,
          anchor: mark.intent.anchor,
        });
        break;

      case "Popover":
        const interaction = mark.intent.interaction;
        if (
          (interaction === "hover" && trigger === "hover") ||
          (interaction === "click" && trigger === "click")
        ) {
          yield* services.popover.show({
            annotationId: mark.intent.annotationId,
            anchorRect: yield* getMarkGeometry(mark.id),
          });
        }
        break;

      case "Action":
        const program = yield* services.registry.get(mark.intent.registryKey);
        yield* program(mark.intent.params);
        break;

      case "Citation":
        yield* services.popover.showCitation({
          annotationId: mark.intent.annotationId,
          citationKey: mark.intent.citationKey,
        });
        break;
    }
  });
```

### 4.2 Intent Registry

```typescript
type IntentProgram = (params: unknown) => Effect.Effect<void, never, never>;

class IntentRegistry extends Effect.Service<IntentRegistry>()(
  "tmnl/annotation/IntentRegistry",
  {
    effect: Effect.gen(function* () {
      const programs = yield* Ref.make<Map<string, IntentProgram>>(new Map());

      return {
        register: (key: string, program: IntentProgram) =>
          Ref.update(programs, (m) => new Map(m).set(key, program)),

        get: (key: string) =>
          Effect.gen(function* () {
            const m = yield* Ref.get(programs);
            const program = m.get(key);
            if (!program) {
              yield* Effect.fail(new Error(`Intent program not found: ${key}`));
            }
            return program!;
          }),

        list: () =>
          Effect.map(Ref.get(programs), (m) => Array.from(m.keys())),
      };
    }),
  }
) {}
```

---

## 5. Rich Popover System

Using [Smooth UI Rich Popover](https://smoothui.dev/docs/components/rich-popover) as the foundation:

### 5.1 Popover Service

```typescript
class PopoverService extends Effect.Service<PopoverService>()(
  "tmnl/annotation/PopoverService",
  {
    effect: Effect.gen(function* () {
      // Popover state lives in atoms
      return {
        show: (config: PopoverConfig) =>
          Effect.sync(() => {
            Atom.set(activePopoverAtom, Option.some(config));
          }),

        hide: () =>
          Effect.sync(() => {
            Atom.set(activePopoverAtom, Option.none());
          }),

        showCitation: (config: CitationPopoverConfig) =>
          Effect.sync(() => {
            Atom.set(activePopoverAtom, Option.some({
              type: "citation",
              ...config,
            }));
          }),
      };
    }),
  }
) {}
```

### 5.2 Popover Component

```tsx
import { RichPopover } from "@/components/ui/rich-popover";  // From smoothui

export function AnnotationPopover() {
  const popoverConfig = useAtomValue(activePopoverAtom);
  const annotationContent = useAnnotationContent(popoverConfig?.annotationId);

  if (Option.isNone(popoverConfig)) return null;

  const config = popoverConfig.value;

  return (
    <RichPopover
      open={true}
      onOpenChange={(open) => !open && hidePopover()}
      anchor={config.anchorRect}
    >
      <RichPopover.Trigger asChild>
        {/* Virtual anchor positioned at mark */}
        <div
          style={{
            position: "absolute",
            left: config.anchorRect.x,
            top: config.anchorRect.y,
            width: config.anchorRect.width,
            height: config.anchorRect.height,
          }}
        />
      </RichPopover.Trigger>

      <RichPopover.Content>
        <RichPopover.Header>
          <RichPopover.Title>{annotationContent.title}</RichPopover.Title>
        </RichPopover.Header>

        <RichPopover.Body>
          {/* Render annotation content as mini-editor or static HTML */}
          <AnnotationContentRenderer content={annotationContent.content} />
        </RichPopover.Body>

        <RichPopover.Footer>
          <Button variant="ghost" size="sm" onClick={editAnnotation}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={deleteAnnotation}>
            Delete
          </Button>
        </RichPopover.Footer>
      </RichPopover.Content>
    </RichPopover>
  );
}
```

---

## 6. Agent Tools Interface

Full schema access for programmatic marking:

```typescript
class AnnotationTools extends Effect.Service<AnnotationTools>()(
  "tmnl/annotation/AnnotationTools",
  {
    dependencies: [AnnotationService, EditorService],

    effect: Effect.gen(function* () {
      const annotations = yield* AnnotationService;
      const editor = yield* EditorService;

      return {
        // Create mark with full schema control
        applyMark: (
          from: number,
          to: number,
          config: {
            visualStyle: VisualStyle;
            intent: IntentPayload;
            tags?: string[];
          }
        ) =>
          Effect.gen(function* () {
            const id = yield* generateAnnotationId();
            const mark: IntentMark = {
              id,
              visualStyle: config.visualStyle,
              intent: config.intent,
              tags: config.tags ?? [],
              createdAt: new Date(),
              createdBy: "agent",
            };

            yield* editor.applyMark(from, to, mark);
            yield* annotations.persist(mark);

            return id;
          }),

        // Create annotation with rich content
        createAnnotation: (content: ProseMirrorJSON, title?: string) =>
          Effect.gen(function* () {
            const id = yield* generateAnnotationId();
            const node: AnnotationNode = {
              id,
              content,
              title,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            yield* editor.insertHiddenNode(node);
            return id;
          }),

        // Link mark to annotation
        linkToAnnotation: (markId: AnnotationId, annotationId: AnnotationId) =>
          annotations.addReference(markId, annotationId),

        // Query marks
        queryMarks: (filter: MarkFilter) =>
          annotations.query(filter),

        // Get mark at position
        getMarkAtPosition: (pos: number) =>
          editor.getMarkAt(pos, "intentMark"),

        // Batch operations
        applyMarksBatch: (operations: Array<{ from: number; to: number; config: MarkConfig }>) =>
          Effect.forEach(operations, ({ from, to, config }) =>
            annotations.applyMark(from, to, config)
          ),

        // Remove mark
        removeMark: (id: AnnotationId) =>
          Effect.gen(function* () {
            yield* editor.removeMark(id);
            yield* annotations.delete(id);
          }),

        // Update mark
        updateMark: (id: AnnotationId, patch: Partial<IntentMark>) =>
          annotations.update(id, patch),
      };
    }),
  }
) {}
```

---

## 7. Filter System

### 7.1 Atoms (Source of Truth)

```typescript
// Filter configuration
export const annotationFiltersAtom = Atom.make<AnnotationFilters>({
  visibleTags: new Set(["all"]),
  visibleStyles: new Set(["highlight", "pill", "squiggle", "underline"]),
  visibleIntents: new Set(["Hyperlink", "Ultralink", "Popover", "Action", "Citation"]),
  showHidden: false,  // Show hidden annotation nodes
});

// Derived: filtered marks
export const visibleMarksAtom = Atom.make((get) => {
  const marks = get(allMarksAtom);
  const filters = get(annotationFiltersAtom);

  return marks.filter((mark) => {
    // Tag filter
    if (!filters.visibleTags.has("all")) {
      if (!mark.tags.some((t) => filters.visibleTags.has(t))) return false;
    }

    // Style filter
    if (!filters.visibleStyles.has(mark.visualStyle.type)) return false;

    // Intent filter
    if (!filters.visibleIntents.has(mark.intent._tag)) return false;

    return true;
  });
});
```

### 7.2 Plugin Sync

```typescript
// ProseMirror plugin syncs decorations from atoms
const annotationDecorationPlugin = new Plugin({
  state: {
    init() {
      return DecorationSet.empty;
    },
    apply(tr, decorations, oldState, newState) {
      // Subscribe to atom changes via effect-atom
      const visibleMarks = Atom.get(visibleMarksAtom);

      return DecorationSet.create(
        newState.doc,
        visibleMarks.map((mark) =>
          Decoration.inline(mark.from, mark.to, {
            class: computeMarkClass(mark),
            "data-annotation-id": mark.id,
          })
        )
      );
    },
  },
});
```

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+H` | Apply highlight (opens style picker if no selection) |
| `Cmd+Shift+P` | Wrap in pill (opens annotation editor) |
| `Cmd+Shift+L` | Insert link (opens link dialog) |
| `Cmd+Shift+N` | Add note (creates annotation with popover) |
| `Cmd+Shift+C` | Add citation |
| `Cmd+Shift+A` | Add action (opens action picker) |
| `Escape` | Close active popover |
| `Cmd+Shift+F` | Open filter panel |

---

## 9. File Structure

```
src/lib/editor/v3/extensions/annotations/
├── index.ts                        # TipTap extension entry
├── extension.ts                    # Extension definition
├── schemas/
│   ├── index.ts                    # Re-exports
│   ├── mark.ts                     # IntentMark schema
│   ├── node.ts                     # AnnotationNode schema
│   └── intent.ts                   # Intent payload schemas
├── services/
│   ├── index.ts
│   ├── AnnotationService.ts        # CRUD, persistence
│   ├── IntentExecutor.ts           # Intent dispatch
│   ├── IntentRegistry.ts           # Action registration
│   ├── PopoverService.ts           # Popover state management
│   └── PositionMeasurement.ts      # Geometry computation
├── atoms/
│   └── index.ts                    # Runtime + state + operation atoms
├── plugins/
│   ├── decorations.ts              # Decoration plugin
│   ├── hiddenNodes.ts              # Hidden node management
│   └── keymap.ts                   # Keyboard shortcuts
├── components/
│   ├── AnnotationPopover.tsx       # Rich popover component
│   ├── AnnotationToolbar.tsx       # Inline toolbar on selection
│   ├── FilterPanel.tsx             # Tag/style/intent filters
│   └── StylePicker.tsx             # Visual style selection
├── renderers/
│   ├── CSSRenderer.tsx             # Basic mark styling
│   ├── PillRenderer.tsx            # Pill node view
│   └── R3FEffectsLayer.tsx         # Animated/textured effects
├── hooks/
│   ├── useAnnotations.ts           # Main hook
│   ├── useAnnotationContent.ts     # Fetch hidden node content
│   └── useMarkInteraction.ts       # Hover/click handling
└── utils/
    ├── idGenerator.ts              # ann_xxxxxxxxxxxx format
    └── graphTraversal.ts           # Backlinks, references
```

---

## 10. Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Effect Schemas (mark, node, intent types)
- [ ] AnnotationService (CRUD, persistence stub)
- [ ] TipTap extension skeleton
- [ ] Basic CSS highlight rendering

### Phase 2: Intent System
- [ ] IntentExecutor service
- [ ] IntentRegistry for actions
- [ ] Hyperlink + Ultralink handling
- [ ] Basic popover (no rich content yet)

### Phase 3: Rich Popovers
- [ ] Hidden node implementation
- [ ] PopoverService + atoms
- [ ] Smooth UI RichPopover integration
- [ ] Mini-editor for annotation content

### Phase 4: Visual Effects
- [ ] Pill mark rendering
- [ ] Squiggle CSS + animated variants
- [ ] R3F overlay layer
- [ ] Cybergrain shader

### Phase 5: Agent Tools + Filters
- [ ] AnnotationTools service
- [ ] Filter atoms + plugin sync
- [ ] FilterPanel UI
- [ ] Keyboard shortcuts

### Phase 6: Graph Features
- [ ] Reference tracking (outgoing)
- [ ] Backlink computation (incoming)
- [ ] Graph visualization (optional)

---

## 11. Open Questions

1. **Y.js Sync**: Should annotation nodes sync via Y.js for collaboration?
2. **External Persistence**: When/how to sync to JSONB store?
3. **Version History**: Should annotation edits be tracked?
4. **Permissions**: Can annotations be private/shared?

---

## References

- [TipTap Marks](https://tiptap.dev/docs/editor/api/marks)
- [TipTap Node Views](https://tiptap.dev/docs/editor/guide/node-views)
- [ProseMirror Decorations](https://prosemirror.net/docs/ref/#view.Decoration)
- [Smooth UI Rich Popover](https://smoothui.dev/docs/components/rich-popover)
- [Effect Schema](https://effect.website/docs/schema)
