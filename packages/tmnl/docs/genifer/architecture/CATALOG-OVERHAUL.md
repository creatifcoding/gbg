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
