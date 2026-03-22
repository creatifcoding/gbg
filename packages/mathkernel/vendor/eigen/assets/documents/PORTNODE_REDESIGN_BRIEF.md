# PortNode Redesign Brief

> For Gemini 3.0 / v0 — Complete architectural context for UI redesign

---

## Executive Summary

PortNode is a **ReactFlow custom node** representing data ports in a visual dataplane editor. It uses a **compound component pattern** (DynamicIsland-inspired) with an **XState state machine** (stx pattern) for visual states, bridged to React via **effect-atom**.

**Goal**: Redesign the visual layer while preserving the state machine and compound component architecture.

---

## 1. Architecture Overview

### File Structure

```
src/lib/dataplane/components/Port/
├── index.ts           # Public exports
├── types.ts           # Effect Schema types (PortSize, PortVisualState, PortTabId, PortEvent)
├── port-stx.ts        # XState machine + effect-atom bridge
├── context.tsx        # PortProvider + usePort hook
├── PortNode.tsx       # ReactFlow node wrapper (REDESIGN TARGET)
├── Item.tsx           # Main visual container
├── Badge.tsx          # Connection status indicator
├── Sidebar.tsx        # Expandable panel
├── Tab.tsx            # Tab components
├── TabPanel.tsx       # Tab content panel
├── Actions.tsx        # Action button container
├── Action.tsx         # Individual action button
├── Icon.tsx           # Icon wrapper
└── Label.tsx          # Port label
```

### Component Hierarchy

```tsx
<PortNode>                    // ReactFlow wrapper
  <PortProvider>              // Context provider (portId, size, send)
    <PortNodeInner>           // Main rendering logic
      <PortItem>              // Collapsible pill/card
        <Port.Icon />         // Direction arrow (→ ← ↔)
        <Port.Label />        // Port name
        <Port.Badge />        // Connection count
      </PortItem>
      <PortActions>           // Visible on hover/expanded
        <PortAction />        // Expand, Link, Configure, Delete
      </PortActions>
      <PortSidebar>           // Slides out when expanded
        <PortTab id="info">   // Info panel
        <PortTab id="config"> // Config panel
        <PortTab id="links">  // Links list
      </PortSidebar>
      <Handle />              // ReactFlow connection handles
    </PortNodeInner>
  </PortProvider>
</PortNode>
```

---

## 2. State Machine (XState + effect-atom)

### Visual States

| State | Appearance | Triggers |
|-------|------------|----------|
| `collapsed` | Compact pill, icon + label only | Initial state |
| `hovered` | Scale 1.05, glow effect, actions visible | Mouse enter |
| `expanded` | Sidebar visible, tabs active | Click expand |
| `linking` | Pulsing indicator, connection mode | Start linking action |

### State Transitions

```
collapsed ──HOVER──► hovered ──EXPAND──► expanded
    ▲                    │                   │
    │                    │                   │
    └──UNHOVER───────────┘                   │
    │                                        │
    └──COLLAPSE──────────────────────────────┘

collapsed ──START_LINKING──► linking ──END_LINKING──► collapsed
hovered ──START_LINKING──► linking
expanded ──START_LINKING──► linking
```

### Machine Context

```typescript
interface PortMachineContext {
  portId: PortId;
  activeTab: PortTabId;      // 'info' | 'config' | 'links'
  linkTarget: PortId | null;
  label?: string;
  direction?: PortDirection;
  dataType?: string;
}
```

### Operations API

```typescript
// portOps — imperative API for state transitions
portOps.hover(portId)           // HOVER event
portOps.unhover(portId)         // UNHOVER event
portOps.expand(portId)          // EXPAND event
portOps.collapse(portId)        // COLLAPSE event
portOps.toggleActions(portId)   // TOGGLE_ACTIONS event (collapsed ↔ hovered)
portOps.startLinking(portId)    // START_LINKING event
portOps.endLinking(portId)      // END_LINKING event
portOps.selectTab(portId, tabId) // SELECT_TAB event
```

### Atom Subscriptions

```typescript
// React consumption via effect-atom
const snapshot = useAtomValue(portSnapshotAtom(portId));   // Full XState snapshot
const state = useAtomValue(portStateValueAtom(portId));    // Just state value
const activeTab = useAtomValue(portMachineActiveTabAtom(portId));
const canExpand = useAtomValue(portCanExpandAtom(portId));
```

---

## 3. Data Model (Effect Schema)

### LinkPort

```typescript
class LinkPort extends Schema.TaggedClass<LinkPort>()('LinkPort', {
  id: PortId,                    // Branded string
  blockId: BlockId,              // Parent block
  direction: PortDirection,      // 'in' | 'out' | 'inout'
  dataType: PortDataType,        // 'table' | 'row' | 'cell' | 'json' | 'geojson' | 'stream'
  position: PortPosition,        // 'left' | 'right' | 'top' | 'bottom'
  label: Schema.optional(Schema.String),
  parentBlockId: Schema.optional(BlockId),
})
```

