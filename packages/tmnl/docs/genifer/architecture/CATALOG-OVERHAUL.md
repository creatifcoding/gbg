# Genifer Catalog Overhaul — Core Domain Architecture

## Problem

The current catalog is a flat blob. `CatalogService` merges every domain into one `generatePrompt()` dump — the LLM sees *everything* regardless of what it's generating. No compound composition. No variants. Sparse component set (16 components in ui-domain-catalog). No scoping at generation time.

## Architecture: Domain-Scoped, Tiered, Compound

### Tiers

| Tier | Always in prompt? | Components |
|------|:-:|---|
| **core** | ✅ | Layout (Grid, VStack, HStack, Flex, Box, etc.) + Typography (Text, Heading, Code) + Separator |
| **primitives** | ✅ | Button, Badge, Avatar, Image, Icon, Link, Skeleton, Spinner |
| **domain** | Per-request | Forms, Cards, Data, Feedback, Navigation, Media, Interactive |
| **specialized** | Discovery only | Geoint, RVN, Charts, FoldablePanel, SemanticRegion |

### Scoped Prompt Generation

```typescript
// NEW: genifer_generate gains a `domains` parameter
catalog.scopedPrompt(['forms', 'cards'])
// → core + primitives + forms + cards only

catalog.scopedPrompt([])
// → core + primitives only (lightweight generation)

catalog.scopedPrompt(['*'])
// → everything (legacy behavior)
```

### Compound Component Pattern

Components that have logical sub-parts use the compound pattern. The LLM generates them as parent+children in the tree — the catalog documents the relationship.

```
Card (compound root)
├── Card.Header
│   ├── Card.Title
│   └── Card.Description
├── Card.Media
├── Card.Content
└── Card.Footer
```

In the genifer tree, this becomes:
```json
{
  "root": "card-1",
  "elements": {
    "card-1":   { "type": "Card",            "children": ["hdr", "body", "ftr"] },
    "hdr":      { "type": "CardHeader",      "children": ["title", "desc"] },
    "title":    { "type": "CardTitle",       "props": { "text": "Dashboard" } },
    "desc":     { "type": "CardDescription", "props": { "text": "Overview" } },
    "body":     { "type": "CardContent",     "children": ["..."] },
    "ftr":      { "type": "CardFooter",      "children": ["btn"] },
    "btn":      { "type": "Button",          "props": { "label": "Save" } }
  }
}
```

---

## Component Inventory — Core Domain

### 1. Typography (`core` tier — always available)

| Component | Variants | Props | Compound | Children |
|-----------|----------|-------|:--------:|:--------:|
| **Text** | `body`, `caption`, `overline`, `label`, `small`, `lead`, `muted`, `code` | `text`, `variant`, `as` (p/span/div), `className` | — | — |
| **Heading** | levels 1–6, weights | `text`, `level` (1–6), `tracking` (tight/normal/wide), `className` | — | — |
| **Code** | `inline`, `block` | `text`, `variant`, `language?`, `className` | — | — |
| **Blockquote** | — | `text`, `cite?`, `className` | — | ✅ |
| **List** | `ordered`, `unordered`, `description` | `variant`, `className` | ✅ | ✅ |
| **ListItem** | — | `text?`, `className` | — | ✅ |
| **Separator** | `horizontal`, `vertical` | `orientation?`, `className` | — | — |

### 2. Primitives (`primitives` tier — always available)

