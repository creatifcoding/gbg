# Soft-Machine Panel System — Comprehensive Architecture Brief

> **STATUS**: Living document. Updated as research progresses.
> **SOURCE**: https://soft-machine.io — "A Recreational Mathematics Developer Environment"
> **BUNDLE**: `index-BOSGFHQG.js` (2.8MB, styled-components v6.3.9, React 18+)
> **PURPOSE**: Full reverse-engineering to inform TMNL panel system migration.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Panel Modes](#2-panel-modes)
3. [Panel Chrome — Anatomy of a Panel](#3-panel-chrome)
4. [Tiled Layout System](#4-tiled-layout-system)
5. [Floating Window System](#5-floating-window-system)
6. [Drag & Drop System](#6-drag--drop-system)
7. [Edge Docking / Drop Zones](#7-edge-docking--drop-zones)
8. [Stashing System](#8-stashing-system)
9. [Panel State Machine](#9-panel-state-machine)
10. [Visual Design Tokens](#10-visual-design-tokens)
11. [Keyboard Navigation](#11-keyboard-navigation)
12. [Complete API Surface](#12-complete-api-surface)
13. [DOM Structure Reference](#13-dom-structure-reference)
14. [Migration Map: SM → TMNL](#14-migration-map)

---

## 1. High-Level Architecture

### 1.1 Core Concept

Soft-Machine treats panels as **multi-modal containers** that can exist in three states:

| Mode | DOM Position | Sizing | Z-Layer |
|------|-------------|--------|---------|
| **Tiled** | Inside split-tree layout | Flex-based, separator-controlled | Base layer |
| **Floating** | Fixed position overlay | User-draggable/resizable | Above tiled, z-index ~1100+ |
| **Canvas** | Inside flow viewport | Engine-controlled | Canvas layer |

A panel can **transition between modes** at any time:
- `floatPanel(id)` → tiled → floating
- `tilePanel(id)` → floating → tiled
- `dockToEdge(id)` → floating → tiled at edge
- `dockToInnerEdge(id)` → floating → tiled between panels

### 1.2 Layout Hierarchy

```
┌─ Workspace ────────────────────────────────────────────────┐
│ ┌─ Top Bar ──────────────────────────────────────────────┐ │
│ │ [Title ▾] [Search ⌘K] [History] [Fork] [Publish]      │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌─ Base Layer (data-base-layer) ─────────────────────────┐ │
│ │                                                         │ │
│ │  ┌──────┐ ┌────────────────┐ ┌────────┐ ┌───────────┐ │ │
│ │  │TILED │║│    TILED        │║│ TILED  │║│  TILED    │ │ │
│ │  │panel │║│    panel        │║│ panel  │║│  panel    │ │ │
│ │  │      │║├────────────────┤║│        │║│           │ │ │
│ │  │      │║│    TILED        │║│        │║│           │ │ │
│ │  │      │║│    panel        │║│        │║│           │ │ │
│ │  └──────┘ └────────────────┘ └────────┘ └───────────┘ │ │
│ │                                                         │ │
│ │  ║ = Separator (draggable, col-resize or row-resize)    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ╔═ Floating Windows (position: fixed) ═══════════════════╗ │
│  ║  ┌─────────────────────┐                                ║ │
│  ║  │ FLOATING panel      │                                ║ │
│  ║  │ (z-index: 1100+)    │                                ║ │
│  ║  └─────────────────────┘                                ║ │
│  ╚═════════════════════════════════════════════════════════╝ │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 State Management

- **React useState** for panel map (`Map<panelId, PanelState>`)
- **React context** (`Cr()` — appears to be a Zustand or custom context)
- **No external state library detected** (no Redux, Zustand, Jotai imports visible)
- Panel state is a flat `Map` with per-panel config objects
- Layout state is a **panel tree** (recursive split tree structure)

### 1.4 Key Data Attributes

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-panel-id` | Panel container | Identifies panel by ID string |
| `data-floating-window` | Floating wrapper | Marks element as floating overlay |
| `data-split-key` | Split container | Identifies split pair (e.g., `"ide-editor:ide-terminal"`) |
| `data-base-layer` | Base layout root | The tiled layout container |
| `data-base-spacer` | Empty base area | Drop target for base-level dock |
| `data-inner-edge-dropzone` | Edge zone overlay | Values: `"left-inner"`, `"right-inner"` |
| `data-drag-item` | Draggable tab | Tab being dragged between panels |
| `data-search-bar` | Search overlay | Command palette container |
| `data-onboarding` | Tour/welcome | Onboarding state marker |
| `data-filepath` | File tree item | File/folder path for file explorer |
| `data-copy-button` | Copy button | Chat message copy action |

---

## 2. Panel Modes

### 2.1 Tiled Mode

Panels participate in the flex-based split layout:

```typescript
interface TiledPanelState {
  mode: 'tiled'
  isVisible: boolean
  isCollapsed: boolean  // collapsed to minimum width
  width: number         // separator-controlled
  order: number         // position in panel list
}
```

**CSS properties observed:**
```css
[data-panel-id] {
  display: flex;
  flex: 0 1 auto;
  overflow: hidden;
  position: relative;
}
```

### 2.2 Floating Mode

Panel becomes a `position: fixed` overlay:

```typescript
interface FloatingPanelState {
  mode: 'floating'
  floatX: number
  floatY: number
  floatWidth: number
  floatHeight: number
  floatOriginSide: 'left' | 'right'  // which side it was floated from
  isVisible: boolean
}
```

**CSS properties observed:**
```css
[data-floating-window] {
  position: fixed;
  transition: transform 0.2s ease-out;
  z-index: 1108;  /* increments per window */
}
```

### 2.3 Canvas Mode

Panel is rendered inside the computational canvas (flow viewport):

```typescript
interface CanvasPanelState {
  mode: 'canvas'
  // Positioned by engine, not user
}
```

---

## 3. Panel Chrome

### 3.1 Anatomy — Tiled Panel

```
┌─ Panel Container ([data-panel-id]) ──────────────────────┐
│ ┌─ Header Bar ─────────────────────────────────────────┐ │
│ │ [≡▾] TITLE  [🔍] [↻] [+] [⊞]                       │ │
│ │  ↑     ↑      ↑    ↑   ↑   ↑                        │ │
│ │ menu  label search refr new float                    │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌─ Content ────────────────────────────────────────────┐ │
│ │                                                       │ │
│ │           (panel-specific content)                    │ │
│ │                                                       │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌─ Tab Bar ────────────────────────────────────────────┐ │
│ │ [≡▾] [/workspace ×] [+]                    [↻] [⊞] │ │
│ │  ↑        ↑           ↑                      ↑   ↑  │ │
│ │ menu   tab+close   new-tab               refr float │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Observed Buttons on Tiled Panels

| Button | Icon | Action | Tooltip |
|--------|------|--------|---------|
| **Float as window** | `⊞` (panel-expand variant) | `floatPanel(id)` | "Float as window" |
| **Menu** | `≡▾` (hamburger + chevron) | Opens panel menu | Context menu |
| **Search** | `🔍` | Panel-specific search | "Search files" |
| **Refresh** | `↻` | Refresh panel content | "Refresh" |
| **New** | `+` | Panel-specific "new" action | "New..." |
| **New tab** | `+` (in tab bar) | Creates new tab in panel | "New terminal tab" |
| **Tab close** | `×` on tab | Closes specific tab | — |
| **Float** (tab bar) | `⊞` (in tab bar footer) | Float whole panel | "Float as window" |

### 3.3 Anatomy — Floating Panel

```
┌─ Floating Window ([data-floating-window]) ──────────────────┐
│ ┌─ Title Bar (draggable=true) ────────────────────────────┐ │
│ │ TITLE                              [📌] [⊟] [×]        │ │
│ │   ↑                                  ↑    ↑    ↑       │ │
│ │  label                           pin dock close        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ Content ───────────────────────────────────────────────┐ │
│ │                                                          │ │
│ │           (panel-specific content)                       │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌ Resize Handles (8 directions) ─────────────────────────┐  │
│ │ n, ne, e, se, s, sw, w, nw — cursor: ns/ew/nwse-resize│  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 Observed Buttons on Floating Panels

| Button | Icon | Action | Tooltip |
|--------|------|--------|---------|
| **Refresh** | `↻` (refresh-cw) | Refresh panel content | "Refresh" |
| **Dock to side** | `⊟` (panel-right-close) | `tilePanel(id)` — re-docks to tiled layout | "Dock to side" |
| **Copy frame** | clipboard icon | Copies panel content | "Copy frame to clipboard" |

**Note**: Floating panels do NOT have a close `×` button in the title bar.
Close is only available via right-click context menu.

### 3.4.1 Floating Panel Resize Handles (from DOM inspection)

10 children total on a floating panel:
- **Child 0**: Title bar (`draggable=true`, cursor: grab, 32px tall)
- **Child 1**: Content area (fills remaining space)
- **Child 2**: N handle (ns-resize, 8px tall, offset -3px top)
- **Child 3**: S handle (ns-resize, 8px tall, at bottom +3px)
- **Child 4**: E handle (ew-resize, 8px wide, at right +3px)
- **Child 5**: W handle (ew-resize, 8px wide, offset -3px left)
- **Child 6**: NE corner (nesw-resize, 12×12px)
- **Child 7**: NW corner (nwse-resize, 12×12px)
- **Child 8**: SE corner (nwse-resize, 12×12px)
- **Child 9**: SW corner (nesw-resize, 12×12px)

All resize handles are `position: absolute`, overlapping the panel edges.
Edge handles are inset 9px from corners, corners are 12×12px at true corners.

### 3.4.2 Floating Window CSS (exact values)

```css
[data-floating-window] {
  position: fixed;
  transition: transform 0.2s ease-out;
  z-index: 1000;  /* increments per bringToFront */
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  box-shadow: 
    rgba(0, 0, 0, 0.4) 0px 8px 32px 0px,
    rgba(0, 0, 0, 0.2) 0px 2px 8px 0px;
}
```

### 3.5 Floating Title Bar — Drag Mechanics

From decompiled source:

```javascript
// Title bar has: draggable=true, onDragStart, onDragEnd, onMouseDown, onDoubleClick, onContextMenu

onMouseDown(event) {
  if (event.target.closest('button')) return  // Don't drag from buttons
  event.stopPropagation()
  
  isDragging.current = true
  startPos.current = { x: event.clientX, y: event.clientY, panelX, panelY }
  velocityPos.current = { x: event.clientX, y: event.clientY, time: performance.now() }
  drift.current = { x: 0, y: 0, yOffset: 0 }
  
  // Activation delay: 300ms
  isActivated.current = false
  activationTimeout = setTimeout(() => {
    isActivated.current = true
  }, 300)
  
  bringToFront()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  setIsDragging(true)
  event.preventDefault()
}
```

**Key behaviors:**
- **300ms activation delay** before drag starts (prevents accidental drags)
- **Velocity tracking** (`performance.now()` timestamps)
- **Pointer capture on window** (not element-level)
- **Drag image suppression** (creates invisible div, removes after 0ms)
- **Double-click**: `onDoubleClick` handler — toggles maximize or dock-to-side
- **Context menu**: `onContextMenu` handler — opens floating panel menu

### 3.5.1 Context Menus

**Tiled Panel Context Menu** (right-click on panel header):

| Item | Icon | Action |
|------|------|--------|
| **New File** | `+` | Panel-specific creation action |
| **Close Panel** | `×` | `setPanelVisible(id, false)` |
| **Float** | `↗` | `floatPanel(id)` |
| **Split New** | `⊞` | `splitPanel(id, newId, direction)` |
| **Set Accent** | `●` → submenu | `setPanelAccent(id, color)` |

**Set Accent Submenu:**

| Option | Color | Dot Color |
|--------|-------|-----------|
| **Default** ✓ | none/theme default | — |
| **Mauve** | pink/purple | `#c4a1b1` |
| **Sage** | green | `#4ade80` |
| **Amber** | orange/warm | `#f59e0b` |
| **Rose** | red/pink | `#f43f5e` |

**Floating Panel Context Menu** (right-click on title bar):

| Item | Action |
|------|--------|
| **Close Panel** | `setPanelVisible(id, false)` |
| **Dock** | `tilePanel(id)` — re-docks to tiled layout |

Note: The floating context menu is much simpler — no "New", "Split", or "Set Accent".

### 3.6 Tiled Panel Header — Detailed DOM Anatomy

From deep DOM inspection of the Monitor panel header:

```
┌─ Header (36px, display:flex, flex-direction:row, cursor:grab) ────────┐
│                                                                        │
│  ┌─ Left Group (flex, align center) ──────────────────────────┐        │
│  │                                                             │        │
│  │  ┌─ Grip Handle ──┐  ┌─ Chevron ──┐  ┌─ Title ──────┐    │        │
│  │  │ ⠿              │  │ ▾           │  │ "Monitor"    │    │        │
│  │  │ lucide-grip-    │  │ lucide-     │  │ (uppercase   │    │        │
│  │  │ vertical        │  │ chevron-    │  │  or title    │    │        │
│  │  │ (6 circles)     │  │ down        │  │  case)       │    │        │
│  │  │ cursor: grab    │  │ 12×12px     │  │              │    │        │
│  │  │ title: "Drag    │  │             │  │              │    │        │
│  │  │  to reorder"    │  │             │  │              │    │        │
│  │  │ 15×15px         │  │             │  │              │    │        │
│  │  └─────────────────┘  └─────────────┘  └──────────────┘    │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                        │
│  ┌─ Right Group (flex, buttons) ──────────────────────────────┐        │
│  │                                                             │        │
│  │  ┌─ Btn ────────┐  ┌─ Btn ──────────┐                     │        │
│  │  │ ↻ Refresh    │  │ ⊞ Float as     │                     │        │
│  │  │ 20×20px      │  │   window       │                     │        │
│  │  │ cursor:      │  │ 20×20px        │                     │        │
│  │  │  pointer     │  │ lucide-        │                     │        │
│  │  │ lucide-      │  │  maximize2     │                     │        │
│  │  │  refresh-cw  │  │                │                     │        │
│  │  └──────────────┘  └────────────────┘                     │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Key observations:**
- The **entire header** has `cursor: grab` — it's a drag handle
- The **grip icon** (6 dots, vertical) is the drag affordance with title "Drag to reorder"
- The **chevron-down** opens the panel menu (dropdown, not context menu)
- **Button icons**: Lucide icon library (lucide-refresh-cw, lucide-maximize2, etc.)
- **Buttons are 20×20px** icon-only buttons
- **No close button** in the header — close is only in context menu

### 3.7 Tab Bar Structure (Terminal Panel)

The terminal panel has a combined header + tab bar (same 36px height):

```
┌─ Header/TabBar (36px) ─────────────────────────────────────────┐
│                                                                  │
│  ┌─ Menu ┐  ┌─ Tab ───────────┐  ┌─ New ┐          ┌─ Btns ┐  │
│  │ ≡▾    │  │ /workspace  ×   │  │  +   │          │ ⊞ ↻  │  │
│  │       │  │ (draggable tab) │  │      │          │      │  │
│  └───────┘  └─────────────────┘  └──────┘          └──────┘  │
│                                                                  │
│  Tab has: data-drag-item="ide-terminal:7-tab-XXXX-0-veq2"      │
│  Tab is draggable (HTML5 drag) between panels                   │
│  × close button on individual tabs                              │
│  + button: "New terminal tab (right-click for options)"         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Tab-bearing panels** (terminal, chat) use this combined header+tab layout.
**Content-only panels** (monitor, files, editor) use the simpler grip+title+buttons header.

### 3.8 Collapsed Sidebar — Vertical Tab

When a tiled panel is collapsed, it renders as a **vertical tab strip**:

```
┌──┐
│N │ ← Vertical text, rotated 90°
│O │
│T │
│E │
│S │
└──┘
```

**Observed**: The "NOTES" panel on the right side of IDE layout renders as a collapsed 
vertical strip (32px wide, full height). Clicking expands it. This is 
`setPanelCollapsed(id, false)`.

**CSS**: The panel becomes 32px wide with `overflow: hidden`, text is rotated via CSS 
transform (`matrix(0, 1, -1, 0, 0, 0)` = 90° clockwise rotation).

### 3.9 Icon Reference (Lucide)

All icons use the **Lucide** icon library at 12px size:

| Icon | Lucide Name | Usage |
|------|------------|-------|
| `⠿` | `grip-vertical` | Drag handle in panel header |
| `▾` | `chevron-down` | Panel dropdown menu trigger |
| `↻` | `refresh-cw` | Refresh panel content |
| `⊞` | `maximize2` | Float as window (tiled) |
| `⊟` | `panel-right-close` | Dock to side (floating) |
| `🔍` | `search` | Search within panel |
| `+` | `plus` | New item / new tab |
| `×` | `x` | Close tab |
| `⋮⋮` | (dots pattern) | Separator grip (between panels) |
| `>` | `chevron-right` | Expand collapsed sidebar |

### 3.10 Panel-Specific Header Buttons

Not all panels have the same buttons. The header right-group varies per panel type:

| Panel Type | Right-Group Buttons |
|-----------|-------------------|
| `ide-monitor` | Refresh, Float as window |
| `ide-files` | Search files, Refresh, New..., Float as window |
| `ide-editor` | Float as window |
| `ide-terminal` | (menu), (tabs), New terminal tab, Float as window |
| `soft-bot` | (menu), New conversation, Float as window, Copy frame |
| `ide-git` | Refresh, Float as window |
| `manual` | Collapse sidebar, Float as window |

The **"Float as window"** button (lucide `maximize2`) appears on **every** panel.
It's the universal escape from tiled mode.

---

## 4. Tiled Layout System

### 4.1 Panel Tree

The tiled layout is a **recursive binary split tree**:

```typescript
type PanelTree = PanelLeaf | PanelSplit

interface PanelLeaf {
  type: 'leaf'
  panelId: string
}

interface PanelSplit {
  type: 'split'
  direction: 'horizontal' | 'vertical'
  children: [PanelTree, PanelTree]
  ratio: number  // 0-1, position of the separator
}
```

### 4.2 Split Containers

From DOM analysis:

```html
<div data-split-key="ide-editor:ide-terminal" 
     style="display: flex; flex-direction: column;">
  <!-- Vertical split: editor on top, terminal on bottom -->
  <div data-panel-id="ide-editor">...</div>
  <div class="separator" style="cursor: row-resize; height: 0px;">...</div>
  <div data-panel-id="ide-terminal">...</div>
</div>

<div data-split-key="ide-editor:note" 
     style="display: flex; flex-direction: row;">
  <!-- Horizontal split: editor on left, notes on right -->
  <div data-panel-id="ide-editor">...</div>
  <div class="separator" style="cursor: col-resize; width: 4px;">...</div>
  <div data-panel-id="note">...</div>
</div>
```

### 4.3 Separators

| Type | Cursor | Size | Behavior |
|------|--------|------|----------|
| Column separator | `col-resize` | 0-4px wide, full height | Horizontal drag changes column widths |
| Row separator | `row-resize` | 0px tall, full width | Vertical drag changes row heights |

**Separator API:**
- `moveSeparator(key, delta)` — moves separator by pixel delta
- `getSeparatorPosition(key)` — returns current ratio
- `setSplitRatio(key, ratio)` — sets separator position (0-1)

### 4.4 Column System

Soft-Machine uses a **column model** for the top-level horizontal layout:

```
  Col 0   ║  Col 1                    ║  Col 2    ║  Col 3
  FILES   ║  EDITOR  |  CHAT  |  GIT  ║  MANUAL   ║  DOCS
          ║  ────────────────────────  ║           ║
          ║  TERMINAL                  ║           ║
```

- `getColumns()` → array of column descriptors
- `getColumnWidths()` → array of pixel widths
- Each column can contain nested vertical splits
- `separatorPositions` → percent positions of column separators

---

## 5. Floating Window System

### 5.1 Floating State Per Panel

```typescript
// Reconstructed from bundle analysis
interface FloatingWindowState {
  // Position & size
  floatX: number
  floatY: number
  floatWidth: number
  floatHeight: number
  
  // Origin tracking (for dock-back behavior)
  floatOriginSide: 'left' | 'right'
  
  // Z-order
  zIndex: number  // base ~1100, increments per bringToFront
  
  // Drag state
  isDragging: boolean
  
  // Resize state
  isResizing: boolean
  resizeHandles: string[]  // active handle directions
}
```

### 5.2 Position: Fixed, Not Absolute

Floating windows use `position: fixed` — they are **viewport-relative**, not 
workspace-relative. This means they:
- Stay in place during scroll
- Are NOT affected by `contain: paint` on workspace
- Overlay everything including the top bar

### 5.3 Transition

```css
transition: transform 0.2s ease-out;
```

Used for smooth settle after drag-end (position is set via `style.left`/`style.top` 
during drag, then final position is committed and transform is cleared).

### 5.4 Resize Handles

8-direction resize with cursor styles:

| Handle | Cursor |
|--------|--------|
| North | `ns-resize` |
| South | `ns-resize` |
| East | `ew-resize` |
| West | `ew-resize` |
| NE/NW/SE/SW | `nwse-resize` / `nesw-resize` |

Resize handles are rendered as absolutely-positioned divs (8px wide/tall) around 
the floating window perimeter.

### 5.5 clampAllFloatingWindows

On viewport resize, all floating windows are clamped:

```javascript
// Reconstructed
function clampAllFloatingWindows() {
  for (const [id, panel] of panels) {
    if (panel.mode !== 'floating') continue
    const x = Math.max(0, Math.min(window.innerWidth - panel.floatWidth, panel.floatX))
    const y = Math.max(0, Math.min(window.innerHeight - panel.floatHeight, panel.floatY))
    setPanelFloatPosition(id, x, y)
  }
}
```

### 5.6 Dedicated Floats

Some panels have a "dedicated float" mode — they always float and can't be tiled:

```typescript
openDedicatedFloat(panelId, position)
closeDedicatedFloat(panelId)
setDedicatedFloatPosition(panelId, x, y)
setDedicatedFloatSize(panelId, width, height)
getOpenDedicatedFloats()
bringDedicatedFloatToFront(panelId)
```

---

## 6. Drag & Drop System

### 6.1 Dual Drag Implementation

Soft-Machine uses **TWO drag systems simultaneously**:

1. **HTML5 Drag API** (`draggable=true`, `onDragStart`, `onDragEnd`) — for **tab** dragging between panels
2. **Pointer Events** (`pointermove`, `pointerup` on `window`) — for **panel** position dragging

### 6.2 Panel Drag (Pointer Events)

```
mousedown on title bar
  ↓
300ms activation delay (prevents accidental drags)
  ↓
pointermove → update style.left/style.top directly on DOM element
  ↓
velocity tracking (clientX/Y + performance.now())
  ↓
pointerup → commit final position to state
  ↓
Clear inline styles, transition kicks in for settle
```

**Key: Direct DOM manipulation during drag** — no React re-renders. Position is written 
directly to `element.style.left` and `element.style.top`. Only on drag-end is React 
state updated.

### 6.3 Panel Resize (Pointer Events)

Similar to drag but with width/height:

```
pointerdown on resize handle
  ↓
Track which edges are being dragged (e.g., ["s", "e"] for SE corner)
  ↓
pointermove → update style.left/top/width/height directly
  ↓
Minimum size constraints enforced
  ↓
pointerup → commit to state
```

### 6.4 Tab Drag (HTML5 Drag API)

Tabs between panels use native drag:
- `dataTransfer.setData("text/plain", tabId)` 
- Custom drag image (styled div, removed after 0ms)
- `effectAllowed = "move"`
- Drop zones on other panel tab bars

### 6.5 Coalesced Events

The codebase checks for `getCoalescedEvents()`:

```javascript
if (pointerEvent.getCoalescedEvents) {
  const events = pointerEvent.getCoalescedEvents()
  // Use last coalesced event for smooth tracking
}
```

This provides sub-frame precision on supporting browsers.

---

## 7. Edge Docking / Drop Zones

### 7.1 Drop Zone Types

When dragging a panel, these drop zones activate:

| Zone | Data Attribute | Visual | Action on Drop |
|------|---------------|--------|----------------|
| **Base spacer** | `data-base-spacer` | Highlighted empty area | Dock to base layout |
| **Left inner edge** | `data-inner-edge-dropzone="left-inner"` | Left edge highlight | Insert as left tiled panel |
| **Right inner edge** | `data-inner-edge-dropzone="right-inner"` | Right edge highlight | Insert as right tiled panel |
| **Panel target** | `data-panel-id` (hit test) | Panel highlight | Split with target panel |

### 7.2 Hit Testing: `elementsFromPoint`

During drag, hit testing uses `document.elementsFromPoint(x, y)`:

```javascript
function detectDropZone(x, y, draggingPanelId) {
  const elements = document.elementsFromPoint(x, y)
  
  // Priority 1: Inner edge dropzones
  for (const el of elements) {
    const dropzone = el.closest('[data-inner-edge-dropzone]')
    if (dropzone) return { type: 'inner-edge', edge: dropzone.dataset.innerEdgeDropzone }
  }
  
  // Priority 2: Base spacer
  for (const el of elements) {
    if (el.closest('[data-base-spacer]')) return { type: 'base-spacer' }
  }
  
  // Priority 3: Panel overlap
  const panels = document.querySelectorAll('[data-panel-id]')
  const hits = []
  for (const panel of panels) {
    const rect = panel.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right) {
      hits.push({
        id: panel.dataset.panelId,
        rect,
        containsX: true,
        containsY: y >= rect.top && y <= rect.bottom,
        containsBoth: (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
      })
    }
  }
  
  // Exact hit
  for (const hit of hits) {
    if (hit.containsBoth) {
      if (hit.id === draggingPanelId) return { type: 'self' }
      return { type: 'panel', targetId: hit.id }
    }
  }
  
  // Nearest by Y distance (for column alignment)
  if (hits.length > 0) {
    hits.sort((a, b) => distanceToRect(y, a.rect) - distanceToRect(y, b.rect))
    return { type: 'panel', targetId: hits[0].id }
  }
  
  return null
}
```

### 7.3 Edge Highlight Rendering

Inner edge dropzones are DOM elements that appear during drag:

```jsx
{isDragging && (
  <>
    <InnerEdgeDropzone
      data-inner-edge-dropzone="left-inner"
      $side="left"
      $isActive={dragOverInnerEdge === 'left-inner'}
      onDragOver={e => setDragOverInnerEdge('left-inner')}
      onDragLeave={clearInnerEdge}
      onDrop={e => dockToInnerEdge(panelId, 'left-inner')}
    />
    <InnerEdgeDropzone
      data-inner-edge-dropzone="right-inner"
      $side="right"
      $isActive={dragOverInnerEdge === 'right-inner'}
      onDragOver={e => setDragOverInnerEdge('right-inner')}
      onDragLeave={clearInnerEdge}
      onDrop={e => dockToInnerEdge(panelId, 'right-inner')}
    />
  </>
)}
```

### 7.4 Dock Actions

| Action | Function | Result |
|--------|----------|--------|
| Dock to left/right edge | `dockToEdge(panelId)` | Panel becomes tiled at outer edge |
| Dock to inner edge | `dockToInnerEdge(panelId, edge)` | Panel splits into existing column |
| Split with panel | `splitPanel(targetId, panelId, direction)` | Creates new split in tree |
| Replace panel | `replacePanelInLayout(oldId, newId)` | Swaps panel in split tree |
| Remove from layout | `removePanelFromLayout(panelId)` | Panel exits tiled layout |

---

## 8. Stashing System

### 8.1 Stash to Edges

Floating windows can be "stashed" to the viewport edges — minimized to a thin strip:

```typescript
stashFloatsToEdges()   // Minimize all floats to edge strips
unstashFloats()        // Restore all floats to their positions
areFloatsStashed       // boolean — current stash state
isStashAnimating       // boolean — transition in progress
```

### 8.2 Stash Behavior

- Panels slide to their `floatOriginSide` (left or right)
- They become thin vertical strips at the edge
- Click to un-stash (restore to full size)
- Separate from `isCollapsed` (which is for tiled panels)

### 8.3 Implementation Detail

From the bundle, there's a constant for stash dimensions:

```javascript
const COLLAPSED_WIDTH = 40  // dL/2 = cL/2 = 40/2 = 20? or cL = 40
const STASH_HALF = COLLAPSED_WIDTH / 2  // 20px
```

Stash offset calculation:

```javascript
function calculateStashOffset(panel, isCollapsed, side, viewportWidth) {
  if (isCollapsed) {
    return side === 'left' 
      ? STASH_HALF - panel.x 
      : viewportWidth - STASH_HALF - panel.x
  }
  return side === 'left' ? -panel.width : panel.width
}
```

---

## 9. Panel State Machine

### 9.1 Panel Lifecycle

```
                  floatPanel()
    ┌──────────┐ ────────────→ ┌──────────────┐
    │  TILED   │               │  FLOATING    │
    │          │ ←──────────── │              │
    └──────────┘  tilePanel()  └──────────────┘
         ↕                           ↕
    collapse/                   stash/
    expand                      unstash
         ↕                           ↕
    ┌──────────┐               ┌──────────────┐
    │ COLLAPSED│               │  STASHED     │
    │ (32px)   │               │  (edge strip)│
    └──────────┘               └──────────────┘
```

### 9.2 Panel State Fields

```typescript
// Reconstructed from all observable mutations
interface PanelState {
  id: string
  panelTypeId: string          // Component type (e.g., 'ide-terminal', 'soft-bot')
  mode: 'tiled' | 'floating' | 'canvas'
  isVisible: boolean
  isCollapsed: boolean         // Tiled: minimum width with vertical label
  order: number                // Tab order / z-order
  width: number                // Tiled width (separator-controlled)
  
  // Floating-specific
  floatX: number
  floatY: number
  floatWidth: number
  floatHeight: number
  floatOriginSide: 'left' | 'right'
  
  // Accent color
  accent?: string
  
  // Header visibility
  headerHidden?: boolean
  
  // Zoom level (for canvas panels)
  zoom?: number
}
```

### 9.3 Focus Management

```typescript
activePanelId: string | null        // Currently focused panel
focusDirection: string | null       // Direction of last focus move
setFocusedPanel(id)                 // Set active panel
movePanelInDirection(direction)     // Move focus to adjacent panel
findAdjacentPanel(id, direction)    // Find neighbor panel
```

---

## 10. Visual Design Tokens

### 10.1 Color Palette (observed from screenshots)

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0d0d0d` – `#111111` | Workspace base, dark void |
| Surface | `#1a1a1a` – `#1e1e1e` | Panel backgrounds |
| Surface raised | `#222222` – `#262626` | Headers, tab bars |
| Border | `#2a2a2a` – `#333333` | Panel borders, separators |
| Text primary | `#e0e0e0` – `#f0f0f0` | Headings, labels |
| Text secondary | `#888888` – `#999999` | Descriptions, muted text |
| Accent (pink/mauve) | `#c4a1b1` – `#d4b1c1` | Buttons, links, interactive |
| Accent hover | `#e0c0d0` | Hover states |
| Green dot | `#4ade80` | Process status indicators |
| Blue (info) | `#60a5fa` | Links, informational |

### 10.2 Typography

| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Top bar title | 14px | 500 | System/Inter |
| Panel header | 12-13px | 600 | System/Inter |
| Body text | 13-14px | 400 | System/Inter |
| Code/terminal | 13px | 400 | Monospace |
| Tab label | 12-13px | 400 | System/Inter |
| Button label | 12px | 500 | System/Inter |

### 10.3 Spacing

| Element | Value |
|---------|-------|
| Top bar height | ~40px |
| Panel header height | ~32-36px |
| Tab bar height | ~32px |
| Separator width | 0-4px (expands on hover) |
| Floating padding | 0px (flush content) |
| Button size | ~24px (icon buttons) |
| Border radius | 0px (panels), 4-6px (buttons), 8px (dialogs) |

### 10.4 Shadows

```css
/* Floating windows — subtle elevation */
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);

/* Dialogs — more prominent */  
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
```

---

## 11. Keyboard Navigation

### 11.1 Observed Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open command palette |
| `⌘N` | New file |
| `⌘,` | Open settings |
| `⌘A` | Select all in active panel |
| `⌘E` (Ctrl+Shift+E) | Toggle edit/view mode |
| Arrow keys (with modifier) | Move focus between panels |

### 11.2 Focus Direction

```typescript
movePanelInDirection('left' | 'right' | 'up' | 'down')
findAdjacentPanel(currentId, direction)
```

Panel adjacency is computed from the panel tree structure.

---

## 12. Complete API Surface

### 12.1 Panel CRUD

| Function | Signature | Description |
|----------|-----------|-------------|
| `createPanelInstance` | `(typeId) → panelId` | Create new panel of given type |
| `setPanelMode` | `(id, mode)` | Change tiled/floating/canvas |
| `setPanelVisible` | `(id, visible)` | Show/hide panel |
| `setPanelCollapsed` | `(id, collapsed)` | Collapse tiled panel to vertical strip |
| `togglePanelCollapsed` | `(id)` | Toggle collapsed state |
| `setPanelAccent` | `(id, color)` | Set panel accent color |
| `setPanelWidth` | `(id, width)` | Set tiled panel width |
| `setPanelOrder` | `(id, order)` | Change panel order |
| `movePanelToIndex` | `(id, index)` | Move panel to specific position |
| `getPanelState` | `(id) → PanelState` | Get current state |
| `toggleAllPanelHeaders` | `()` | Toggle header visibility on all panels |
| `togglePanelHeaderHidden` | `(id)` | Toggle header on one panel |
| `areAllPanelHeadersHidden` | `→ boolean` | Query header state |

### 12.2 Mode Transitions

| Function | From | To | Description |
|----------|------|----|-------------|
| `floatPanel` | tiled | floating | Float at default position |
| `floatPanelWithPosition` | tiled | floating | Float at specific x, y, w, h |
| `tilePanel` | floating | tiled | Re-dock to layout |
| `dockToEdge` | floating | tiled | Dock to outer layout edge |
| `dockToInnerEdge` | floating | tiled | Dock between existing panels |
| `splitPanel` | — | — | Split target panel, insert dragged panel |
| `addPanelAtRoot` | — | tiled | Add panel at root level of tree |
| `removePanelFromLayout` | tiled | — | Remove from split tree |
| `replacePanelInLayout` | — | — | Swap one panel for another |
| `swapWithBase` | — | — | Swap panel with base canvas |

### 12.3 Floating Window Operations

| Function | Description |
|----------|-------------|
| `setPanelFloatPosition` | `(id, x, y)` — update position |
| `setPanelFloatSize` | `(id, w, h)` — update dimensions |
| `bringFloatToFront` | `(id)` — bring to top z-index |
| `clampAllFloatingWindows` | Clamp all to viewport bounds |
| `stashFloatsToEdges` | Minimize all to edge strips |
| `unstashFloats` | Restore all from stash |

### 12.4 Dedicated Floats (Always-Float Panels)

| Function | Description |
|----------|-------------|
| `openDedicatedFloat` | Open a pinned floating panel |
| `closeDedicatedFloat` | Close it |
| `setDedicatedFloatPosition` | Move it |
| `setDedicatedFloatSize` | Resize it |
| `getOpenDedicatedFloats` | List all open dedicated floats |
| `bringDedicatedFloatToFront` | Z-order management |

### 12.5 Drag Operations

| Function | Description |
|----------|-------------|
| `startDrag` | `(panelId)` — begin drag operation |
| `endDrag` | End current drag |
| `setDragOver` | `(panelId)` — mark panel as drag target |
| `setDragOverEdge` | `(edge)` — mark outer edge as target |
| `setDragOverInnerEdge` | `(edge)` — mark inner edge as target |
| `setDragOverBase` | `(isOver)` — mark base spacer as target |
| `setDragOverDropZone` | `(zone)` — generic drop zone tracking |
| `setDragOverTargetPanel` | `(panelId)` — panel being dropped on |

### 12.6 Layout Queries

| Function | Returns | Description |
|----------|---------|-------------|
| `getTiledPanels` | `PanelState[]` | All tiled panels |
| `getFloatingPanels` | `PanelState[]` | All floating panels |
| `getCanvasPanels` | `PanelState[]` | All canvas panels |
| `isCanvasPanel` | `(id) → boolean` | Check panel mode |
| `getPanelSide` | `(id) → 'left' \| 'right'` | Which side of workspace |
| `isPanelOutermost` | `(id) → boolean` | Is panel at outer edge |
| `getPanelOuterEdgeX` | `(id) → number` | X position of outer edge |
| `getNextPanelTowardCenter` | `(id) → PanelState` | Adjacent panel inward |
| `getNextPanelTowardEdge` | `(id) → PanelState` | Adjacent panel outward |
| `getInnermostPanelOnSide` | `(side) → PanelState` | Innermost on L/R |

### 12.7 Layout Tree Operations

| Function | Description |
|----------|-------------|
| `panelTree` | Current split tree state |
| `setPanelTree` | Replace entire tree |
| `splitPanel` | `(targetId, insertId, direction)` |
| `setSplitRatio` | `(splitKey, ratio)` |
| `separatorPositions` | Current separator ratios |
| `moveSeparator` | `(key, delta)` |
| `getSeparatorPosition` | `(key) → ratio` |
| `getColumnWidths` | `→ number[]` |
| `getColumns` | `→ Column[]` |

### 12.8 Layout Modes

| Function | Description |
|----------|-------------|
| `layoutMode` | `'flow' \| 'split' \| ...` |
| `setLayoutMode` | Change layout mode |
| `isViewMode` | Read-only view mode flag |
| `resizeMode` | Current resize mode |
| `flowViewportOffset` | Canvas viewport offset |
| `setFlowViewportOffset` | Set canvas offset |

### 12.9 Scratchpad

| Function | Description |
|----------|-------------|
| `scratchpadPanel` | `(id)` — Send panel to scratchpad |
| `unscratchpadPanel` | `(id)` — Restore from scratchpad |
| `toggleScratchpadVisibility` | Toggle scratchpad overlay |

---

## 13. DOM Structure Reference

### 13.1 Full DOM Tree (Observed)

```html
<body>
  <div id="root">
    <!-- Top Bar -->
    <header>
      <button>Title ▾</button>
      <input placeholder="Search ⌘K" />
      <button>History</button>
      <button>Fork</button>
      <button>Publish</button>
    </header>
    
    <!-- Search/Command Palette overlay -->
    <div data-search-bar>...</div>
    
    <!-- Onboarding overlay -->
    <main data-onboarding="canvas">
      
      <!-- Base Layer (tiled panels) -->
      <div data-base-layer>
        
        <!-- Column 0: Monitor + Files -->
        <div data-panel-id="monitor">
          <div class="header">MONITOR [icons]</div>
          <div class="content">...</div>
        </div>
        
        <!-- Separator (col-resize) -->
        <div style="cursor: col-resize; width: 0px; height: 680px;" />
        
        <!-- Split: Editor + Terminal (vertical) -->
        <div data-split-key="ide-editor:ide-terminal" style="flex-direction: column;">
          
          <!-- Split: Editor + Notes (horizontal) -->
          <div data-split-key="ide-editor:note" style="flex-direction: row;">
            <div data-panel-id="ide-editor">...</div>
            <div style="cursor: col-resize;" />
            <div data-panel-id="note">...</div>
          </div>
          
          <!-- Separator (row-resize) -->
          <div style="cursor: row-resize;" />
          
          <div data-panel-id="ide-terminal">
            <div class="tab-bar">
              <div data-drag-item="terminal-tab-xxx">...</div>
            </div>
          </div>
        </div>
        
        <!-- Separator -->
        <div style="cursor: col-resize;" />
        
        <!-- Column N: Soft-Bot -->
        <div data-panel-id="soft-bot">...</div>
      </div>
      
      <!-- Floating Windows -->
      <div data-floating-window style="position: fixed; z-index: 1108;">
        <div draggable="true" class="title-bar">
          <span>Manual</span>
          <div class="buttons">
            <button title="Dock to side">⊟</button>
            <button>×</button>
          </div>
        </div>
        <div class="content">...</div>
        <!-- 8 resize handles -->
        <div style="cursor: ns-resize; height: 8px;" />  <!-- N -->
        <div style="cursor: ns-resize; height: 8px;" />  <!-- S -->
        <div style="cursor: ew-resize; width: 8px;" />   <!-- E -->
        <div style="cursor: ew-resize; width: 8px;" />   <!-- W -->
        <!-- corners implied -->
      </div>
      
    </main>
  </div>
</body>
```

### 13.2 Panel ID Format

Observed panel IDs:
- `ide-files:1` — File explorer (instance 1)
- `ide-editor` — Code editor
- `ide-terminal` — Terminal emulator
- `note` — Notes panel
- `soft-bot` — AI assistant
- `monitor` — System monitor (CPU/MEM/Disk)
- `manual` — Documentation viewer
- `stats`, `dynamics`, `causal` — Engine-specific panels
- `rules` — Rule editor
- `panel-selector` — Panel picker

Format: `{typeId}` or `{typeId}:{instance}` for multiple instances.

---

## 14. Migration Map: SM → TMNL

### 14.1 Concept Mapping

| Soft-Machine | TMNL Current | Migration Action |
|-------------|-------------|-----------------|
| Panel modes (tiled/floating/canvas) | Only floating | **Add tiled mode** — split tree layout |
| Panel tree (recursive splits) | None | **Implement split tree** |
| Separators (drag to resize) | None (ResizeHandles on floating) | **Add separator components** |
| `floatPanel()` / `tilePanel()` | `registerPanel()` | **Add mode transitions** |
| `dockToEdge()` | `resolveDockLayout()` (half dock) | **Evolve dock to tiled** |
| `elementsFromPoint` hit testing | dnd-kit collision detection | **Replace/augment** |
| `data-inner-edge-dropzone` | `DragGuideOverlay` | **Add edge zone overlays** |
| `stashFloatsToEdges()` | `minimizePanel()` (collapsed strips) | **Evolve strips → stash** |
| Collapsed vertical strip (tiled) | None | **Add collapsed panel mode** |
| Dedicated floats | None | **Add pinned float concept** |
| `300ms activationDelay` | None (instant drag) | **Add activation delay** |
| `transition: transform 0.2s ease-out` | `transition: none` | **Consider adding settle** |
| `clampAllFloatingWindows()` | `restrictToWorkspace` modifier | **Add viewport resize handler** |
| `bringFloatToFront()` | `bringPanelToFront()` | ✅ Already have |
| Column system | None | **Add column model** |
| `elementsFromPoint` | dnd-kit sensors | **Hybrid approach** |
| `position: fixed` | `position: absolute` (workspace-relative) | **Decision: keep contain:paint** |
| Panel tree persistence | No persistence | **Add save/restore** |
| Scratchpad | None | **Future: add scratchpad** |

### 14.2 Priority Order

1. **P0 — Tiled layout with split tree** (fundamental architecture change)
2. **P0 — Separators** (resize between tiled panels)
3. **P0 — Float ↔ Tile transitions** (`floatPanel` / `tilePanel`)
4. **P1 — Edge dock drop zones** (inner-edge-dropzone pattern)
5. **P1 — Collapsed vertical strip** (tiled panel minimization)
6. **P1 — 300ms activation delay** (drag quality)
7. **P2 — Column model** (top-level horizontal layout)
8. **P2 — Panel tree persistence** (save/restore layouts)
9. **P2 — Stash system** (minimize all floats)
10. **P3 — Canvas mode** (engine integration)
11. **P3 — Dedicated floats** (always-float panels)
12. **P3 — Scratchpad** (temporary workspace)

### 14.3 Key Architectural Decisions Needed

1. **`position: fixed` vs `position: absolute` for floats**
   - SM uses `fixed` (viewport-relative)
   - TMNL uses `absolute` inside `contain: paint` workspace
   - **Recommendation**: Keep `contain: paint` + absolute — workspace-relative is better for embedded apps

2. **State management for panel tree**
   - SM uses React useState + context
   - TMNL uses Legend-State stx
   - **Recommendation**: Add `panelTree` observable to stx

3. **Drag implementation**
   - SM uses raw pointer events
   - TMNL uses dnd-kit
   - **Recommendation**: Keep dnd-kit for sensors/modifiers, add elementsFromPoint for drop zone detection

4. **Snap vs. dock**
   - SM has no "snap to grid" — it has dock-to-layout
   - TMNL has magnetic/proximity snap
   - **Recommendation**: Keep proximity snap for floating panels, add dock zones for tile transitions

---

## Appendix A: Bundle Forensics

### A.1 Key Variable Mappings (Minified → Semantic)

| Minified | Semantic | Context |
|----------|----------|---------|
| `Cr()` | `usePanelContext()` | Main panel context hook |
| `cL` | `COLLAPSED_WIDTH` | 40px |
| `dL` | `COLLAPSED_HALF` | 20px |
| `ys` | `DRAG_CONFIG` | `{ activationDelay: 300 }` |
| `uL` | `detectDropZone` | elementsFromPoint hit testing |
| `IY` | `InnerEdgeDropzone` | Styled edge zone component |
| `wxe` | `FloatingWindowContainer` | Styled floating panel wrapper |
| `zn` | `setDragOverEdge` | Set edge as current drop target |
| `sn` | `setDragOverInnerEdge` | Set inner edge as drop target |
| `Fn` | `dockToEdge` | Execute edge dock |
| `Un` | `dockToInnerEdge` | Execute inner edge dock |
| `mn` | `startDrag` | Begin drag tracking |
| `Yn` | `endDrag` | End drag tracking |
| `Kn` | `setDragOver` | Set panel as drag target |
| `rs` | `clampAllFloatingWindows` | Viewport resize handler |
| `ae` / `Vn` | `stashFloatsToEdges` | Minimize all floats |
| `ue` / `Tn` | `unstashFloats` | Restore all floats |
| `ki` | `DRAG_OFFSET` | Offset applied during drag |

### A.2 Styled Components Classes

| Class Pattern | Component |
|--------------|-----------|
| `sc-kYBQft` | Panel container (`[data-panel-id]`) |
| `sc-cnbGaE` | Floating window wrapper (`[data-floating-window]`) |
| `sc-APXT` | Title bar (draggable) |
| `sc-cWkkHA` | Split container (column, `[data-split-key]`) |
| `sc-eMbPqv` | Split container (row) |
| `sc-cbBIzu` | Column separator (`col-resize`) |
| `sc-kUmEBm` | Row separator (`row-resize`) |
| `sc-fWdIst` | Resize handle (floating, `ns/ew-resize`) |
| `sc-jeDoxa` | Inner separator (between inner panels) |

---

*Last updated: 2026-02-21*
*Research method: agent-browser DOM inspection + JS bundle decompilation*