### Link

```typescript
class Link extends Schema.TaggedClass<Link>()('Link', {
  id: LinkId,
  sourcePort: PortId,
  targetPort: PortId,
  direction: LinkDirection,      // 'unidirectional' | 'bidirectional'
  relationship: LinkRelationship, // 'pipe' | 'sync' | 'aggregate' | 'mirror'
  transform: Schema.optional(Schema.String),
  createdAt: Schema.DateFromSelf,
  metadata: Schema.optional(Schema.Record(...)),
})
```

---

## 4. Visual Design System

### Color Palette (VANTA_COLORS)

```typescript
// Direction-based coloring
const DIRECTION_COLORS = {
  in: {
    bg: 'rgba(34, 211, 238, 0.15)',     // Cyan
    border: 'rgba(34, 211, 238, 0.6)',
    glow: '0 0 12px rgba(34, 211, 238, 0.4)',
  },
  out: {
    bg: 'rgba(251, 191, 36, 0.15)',     // Amber
    border: 'rgba(251, 191, 36, 0.6)',
    glow: '0 0 12px rgba(251, 191, 36, 0.4)',
  },
  inout: {
    bg: 'rgba(167, 139, 250, 0.15)',    // Violet
    border: 'rgba(167, 139, 250, 0.6)',
    glow: '0 0 12px rgba(167, 139, 250, 0.4)',
  },
};

// Surface hierarchy (darkest to lightest)
surface.void: '#000000'
surface.base: '#030303'
surface.elevated: '#0a0a0a'
surface.raised: '#111111'
surface.border: '#1a1a1a'

// Text hierarchy
text.primary: '#e5e5e5'
text.secondary: '#a3a3a3'
text.tertiary: '#737373'
text.muted: '#525252'

// Accents
accent.cyan: '#22d3ee'      // Primary accent
accent.emerald: '#34d399'   // Success
accent.amber: '#fbbf24'     // Warning
accent.rose: '#fb7185'      // Error/destructive
accent.violet: '#a78bfa'    // 3D/canvas
```

### Typography

```typescript
// Font families
family.mono: '"Share Tech Mono", monospace'  // Labels, IDs
family.grotesk: '"Space Grotesk", sans-serif' // Headings
family.sans: '"Geo", sans-serif'             // Body

// THE 12px FLOOR — minimum readable size
// Use CSS variables: style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
```

### Size Variants

| Variant | Dimensions | Use Case |
|---------|------------|----------|
| `compact` | 24×24px | Dense visualizer |
| `default` | 32×32px | Standard node |
| `large` | 48×48px | Focused/selected |

---

## 5. Current Implementation (PortNode.tsx)

### Structure

```tsx
// Outer wrapper
<div
  style={{
    backgroundColor: colors.bg,
    border: `2px solid ${colors.border}`,
    borderRadius: '12px',
    boxShadow: isGlowing ? colors.glow : 'none',
    minWidth: isExpanded ? 240 : 90,
    transition: 'all 200ms ease-out',
  }}
>
  {/* Main item */}
  <PortItem>
    <button onClick={handleToggleActions} />  // Toggle chevron
    <span>→ | ← | ↔</span>                    // Direction icon
    <span>{port.label ?? port.direction}</span> // Label
    <span>{typeIcon}</span>                    // Data type icon
    <PortBadge status={...} count={...} />     // Connection badge
  </PortItem>

  {/* Block ID (optional) */}
  {blockLabel && <div>{blockLabel}</div>}

  {/* Actions (hover/expanded) */}
  <PortActions>
    <PortAction icon={Maximize2} onClick={handleExpand} />
    <PortAction icon={Link2} onClick={handleStartLinking} />
    <PortAction icon={Settings} onClick={handleConfigure} />
    <PortAction icon={Trash2} onClick={handleDelete} variant="destructive" />
  </PortActions>

  {/* Sidebar (expanded only) */}
  <PortSidebar width={220}>
    <PortTab id="info">{...}</PortTab>
    <PortTab id="config">{...}</PortTab>
    <PortTab id="links">{...}</PortTab>
  </PortSidebar>

  {/* ReactFlow handles */}
  {showTargetHandle && <Handle type="target" position={Position.Left} />}
  {showSourceHandle && <Handle type="source" position={Position.Right} />}
</div>
```

### Tab Panels

**Info Tab**: Grid layout showing ID, Block, Direction, Data Type, Connections count

**Config Tab**: Label input field, read-only data type and position displays

**Links Tab**: List of connected ports with direction arrows (→/←), truncated IDs, relationship badges

---

## 6. Design Constraints

### MUST Preserve