| Component | Variants | Props | Compound | Children |
|-----------|----------|-------|:--------:|:--------:|
| **Button** | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` | `label`, `variant`, `size` (sm/md/lg/icon), `disabled?`, `loading?`, `action?`, `className` | — | — |
| **IconButton** | same as Button | `icon` (name), `variant`, `size`, `label` (aria), `className` | — | — |
| **ButtonGroup** | — | `orientation?` (row/column), `className` | — | ✅ |
| **Badge** | `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `info` | `text`, `variant`, `dot?` (show dot indicator), `className` | — | — |
| **Avatar** | `image`, `initials`, `icon` | `src?`, `alt?`, `initials?`, `icon?`, `size` (xs/sm/md/lg/xl), `className` | — | — |
| **Image** | — | `src`, `alt`, `width?`, `height?`, `aspect?` (square/video/portrait), `fallback?`, `className` | — | — |
| **Icon** | — | `name`, `size?` (sm/md/lg), `className` | — | — |
| **Link** | `default`, `muted`, `underline` | `href`, `text`, `variant?`, `external?`, `className` | — | — |
| **Skeleton** | `text`, `circle`, `rect` | `variant?`, `width?`, `height?`, `className` | — | — |
| **Spinner** | `default`, `dots`, `ring` | `variant?`, `size?` (sm/md/lg), `label?`, `className` | — | — |
| **Box** | — | `as?` (div/section/article/aside/main/nav), `className` **(required)** | — | ✅ |
| **ScrollArea** | — | `maxHeight?`, `className` | — | ✅ |

### 3. Cards Domain (`cards` — request-scoped)

| Component | Variants | Props | Compound | Children |
|-----------|----------|-------|:--------:|:--------:|
| **Card** | — | `className` | ✅ root | ✅ |
| **CardHeader** | — | `className` | sub | ✅ |
| **CardTitle** | — | `text`, `className` | sub | — |
| **CardDescription** | — | `text`, `className` | sub | — |
| **CardContent** | — | `className` | sub | ✅ |
| **CardFooter** | — | `className` | sub | ✅ |
| **CardMedia** | — | `src`, `alt`, `aspect?`, `className` | sub | — |
| **InfoCard** | `stat`, `status`, `metric` | `title`, `value`, `description?`, `variant`, `icon?`, `trend?` (up/down/flat), `trendValue?`, `className` | — | — |
| **MetricCard** | — | `label`, `value`, `unit?`, `delta?`, `deltaType?` (positive/negative/neutral), `sparkline?` (number[]), `className` | — | — |

### 4. Forms Domain (`forms` — request-scoped)

| Component | Variants | Props | Compound | Children |
|-----------|----------|-------|:--------:|:--------:|
| **Form** | — | `className` | ✅ root | ✅ |
| **FormField** | — | `name`, `className` | ✅ sub | ✅ |
| **FormLabel** | — | `text`, `required?`, `className` | sub | — |
| **FormDescription** | — | `text`, `className` | sub | — |
| **FormMessage** | `error`, `success`, `info` | `text`, `variant?`, `className` | sub | — |
| **Input** | `text`, `email`, `password`, `number`, `tel`, `url`, `search` | `type?`, `placeholder?`, `value?`, `disabled?`, `className` | — | — |
| **Textarea** | — | `placeholder?`, `rows?`, `value?`, `disabled?`, `resize?` (none/vertical/both), `className` | — | — |
| **Select** | — | `placeholder?`, `options` ({value, label}[]), `value?`, `disabled?`, `className` | — | — |
| **Checkbox** | — | `label?`, `checked?`, `disabled?`, `className` | — | — |
| **RadioGroup** | — | `orientation?` (vertical/horizontal), `value?`, `className` | ✅ | ✅ |
| **RadioItem** | — | `value`, `label`, `disabled?`, `className` | sub | — |
| **Switch** | — | `label?`, `checked?`, `disabled?`, `className` | — | — |
| **Slider** | — | `min?`, `max?`, `step?`, `value?`, `label?`, `className` | — | — |
| **FileInput** | `single`, `multiple` | `accept?`, `multiple?`, `label?`, `description?`, `className` | — | — |
| **DateInput** | — | `value?`, `placeholder?`, `min?`, `max?`, `className` | — | — |
| **ComboBox** | — | `placeholder?`, `options` ({value, label}[]), `value?`, `searchable?`, `className` | — | — |

### 5. Data Display Domain (`data` — request-scoped)

