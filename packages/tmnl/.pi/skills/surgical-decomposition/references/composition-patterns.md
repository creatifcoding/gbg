# Composition Patterns for Component Decomposition

When the decomposition target is a React component or provider, these patterns transform flat prop-drilling into composable compound architectures.

## Pattern 1: Context Interface — state / actions / meta

**Problem:** Context exposes a flat bag of 10+ functions. Consumers can't distinguish reads from writes from metadata.

**Solution:** Structure context as three orthogonal slices:

```typescript
interface MyContextValue {
  /** Observable state — what consumers subscribe to */
  state: {
    readonly items: Map<string, ItemState>
    readonly activeId: string | null
    readonly isEnabled: boolean
  }
  /** Mutation functions — fire-and-forget actions */
  actions: {
    readonly add: (config: ItemConfig) => void
    readonly remove: (id: string) => void
    readonly update: (id: string, patch: Partial<ItemState>) => void
  }
  /** Refs, derived values, config — non-reactive metadata */
  meta: {
    readonly containerRef: MutableRefObject<DOMRect | null>
    readonly getViewport: () => Viewport
  }
}
```

**Audit command** — check if existing context is flat:
```bash
grep -c 'readonly.*:.*(' src/lib/TARGET/context/TargetContext.ts
# If > 5, it's a flat bag of functions. Restructure.
```

## Pattern 2: Dual-Layer Context

**Problem:** System-level and item-level concerns are jammed into one context.

**Solution:** Two contexts with different scopes:

```
SystemContext (Provider level)
├── state: all items, global config
├── actions: register, unregister, reorder
└── meta: workspace refs, persistence config

ItemContext (Per-item level)
├── state: this item's position, dimensions, visibility
├── actions: close, minimize, maximize
└── meta: id, title, dnd handles, border color
```

**When to use dual-layer:**
- System has N items, each with internal sub-components
- Sub-components (Header, Content, Controls) need item state
- You want zero-prop compound components

## Pattern 3: Compound Namespace

**Problem:** Consumers can't customize internal layout without forking the component.

**Solution:** Expose sub-components as `Component.*` via `Object.assign`:

```typescript
const ComponentRoot = memo(function ComponentRoot({ children, ...props }) {
  const ctx = buildContext(props)

  // Auto-detect: compound children vs default layout
  const hasCompound = isCompoundComposition(children)

  return (
    <ItemContext.Provider value={ctx}>
      <div {...rootProps}>
        {hasCompound ? children : (
          <>
            <ComponentHeader />
            <ComponentContent>{children}</ComponentContent>
            <ComponentResize />
          </>
        )}
      </div>
    </ItemContext.Provider>
  )
})

export const Component = Object.assign(ComponentRoot, {
  Header: ComponentHeader,
  Content: ComponentContent,
  Resize: ComponentResize,
  // Atomic sub-components
  Title: ComponentTitle,
  Controls: ComponentControls,
  CloseButton: ComponentClose,
})
```

**Compound detection helper:**
```typescript
function isCompoundComposition(children: ReactNode): boolean {
  if (!children || typeof children !== 'object') return false
  const arr = Array.isArray(children) ? children : [children]
  return arr.some(child =>
    child && typeof child === 'object' && 'type' in child &&
    (child.type === ComponentHeader || child.type === ComponentContent)
  )
}
```

## Pattern 4: Zero-Prop Atoms

**Problem:** Sub-components take 5-12 props drilled from parent.

**Solution:** Every atom reads from context. Zero props needed.

```typescript
// BEFORE: 12 props
<PanelHeader
  title={title}
  borderColor={borderColor}
  isMaximized={isMaximized}
  mode={mode}
  closable={closable}
  minimizable={minimizable}
  onClose={handleClose}
  onMinimize={handleMinimize}
  onToggleMode={handleToggleMode}
  onMaximizeToggle={handleMaximizeToggle}
  activatorRef={setActivatorNodeRef}
  listeners={listeners}
/>

// AFTER: zero props
<PanelHeader />
```

**Atom template:**
```typescript
export const MyAtom = memo(function MyAtom() {
  const { state, actions, meta } = useItemContext()
  return (
    <button
      data-slot="my-atom"
      onClick={actions.doThing}
      disabled={state.isDisabled}
    >
      {meta.label}
    </button>
  )
})
```

**Required attributes per components.build spec:**
- `data-slot="component-name"` — targeting for CSS/tests
- `data-state="active|disabled|..."` — state-based styling
- `role` / `aria-label` — accessibility

## Pattern 5: Hook Extraction from Providers

**Problem:** Provider is 400+ lines mixing context, dnd, persistence, event handlers.

**Solution:** Extract each concern into a dedicated hook. Provider becomes orchestration shell.

```typescript
// BEFORE: 391-line provider with inline everything
function Provider({ children }) {
  // 20 lines of workspace bounds logic
  // 30 lines of snap guide logic
  // 25 lines of dock preview logic
  // 15 lines of keyboard nudge logic
  // 40 lines of persistence logic
  // 50 lines of action wrappers (10x useCallback)
  // 65 lines of drag handlers
  // 30 lines of modifier chain
  // 10 lines of sensor setup
  // ...
}

// AFTER: 128-line orchestration shell
function Provider({ children }) {
  const contextValue = useActions()           // 43 lines
  const { workspaceRectRef } = useBounds()    // 62 lines
  const { guideRefs } = useSnapGuides()       // 54 lines
  const { previewRefs } = useDockPreview()    // 54 lines
  usePersistence({ disabled })                // 63 lines (fire-and-forget)
  useKeyboardNudge({ getViewport })           // 91 lines
  const modifiers = useModifiers({ ... })     // 64 lines
  const { onStart, onEnd } = useDragHandlers({ ... })  // 140 lines
  const sensors = useSensors(...)

  return (
    <Context.Provider value={contextValue}>
      <DndContext sensors={sensors} modifiers={modifiers} ...>
        {children}
      </DndContext>
    </Context.Provider>
  )
}
```

**Extraction order:** Fire-and-forget side effects first (persistence), then pure derivations (modifiers), then event handlers (drag), then context value (actions).

## Shell Audit Commands for Composition

```bash
# Count props on a component
grep -c 'readonly\|?: ' src/components/Target.tsx

# Find prop-drilling (same prop name in parent + child)
grep -h 'title\|borderColor\|isMaximized' Parent.tsx Child.tsx | sort

# Verify data-slot on all atoms
for f in src/components/atoms/*.tsx; do
  grep -q 'data-slot=' "$f" && echo "✓ $(basename $f)" || echo "✗ $(basename $f)"
done

# Count useCallback in provider (should be 0 after extraction)
grep -c 'useCallback' Provider.tsx

# Verify provider doesn't import state module directly
grep 'from.*state-module' Provider.tsx && echo "COUPLED" || echo "DECOUPLED"
```