1. **Compound component pattern** — `PortProvider` context + child slots
2. **XState integration** — All state changes via `portOps.*` functions
3. **effect-atom subscriptions** — `useAtomValue(portSnapshotAtom(portId))`
4. **ReactFlow compatibility** — `Handle` components for connections
5. **12px minimum font size** — Typography floor

### MUST Support

1. **Three directions** with distinct colors (in=cyan, out=amber, inout=violet)
2. **Four visual states** (collapsed, hovered, expanded, linking)
3. **Expandable sidebar** with tabbed content
4. **Action buttons** visible on hover/expanded
5. **Connection badges** showing link count
6. **Data type indicators** (table, row, cell, json icons)

### Free to Change

1. **Visual styling** — shapes, gradients, animations
2. **Layout** — sidebar position, action arrangement
3. **Micro-interactions** — hover effects, transitions
4. **Icon choices** — lucide-react available
5. **Tab panel content layouts**

---

## 7. Integration Points

### ReactFlow

```tsx
// PortNode is registered as custom node type
const nodeTypes: NodeTypes = {
  linkPort: PortNode,
};

// Used in DataplaneVisualizer
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  ...
/>
```

### Data Flow

```
DataplaneVisualizer
  └─ portsAtom (all ports)
      └─ maps to ReactFlow nodes
          └─ PortNode receives data.port
              └─ PortProvider supplies context
                  └─ portOps.* mutates XState actor
                      └─ panelRegistry.set() updates atoms
                          └─ useAtomValue() triggers re-render
```

### Dataplane Atoms

```typescript
// Get links connected to this port
const links = useAtomValue(linksForPortAtom(port.id));

// All available (already imported in PortNode.tsx):
// - portsAtom: all registered ports
// - linksAtom: all links
// - linksForPortAtom(portId): links for specific port
```

---

## 8. Animation Guidelines

### Current Transitions

```css
transition: all 200ms ease-out
```

### State-Based Styles

```typescript
const stateStyles = {
  collapsed: '',
  hovered: 'scale-105 shadow-[0_0_8px_rgba(168,219,197,0.3)]',
  expanded: 'opacity-100',
  linking: 'animate-pulse',
};
```

### Available Animation Tokens

```typescript
duration: {
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
}

easing: {
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
}
```

---

## 9. Dependencies

```json
{
  "@xyflow/react": "^12.x",          // ReactFlow
  "lucide-react": "^0.x",            // Icons
  "effect": "^3.x",                  // Schema, types
  "@effect-atom/atom-react": "^x",   // State management
  "xstate": "^5.x"                   // State machine
}
```

### Available Icons (lucide-react)

Currently used: `Link2, Settings, Trash2, Unplug, Maximize2, ChevronDown, ChevronUp`

---

## 10. Redesign Opportunities

### Current Pain Points

1. **Dense information** — All ports show same level of detail
2. **Rigid layout** — Sidebar always slides right
3. **Limited visual hierarchy** — Badge competes with icons
4. **No empty state animation** — Linking mode just pulses

### Potential Improvements

1. **Progressive disclosure** — Collapsed shows icon only, reveal on interaction
2. **Contextual sidebar** — Expand inline vs. overlay based on space
3. **Connection preview** — Show potential link targets during linking
4. **Data type visualization** — Animated icons reflecting data flow
5. **Status indicators** — Streaming, error, idle states

### Questions for Designer

1. Should expanded state replace collapsed or overlay it?
2. How should linking mode visualize potential targets?
3. Should sidebar support docking/detaching?
4. How should multiple ports on same block visually relate?

---

## Appendix: Key Code Snippets

### Event Handlers

```tsx
const handleMouseEnter = useCallback(() => {
  portOps.hover(port.id);
}, [port.id]);

const handleMouseLeave = useCallback(() => {
  portOps.unhover(port.id);
}, [port.id]);

const handleToggleActions = useCallback((e: React.MouseEvent) => {
  e.stopPropagation(); // Prevent ReactFlow interception
  if (isExpanded) {
    portOps.collapse(port.id);
  } else {
    portOps.toggleActions(port.id);
  }
}, [port.id, isExpanded]);
```

### State Reading

```tsx
const snapshot = useAtomValue(useMemo(() => portSnapshotAtom(port.id), [port.id]));
const state = (snapshot?.value ?? 'collapsed') as PortVisualState;
const isExpanded = state === 'expanded';
const isHovered = state === 'hovered';
const isLinking = state === 'linking';
```

### Handle Configuration

```tsx
// Handles based on port direction
const showSourceHandle = port.direction === 'out' || port.direction === 'inout';
const showTargetHandle = port.direction === 'in' || port.direction === 'inout';

<Handle
  type="target"
  position={Position.Left}
  id={`${port.id}-target`}
  className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-cyan-300"
/>
```

---

*Document generated for Gemini 3.0 / v0 redesign handoff*