| Component | Variants | Props | Compound | Children |
|-----------|----------|-------|:--------:|:--------:|
| **Table** | — | `className` | ✅ root | ✅ |
| **TableHeader** | — | `className` | sub | ✅ |
| **TableBody** | — | `className` | sub | ✅ |
| **TableRow** | — | `className` | sub | ✅ |
| **TableHead** | — | `text`, `className` | sub | — |
| **TableCell** | — | `text?`, `className` | sub | ✅ |
| **DataTable** | — | `columns` ({field, header, width?}[]), `data` (unknown[]), `searchable?`, `sortable?`, `pageSize?`, `className` | — | — |
| **KeyValue** | `inline`, `stacked` | `label`, `value`, `variant?`, `className` | — | — |
| **Stat** | — | `label`, `value`, `helpText?`, `className` | — | — |
| **StatGroup** | — | `columns?` (2/3/4), `className` | — | ✅ |
| **Timeline** | — | `className` | ✅ root | ✅ |
| **TimelineItem** | `default`, `success`, `error`, `warning` | `title`, `description?`, `timestamp?`, `variant?`, `className` | sub | — |
| **EmptyState** | — | `title`, `description?`, `icon?`, `actionLabel?`, `className` | — | — |
| **Tooltip** | — | `content`, `side?` (top/right/bottom/left), `className` | — | ✅ |
| **Progress** | `bar`, `ring`, `steps` | `value` (0–100), `variant?`, `size?`, `label?`, `showValue?`, `className` | — | — |

### 6. Feedback Domain (`feedback` — request-scoped)

| Component | Variants | Props | Compound | Children |
|-----------|----------|-------|:--------:|:--------:|
| **Alert** | `default`, `destructive`, `success`, `warning`, `info` | `variant`, `title?`, `description?`, `icon?`, `dismissible?`, `className` | — | ✅ |
| **Callout** | `info`, `warning`, `tip`, `danger`, `note` | `variant`, `title?`, `className` | — | ✅ |
| **Banner** | `info`, `success`, `warning`, `error` | `variant`, `text`, `dismissible?`, `action?`, `className` | — | — |
| **Toast** | `default`, `success`, `error`, `warning` | `title`, `description?`, `variant?`, `action?`, `duration?` | — | — |
| **Dialog** | — | `className` | ✅ root | ✅ |
| **DialogHeader** | — | `className` | sub | ✅ |
| **DialogTitle** | — | `text`, `className` | sub | — |
| **DialogDescription** | — | `text`, `className` | sub | — |
| **DialogContent** | — | `className` | sub | ✅ |
| **DialogFooter** | — | `className` | sub | ✅ |
| **Sheet** | `left`, `right`, `top`, `bottom` | `side?`, `className` | ✅ root | ✅ |
| **SheetHeader** | — | `className` | sub | ✅ |
| **SheetContent** | — | `className` | sub | ✅ |

### 7. Navigation Domain (`navigation` — request-scoped)

| Component | Variants | Props | Compound | Children |
|-----------|----------|-------|:--------:|:--------:|
| **Tabs** | `default`, `underline`, `pills` | `variant?`, `defaultValue?`, `className` | ✅ root | ✅ |
| **TabsList** | — | `className` | sub | ✅ |
| **TabsTrigger** | — | `value`, `label`, `icon?`, `disabled?`, `className` | sub | — |
| **TabsContent** | — | `value`, `className` | sub | ✅ |
| **Breadcrumb** | — | `items` ({label, href?}[]), `separator?`, `className` | — | — |
| **Pagination** | — | `total`, `current`, `pageSize?`, `className` | — | — |
| **NavGroup** | — | `label?`, `className` | — | ✅ |
| **NavItem** | `default`, `active`, `disabled` | `label`, `href?`, `icon?`, `variant?`, `className` | — | — |
| **Accordion** | `single`, `multiple` | `type?`, `collapsible?`, `className` | ✅ root | ✅ |
| **AccordionItem** | — | `value`, `className` | sub | ✅ |
| **AccordionTrigger** | — | `text`, `className` | sub | — |
| **AccordionContent** | — | `className` | sub | ✅ |
| **Collapsible** | — | `defaultOpen?`, `className` | ✅ root | ✅ |
| **CollapsibleTrigger** | — | `text`, `className` | sub | — |
| **CollapsibleContent** | — | `className` | sub | ✅ |

### 8. Media Domain (`media` — request-scoped)

| Component | Variants | Props | Compound | Children |
|-----------|----------|-------|:--------:|:--------:|
| **Video** | — | `src`, `poster?`, `autoplay?`, `controls?`, `loop?`, `muted?`, `aspect?`, `className` | — | — |
| **Audio** | — | `src`, `title?`, `controls?`, `className` | — | — |
| **FilePreview** | `image`, `pdf`, `code`, `generic` | `filename`, `size?`, `type?`, `url?`, `className` | — | — |
| **Embed** | — | `src`, `title?`, `aspect?`, `sandbox?`, `className` | — | — |
| **Gallery** | `grid`, `masonry`, `carousel` | `variant?`, `columns?`, `gap?`, `className` | — | ✅ |

### 9. Interactive Domain (`interactive` — request-scoped)

| Component | Variants | Props | Compound | Children |
|-----------|----------|-------|:--------:|:--------:|
| **InlineTerminal** | — | `lines` (string[]), `title?`, `maxHeight?`, `copyable?`, `className` | — | — |
| **CodeBlock** | — | `code`, `language?`, `title?`, `lineNumbers?`, `highlightLines?` (number[]), `copyable?`, `className` | — | — |
| **CopyButton** | — | `text`, `label?`, `className` | — | — |
| **ToggleButton** | — | `label`, `pressed?`, `variant?`, `className` | — | — |
| **Popover** | — | `className` | ✅ root | ✅ |
| **PopoverTrigger** | — | `className` | sub | ✅ |
| **PopoverContent** | — | `side?`, `align?`, `className` | sub | ✅ |
| **DropdownMenu** | — | `className` | ✅ root | ✅ |
| **DropdownTrigger** | — | `className` | sub | ✅ |
| **DropdownContent** | — | `align?`, `className` | sub | ✅ |
| **DropdownItem** | `default`, `destructive` | `label`, `icon?`, `shortcut?`, `variant?`, `disabled?`, `className` | sub | — |
| **DropdownSeparator** | — | `className` | sub | — |

---

## Component Count

| Tier | Domain | Count |
|------|--------|:-----:|
| core | Typography + Separator | 7 |
| primitives | Buttons, Badge, Avatar, Image, etc. | 12 |
| domain | Cards | 9 |
| domain | Forms | 16 |
| domain | Data Display | 16 |
| domain | Feedback | 12 |
| domain | Navigation | 14 |
| domain | Media | 5 |
| domain | Interactive | 12 |
| **Total** | | **103** |

Up from 16. Over 6× expansion.

---

## Compound Component Relationships

The catalog must document which sub-components belong to which root, so the LLM generates valid trees:

```
Card         → CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardMedia
Form         → FormField, FormLabel, FormDescription, FormMessage
Table        → TableHeader, TableBody, TableRow, TableHead, TableCell
Dialog       → DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter
Sheet        → SheetHeader, SheetContent
Tabs         → TabsList, TabsTrigger, TabsContent
Accordion    → AccordionItem, AccordionTrigger, AccordionContent
Collapsible  → CollapsibleTrigger, CollapsibleContent
Popover      → PopoverTrigger, PopoverContent
DropdownMenu → DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator
Timeline     → TimelineItem
RadioGroup   → RadioItem
List         → ListItem
```

---

## Scoped Prompt Architecture

### New `scopedPrompt(domains: string[])` on CatalogService

```typescript
interface CatalogComponents {
  // ... existing ...

  /** Generate prompt for only the specified domains */
  scopedPrompt(domains: string[]): string

  /** List all available domain names */
  availableDomains(): string[]

  /** Get domain tier */
  domainTier(name: string): 'core' | 'primitives' | 'domain' | 'specialized'
}
```

### Prompt Structure

```
# Available Components (scoped: forms, cards)

## Core (always available)
[Typography + Layout + Separator]

## Primitives (always available)
[Button, Badge, Avatar, Image, Icon, Link, Skeleton, Spinner, Box, ScrollArea]

## Cards
[Card compound: Card → CardHeader → CardTitle, ...]
[InfoCard, MetricCard]

## Forms
[Form compound: Form → FormField → FormLabel, ...]
[Input, Textarea, Select, ...]

## Compound Relationships
Card: [CardHeader, CardTitle, ...]
Form: [FormField, FormLabel, ...]
```

### genifer_generate TypeBox Params Update

```typescript
const GeniferGenerateParams = Type.Object({
  prompt: Type.String({ ... }),
  domains: Type.Optional(Type.Array(Type.String(), {
    description: 'Component domains to include: cards, forms, data, feedback, navigation, media, interactive. Omit for core+primitives only.'
  })),
  // ... existing params
})
```

---

---

## Action Abstractions — Wiring Primitives Together

The missing layer. Currently, each element has its own `actions` array — but there's no way for siblings to *share* an action flow. "Search bar against OpenSky" means the Input, the Button, AND the DataTable all participate in the same query lifecycle. They need to share context.

### ActionGroup — Compound Action Scope

Inspired by `@effect/cluster`'s `Entity.make(type, protocol)` pattern: an Entity is a *named group of operations* with a shared protocol. Children don't know how operations are implemented — they just reference them by tag.

ActionGroup is the same pattern for UI: a *named group of actions + state* that scopes a subtree. Not a "provider" — it's a *group*. Siblings inside an ActionGroup share state and actions without prop drilling. The group IS the scope.

```
Entity.make("Counter", [Rpc.make("Increment", { ... })])
  ↕ analogy
ActionGroup: { name: "flight-search", actions: { search: {...}, clear: {...} }, state: { query, results } }
```

Children reference `@action:search` the same way an EntityProxy references `Counter.Increment` — by tag, not by implementation. The ActionGroup resolves it.

```json
{
  "root": "search-scope",
  "elements": {
    "search-scope": {
      "type": "ActionGroup",
      "props": {
        "actions": {
          "search": {
            "type": "callRpc",
            "target": "opensky/search",
            "debounceMs": 300
          },
          "clear": {
            "type": "setState",
            "target": "query",
            "payload": ""
          }
        },
        "state": {
          "query": "",
          "results": []
        }
      },
      "children": ["bar", "results"]
    },
    "bar": {
      "type": "SearchBar",
      "props": {
        "placeholder": "Search OpenSky flights...",
        "onSearch": "@action:search",
        "onClear": "@action:clear",
        "bind:value": "@state:query"
      }
    },
    "results": {
      "type": "DataTable",
      "props": {
        "bind:data": "@state:results",
        "columns": [
          { "field": "callsign", "header": "Callsign" },
          { "field": "origin", "header": "Origin" },
          { "field": "altitude", "header": "Alt (m)" }
        ],
        "searchable": true,
        "sortable": true
      }
    }
  }
}
```

Key patterns:
- `@action:name` — references a shared action defined in ancestor ActionGroup
- `@state:field` — references shared state in ancestor ActionGroup
- `bind:propName` — reactive binding (prop updates when state changes)
- Actions flow UP (child triggers) → state updates → bindings flow DOWN (siblings re-render)

### Pre-Wired Utility Compounds

Components that encapsulate common action patterns so the LLM doesn't need to wire everything manually:

| Component | What it does | Internal wiring |
|-----------|-------------|-----------------|
| **SearchBar** | Input + Button + clear, debounced | `onSearch` fires on Enter/click, `onClear` resets, `bind:value` for controlled |
| **FilterBar** | Multiple filter controls + apply/reset | `onFilter` emits filter object, `bind:filters` for controlled state |
| **SortControl** | Sort field + direction toggle | `onSort` emits {field, direction}, integrates with DataTable |
| **DataBound** | Wrapper that auto-resolves a DataSource for children | Children get `data` prop from atom/query/rpc binding |
| **RefreshControl** | Refresh button + auto-refresh toggle + interval | `onRefresh` re-triggers parent data source, shows last-updated |
| **Paginator** | Page controls wired to DataTable | `bind:page`, `bind:total`, `onPageChange` |

### Leaf Action Sharing — The Entity Analogy

Like `EntityProxy.toRpcGroup(Counter)` gives any client typed access to `Counter.Increment` by tag — any leaf inside an ActionGroup can reference `@action:search` by tag. The ActionGroup resolves it to the actual callRpc/setState/emitEvent implementation.

Leaves don't know *how* the action works. They just know the tag. This is the mechanism that makes "give me a search bar against OpenSky" a single prompt:

```
ActionGroup "flight-search" (protocol: search, clear, refresh)
├── HStack
│   ├── SearchBar (uses: @action:search, @action:clear)
│   ├── RefreshControl (uses: @action:refresh)
│   └── Badge (bind:text → "@state:results.length" + " flights")
├── DataTable (bind:data → @state:results)
└── Paginator (bind:page, bind:total)
```

The LLM generates this tree. At render time, the SurfaceProvider walks up the tree to find the nearest ActionGroup ancestor and resolves:
- `@action:search` → `{ type: "callRpc", target: "opensky/flights", ... }`
- `@state:results` → ActionGroup's internal state atom
- `bind:data` → reactive subscription to that atom

Same pattern as Entity: named group → typed protocol → children consume by tag.

---

## Style & Appearance Utilities

### Components

| Component | Props | Purpose |
|-----------|-------|---------|
| **ColorDot** | `color` (hex/named/css-var), `size?`, `label?` | Color indicator |
| **ColorPalette** | `colors` (string[]), `selected?`, `onSelect?` | Color picker grid |
| **ThemeToggle** | `mode?` (light/dark/system) | Dark mode toggle |
| **Kbd** | `keys` (string[]) | Keyboard shortcut badge: `⌘K` |
| **Highlight** | `text`, `query`, `className` | Highlighted search match |
| **Truncate** | `text`, `lines?` (1/2/3), `expandable?` | Text clamping with expand |
| **ResizeHandle** | `direction?` (horizontal/vertical/both) | Drag resize handle |
| **DragHandle** | — | Drag reorder grip icon |
| **Indicator** | `status` (online/offline/busy/away), `size?` | Presence/status dot |

### Style Props on All Components

Already have `className` universal. Adding:

| Prop | Type | Purpose |
|------|------|---------|
| `className` | string | Tailwind utility classes (existing) |
| `style` | Record<string, string> | Inline CSS escape hatch (rare) |
| `data-*` | string | Custom data attributes for testing/targeting |

---

## Full Radix Coverage

Mapping every `src/components/ui/` file to a catalog component:

| UI File | Catalog Component | Domain | Status |
|---------|-------------------|--------|--------|
| accordion.tsx | Accordion compound | navigation | ✅ in doc |
| alert-dialog.tsx | AlertDialog compound | feedback | **NEW** |
| alert.tsx | Alert | feedback | ✅ in doc |
| aspect-ratio.tsx | AspectRatio | core/layout | existing layout catalog |
| avatar.tsx | Avatar | primitives | ✅ in doc |
| badge.tsx | Badge | primitives | ✅ in doc |
| breadcrumb.tsx | Breadcrumb | navigation | ✅ in doc |
| button-group.tsx | ButtonGroup | primitives | ✅ in doc |
| button.tsx | Button | primitives | ✅ in doc |
| calendar.tsx | Calendar | forms | **NEW** |
| card.tsx | Card compound | cards | ✅ in doc |
| carousel.tsx | Carousel compound | media | **NEW** |
| chart.tsx | Chart | specialized | existing charts catalog |
| checkbox.tsx | Checkbox | forms | ✅ in doc |
| collapsible.tsx | Collapsible compound | navigation | ✅ in doc |
| command.tsx | CommandPalette | interactive | **NEW** |
| context-menu.tsx | ContextMenu compound | interactive | **NEW** |
| dialog.tsx | Dialog compound | feedback | ✅ in doc |
| drawer.tsx | Drawer compound | feedback | **NEW** |
| dropdown-menu.tsx | DropdownMenu compound | interactive | ✅ in doc |
| empty.tsx | EmptyState | data | ✅ in doc |
| field.tsx | FormField | forms | ✅ in doc |
| form.tsx | Form | forms | ✅ in doc |
| hover-card.tsx | HoverCard compound | interactive | **NEW** |
| input-group.tsx | InputGroup | forms | **NEW** |
| input-otp.tsx | OTPInput | forms | **NEW** |
| input.tsx | Input | forms | ✅ in doc |
| kbd.tsx | Kbd | style | **NEW** |
| label.tsx | Label/FormLabel | forms | ✅ in doc |
| menubar.tsx | Menubar compound | navigation | **NEW** |
| navigation-menu.tsx | NavigationMenu compound | navigation | **NEW** |
| pagination.tsx | Pagination | navigation | ✅ in doc |
| popover.tsx | Popover compound | interactive | ✅ in doc |
| progress.tsx | Progress | data | ✅ in doc |
| radio-group.tsx | RadioGroup/RadioItem | forms | ✅ in doc |
| resizable.tsx | ResizablePanel | interactive | **NEW** |
| scroll-area.tsx | ScrollArea | primitives | ✅ in doc |
| select.tsx | Select | forms | ✅ in doc |
| separator.tsx | Separator | core | ✅ in doc |
| sheet.tsx | Sheet compound | feedback | ✅ in doc |
| skeleton.tsx | Skeleton | primitives | ✅ in doc |
| slider.tsx | Slider | forms | ✅ in doc |
| sonner.tsx | Toast (sonner) | feedback | ✅ in doc |
| spinner.tsx | Spinner | primitives | ✅ in doc |
| switch.tsx | Switch | forms | ✅ in doc |
| table.tsx | Table compound | data | ✅ in doc |
| tabs.tsx | Tabs compound | navigation | ✅ in doc |
| textarea.tsx | Textarea | forms | ✅ in doc |
| tmnl-fader.tsx | Fader | interactive/DAW | **NEW** |
| tmnl-knob.tsx | Knob | interactive/DAW | **NEW** |
| tmnl-slider.tsx | TmnlSlider | interactive/DAW | **NEW** |
| toggle-group.tsx | ToggleGroup | interactive | **NEW** |
| toggle.tsx | Toggle | interactive | ✅ in doc |
| tooltip.tsx | Tooltip | data | ✅ in doc |

### NEW Components from Radix coverage

| Component | Domain | Props | Compound |
|-----------|--------|-------|:--------:|
| **AlertDialog** | feedback | `className` | ✅ root → AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogContent, AlertDialogFooter, AlertDialogAction, AlertDialogCancel |
| **Calendar** | forms | `selected?`, `onSelect?`, `mode?` (single/range), `className` | — |
| **Carousel** | media | `orientation?`, `autoplay?`, `interval?`, `className` | ✅ root → CarouselItem |
| **CommandPalette** | interactive | `placeholder?`, `className` | ✅ root → CommandInput, CommandList, CommandGroup, CommandItem, CommandSeparator |
| **ContextMenu** | interactive | `className` | ✅ root → ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator |
| **Drawer** | feedback | `side?`, `className` | ✅ root → DrawerHeader, DrawerContent, DrawerFooter |
| **HoverCard** | interactive | `className` | ✅ root → HoverCardTrigger, HoverCardContent |
| **InputGroup** | forms | `className` | — → wraps Input with prefix/suffix slots |
| **OTPInput** | forms | `length?` (4/6), `className` | — |
| **Menubar** | navigation | `className` | ✅ root → MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem |
| **NavigationMenu** | navigation | `className` | ✅ root → NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent |
| **ResizablePanel** | interactive | `direction?`, `className` | ✅ root → ResizablePane, ResizableHandle |
| **ToggleGroup** | interactive | `type?` (single/multiple), `variant?`, `className` | — → ✅ children |
| **Fader** | interactive | `value?`, `min?`, `max?`, `orientation?`, `className` | — |
| **Knob** | interactive | `value?`, `min?`, `max?`, `sensitivity?`, `className` | — |

---

## Updated Component Count

| Tier | Domain | Count |
|------|--------|:-----:|
| core | Typography + Separator | 7 |
| primitives | Buttons, Badge, Avatar, Image, etc. | 12 |
| domain | Cards | 9 |
| domain | Forms | 20 |
| domain | Data Display | 16 |
| domain | Feedback | 18 |
| domain | Navigation | 22 |
| domain | Media | 7 |
| domain | Interactive | 22 |
| domain | Style Utilities | 9 |
| wiring | Action abstractions | 7 |
| **Total** | | **149** |

---

## The "Search Bar Against OpenSky" Test

Prompt: *"Give me a search bar against OpenSky"*

Expected output tree:
```
ActionGroup (state: {query, results, loading}, actions: {search → callRpc opensky/flights})
├── HStack gap=8 align=center
│   ├── SearchBar (placeholder="Search flights...", bind:value=@state:query, onSearch=@action:search)
│   ├── Spinner (bind:visible=@state:loading, size=sm)
│   └── Badge (bind:text=@state:results.length + " flights", variant=secondary)
├── DataTable (bind:data=@state:results, columns=[callsign, origin, destination, altitude, velocity], searchable, sortable)
└── Text (text="Data from OpenSky Network API", variant=muted)
```

One prompt. Full wiring. Live data. Searchable grid. No custom code.

## Migration Path

1. **New file**: `src/lib/genifer/catalog/core-domain-catalog.tsx` — the 103 components
2. **New type**: `DomainTier = 'core' | 'primitives' | 'domain' | 'specialized'` on DomainCatalog
3. **New method**: `scopedPrompt(domains)` on CatalogService
4. **Update**: `genifer_generate` TypeBox params with `domains` field
5. **Existing catalogs**: geoint, rvn become `specialized` tier
6. **Old ui-domain-catalog**: replaced by core-domain-catalog
7. **Backward compatible**: `generatePrompt()` still works (returns everything)

---

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Compound components as flat elements with documented relationships | Genifer tree is flat by design — compounds are parent→children references, not nested React components |
| D2 | Variants as string literal union, not separate components | `Button variant="destructive"` not `DestructiveButton` — reduces component count, LLM already understands variants |
| D3 | className on everything, no exceptions | Universal Tailwind escape hatch per AGENTS.md |
| D4 | Core+primitives always in prompt | Typography and basic elements are needed for every generation |
| D5 | Domain catalogs are request-scoped | Focused prompt → better LLM output, fewer hallucinated types |
| D6 | Discovery via CatalogQuery tool for specialized | Geoint/RVN/Charts discovered mid-generation, not polluting base prompt |
| D7 | DataTable bridges to DataManager | Hydrated, searchable — not a dumb table |
| D8 | InlineTerminal for command output | LLM can generate terminal-style output blocks |
| D9 | InfoCard/MetricCard are standalone | Not compounds — self-contained reactive cards with trends |
| D10 | 103 components across 9 domains | Comprehensive coverage, competitive with major component libraries |
