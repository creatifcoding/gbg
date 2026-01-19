'use client'

/**
 * @fileoverview UI Domain Catalog for CatalogComponents Service
 *
 * TMNL UI components: Card, Button, Badge, Text, Heading, Input, Alert, etc.
 * Each component has schema + renderer + defaultEntrance (mandatory).
 *
 * @module json-render/catalog/ui-domain-catalog
 */

import { Schema } from "effect"
import type { DomainCatalog, ComponentRenderProps } from "@/lib/json-render/core/CatalogService"
import type { EntranceAnimation } from "@/lib/json-render/core/animation-schema"

// TMNL UI Components
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Action } from "@/lib/json-render/core/schemas"
import { FoldablePanel, type PanelTag } from "@/lib/foldable-panel"
import { SemanticRegion, type SemanticRegionType } from "@/lib/json-render/core/components"

// =============================================================================
// Prop Schemas
// =============================================================================

const TextPropsSchema = Schema.Struct({
  text: Schema.String,
  className: Schema.optional(Schema.String),
})

const HeadingPropsSchema = Schema.Struct({
  text: Schema.String,
  level: Schema.optional(Schema.Number),
  className: Schema.optional(Schema.String),
})

const ButtonPropsSchema = Schema.Struct({
  label: Schema.String,
  variant: Schema.optional(Schema.Literal("default", "destructive", "outline", "secondary", "ghost", "link")),
  size: Schema.optional(Schema.Literal("default", "sm", "lg", "icon")),
  action: Schema.optional(Schema.Unknown), // Action schema is complex, using Unknown for flexibility
  className: Schema.optional(Schema.String),
})

const CardPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

const CardHeaderPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

const CardTitlePropsSchema = Schema.Struct({
  text: Schema.String,
  className: Schema.optional(Schema.String),
})

const CardDescriptionPropsSchema = Schema.Struct({
  text: Schema.String,
  className: Schema.optional(Schema.String),
})

const CardContentPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

const CardFooterPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

const InputPropsSchema = Schema.Struct({
  label: Schema.optional(Schema.String),
  placeholder: Schema.optional(Schema.String),
  type: Schema.optional(Schema.Literal("text", "email", "password", "number", "tel", "url")),
  value: Schema.optional(Schema.String),
  className: Schema.optional(Schema.String),
  wrapperClassName: Schema.optional(Schema.String),
})

const SwitchPropsSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  label: Schema.optional(Schema.String),
  wrapperClassName: Schema.optional(Schema.String),
})

const BadgePropsSchema = Schema.Struct({
  text: Schema.String,
  variant: Schema.optional(Schema.Literal("default", "secondary", "destructive", "outline")),
  className: Schema.optional(Schema.String),
})

const ProgressPropsSchema = Schema.Struct({
  value: Schema.optional(Schema.Number),
  className: Schema.optional(Schema.String),
})

const AlertPropsSchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  variant: Schema.optional(Schema.Literal("default", "destructive")),
  className: Schema.optional(Schema.String),
})

const SeparatorPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

const FoldablePanelPropsSchema = Schema.Struct({
  panelId: Schema.String,
  tag: Schema.optional(Schema.Literal('map', '3d', 'data-grid', 'chart', 'embed', 'media', 'custom')),
  label: Schema.optional(Schema.String),
  expandedHeight: Schema.optional(Schema.Number),
  collapsedHeight: Schema.optional(Schema.Number),
  initialFoldState: Schema.optional(Schema.Literal('expanded', 'collapsed')),
  showDragHandle: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

/**
 * SemanticRegion props schema
 *
 * CRITICAL: This is the foundational component for agent-addressable UI regions.
 * The Evolution agent uses get_semantic_map to discover these regions and target
 * them for transformation via transform_region.
 */
const SemanticRegionPropsSchema = Schema.Struct({
  /** REQUIRED: Unique region ID for agent targeting. Must be stable across renders. */
  'data-semantic-id': Schema.String,
  /** REQUIRED: Human-readable label describing this region's purpose. */
  'data-semantic-label': Schema.String,
  /** Region type for categorization and agent decision-making. */
  'data-semantic-type': Schema.optional(Schema.Literal(
    'chart',       // Analytical visualizations (Line, Bar, Pie, etc.)
    'form',        // User input areas (forms, filters, settings)
    'list',        // Lists, feeds, scrollable content
    'card',        // Card containers, tiles
    'navigation',  // Nav bars, menus, breadcrumbs
    'content',     // Static content, text blocks, documentation
    'interactive', // Interactive widgets, embedded apps
    'header',      // Page/section headers
    'footer',      // Page/section footers
    'sidebar',     // Side navigation, auxiliary content
    'main'         // Main content area
  )),
  /** ARIA role override (defaults to 'region'). */
  role: Schema.optional(Schema.String),
  /** ARIA label override (defaults to data-semantic-label). */
  'aria-label': Schema.optional(Schema.String),
  /** Additional className for styling. */
  className: Schema.optional(Schema.String),
})

// =============================================================================
// Renderers
// =============================================================================

function TextRenderer({ element }: ComponentRenderProps) {
  return (
    <p className={element.props['className'] as string ?? "text-sm text-muted-foreground"}>
      {element.props['text'] as string}
    </p>
  )
}

function HeadingRenderer({ element }: ComponentRenderProps) {
  const level = (element.props['level'] as number) ?? 2
  const text = element.props['text'] as string
  const className = element.props['className'] as string

  switch (level) {
    case 1: return <h1 className={className ?? "text-3xl font-bold"}>{text}</h1>
    case 2: return <h2 className={className ?? "text-2xl font-semibold"}>{text}</h2>
    case 3: return <h3 className={className ?? "text-xl font-medium"}>{text}</h3>
    default: return <h4 className={className ?? "text-lg font-medium"}>{text}</h4>
  }
}

function ButtonRenderer({ element, onAction }: ComponentRenderProps) {
  return (
    <Button
      variant={(element.props['variant'] as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link") ?? "default"}
      size={(element.props['size'] as "default" | "sm" | "lg" | "icon") ?? "default"}
      className={element.props['className'] as string}
      onClick={() => {
        if (element.props['action'] && onAction) {
          onAction(element.props['action'] as Action)
        }
      }}
    >
      {element.props['label'] as string}
    </Button>
  )
}

function CardRenderer({ element, children }: ComponentRenderProps) {
  return (
    <Card className={element.props['className'] as string}>
      {children}
    </Card>
  )
}

function CardHeaderRenderer({ element, children }: ComponentRenderProps) {
  return (
    <CardHeader className={element.props['className'] as string}>
      {children}
    </CardHeader>
  )
}

function CardTitleRenderer({ element }: ComponentRenderProps) {
  return (
    <CardTitle className={element.props['className'] as string}>
      {element.props['text'] as string}
    </CardTitle>
  )
}

function CardDescriptionRenderer({ element }: ComponentRenderProps) {
  return (
    <CardDescription className={element.props['className'] as string}>
      {element.props['text'] as string}
    </CardDescription>
  )
}

function CardContentRenderer({ element, children }: ComponentRenderProps) {
  return (
    <CardContent className={element.props['className'] as string}>
      {children}
    </CardContent>
  )
}

function CardFooterRenderer({ element, children }: ComponentRenderProps) {
  return (
    <CardFooter className={element.props['className'] as string}>
      {children}
    </CardFooter>
  )
}

function InputRenderer({ element }: ComponentRenderProps) {
  return (
    <div className={element.props['wrapperClassName'] as string ?? "space-y-2"}>
      {element.props['label'] && (
        <Label>{element.props['label'] as string}</Label>
      )}
      <Input
        type={(element.props['type'] as string) ?? "text"}
        placeholder={element.props['placeholder'] as string}
        defaultValue={element.props['value'] as string}
        className={element.props['className'] as string}
      />
    </div>
  )
}

function SwitchRenderer({ element }: ComponentRenderProps) {
  return (
    <div className={element.props['wrapperClassName'] as string ?? "flex items-center space-x-2"}>
      <Switch id={element.props['id'] as string} />
      {element.props['label'] && (
        <Label htmlFor={element.props['id'] as string}>{element.props['label'] as string}</Label>
      )}
    </div>
  )
}

function BadgeRenderer({ element }: ComponentRenderProps) {
  return (
    <Badge
      variant={(element.props['variant'] as "default" | "secondary" | "destructive" | "outline") ?? "default"}
      className={element.props['className'] as string}
    >
      {element.props['text'] as string}
    </Badge>
  )
}

function ProgressRenderer({ element }: ComponentRenderProps) {
  return (
    <Progress
      value={element.props['value'] as number ?? 0}
      className={element.props['className'] as string}
    />
  )
}

function AlertRenderer({ element, children }: ComponentRenderProps) {
  const title = element.props['title'] as string | undefined
  const description = element.props['description'] as string | undefined

  return (
    <Alert
      variant={(element.props['variant'] as "default" | "destructive") ?? "default"}
      className={element.props['className'] as string}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {description && <AlertDescription>{description}</AlertDescription>}
      {children}
    </Alert>
  )
}

function SeparatorRenderer({ element }: ComponentRenderProps) {
  return <Separator className={element.props['className'] as string} />
}

function FoldablePanelRenderer({ element, children }: ComponentRenderProps) {
  const tag = (element.props['tag'] as PanelTag) ?? 'custom'
  const label = (element.props['label'] as string) ?? tag

  return (
    <FoldablePanel
      panelId={element.props['panelId'] as string ?? element.key}
      badge={{ tag, label }}
      expandedHeight={(element.props['expandedHeight'] as number) ?? 320}
      collapsedHeight={(element.props['collapsedHeight'] as number) ?? 48}
      initialFoldState={(element.props['initialFoldState'] as 'expanded' | 'collapsed') ?? 'expanded'}
      showDragHandle={(element.props['showDragHandle'] as boolean) ?? false}
      isEditable={false}
    >
      {children}
    </FoldablePanel>
  )
}

/**
 * SemanticRegion renderer
 *
 * Renders an agent-addressable region wrapper. The semantic data attributes
 * are used by the Evolution agent's get_semantic_map tool to discover
 * targetable regions in the UI tree.
 */
function SemanticRegionRenderer({ element, children }: ComponentRenderProps) {
  return (
    <SemanticRegion
      data-semantic-id={element.props['data-semantic-id'] as string}
      data-semantic-label={element.props['data-semantic-label'] as string}
      data-semantic-type={element.props['data-semantic-type'] as SemanticRegionType | undefined}
      role={element.props['role'] as string | undefined}
      aria-label={element.props['aria-label'] as string | undefined}
      className={element.props['className'] as string | undefined}
    >
      {children}
    </SemanticRegion>
  )
}

// =============================================================================
// Default Entrance Animations
// =============================================================================

/**
 * Default animations for UI components.
 * Every component MUST have an animation - this is mandatory.
 */
const defaultAnimations = {
  /** Text/typography - subtle fade */
  text: {
    property: 'opacity',
    easing: 'out-quad',
    duration: 'fast',
  } satisfies EntranceAnimation,

  /** Interactive elements (buttons, inputs) - snappy entrance */
  interactive: {
    property: 'opacity+scale',
    easing: 'out-quart',
    duration: 'fast',
  } satisfies EntranceAnimation,

  /** Cards/containers - lift from below */
  card: {
    property: 'opacity+translateY',
    easing: 'out-cubic',
    duration: 'normal',
  } satisfies EntranceAnimation,

  /** Feedback elements (alerts, badges) - attention-grabbing */
  feedback: {
    property: 'opacity+scale',
    easing: 'out-back',
    duration: 'normal',
  } satisfies EntranceAnimation,

  /** Decorative (separators) - fast and subtle */
  decorative: {
    property: 'opacity',
    easing: 'out-quad',
    duration: 'fast',
  } satisfies EntranceAnimation,

  /** Interactive panels (foldable, collapsible) - smooth entrance */
  panel: {
    property: 'opacity+translateY',
    easing: 'out-quart',
    duration: 'normal',
  } satisfies EntranceAnimation,
}

// =============================================================================
// Domain Catalog Export
// =============================================================================

/**
 * UI Domain Catalog
 *
 * TMNL UI components with:
 * - Schemas for AI prompt generation and validation
 * - Renderers for React rendering
 * - Descriptions for AI context
 * - Default entrance animations (MANDATORY)
 */
export const uiDomainCatalog: DomainCatalog = {
  name: "TMNL UI",
  components: {
    // Typography
    Text: {
      schema: TextPropsSchema,
      renderer: TextRenderer,
      description: "Paragraph text with optional styling. Use for body content.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.text,
    },
    Heading: {
      schema: HeadingPropsSchema,
      renderer: HeadingRenderer,
      description: "Heading text. Level 1-4 maps to h1-h4. Default level 2.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.text,
    },

    // Interactive
    Button: {
      schema: ButtonPropsSchema,
      renderer: ButtonRenderer,
      description: "Clickable button. Supports variants: default, destructive, outline, secondary, ghost, link. Can trigger actions.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.interactive,
    },
    Input: {
      schema: InputPropsSchema,
      renderer: InputRenderer,
      description: "Text input field with optional label. Supports types: text, email, password, number, tel, url.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.interactive,
    },
    Switch: {
      schema: SwitchPropsSchema,
      renderer: SwitchRenderer,
      description: "Toggle switch with optional label. Good for boolean settings.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.interactive,
    },

    // Card components
    Card: {
      schema: CardPropsSchema,
      renderer: CardRenderer,
      description: "Container card with shadow. Use with CardHeader, CardContent, CardFooter children.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.card,
    },
    CardHeader: {
      schema: CardHeaderPropsSchema,
      renderer: CardHeaderRenderer,
      description: "Card header section. Contains CardTitle and CardDescription.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.text,
    },
    CardTitle: {
      schema: CardTitlePropsSchema,
      renderer: CardTitleRenderer,
      description: "Card title text.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.text,
    },
    CardDescription: {
      schema: CardDescriptionPropsSchema,
      renderer: CardDescriptionRenderer,
      description: "Card description/subtitle text.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.text,
    },
    CardContent: {
      schema: CardContentPropsSchema,
      renderer: CardContentRenderer,
      description: "Card body content area.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.text,
    },
    CardFooter: {
      schema: CardFooterPropsSchema,
      renderer: CardFooterRenderer,
      description: "Card footer section. Good for action buttons.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.text,
    },

    // Feedback
    Badge: {
      schema: BadgePropsSchema,
      renderer: BadgeRenderer,
      description: "Small status badge. Variants: default, secondary, destructive, outline.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.feedback,
    },
    Alert: {
      schema: AlertPropsSchema,
      renderer: AlertRenderer,
      description: "Alert box for messages. Variants: default, destructive. Has title and description.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.feedback,
    },
    Progress: {
      schema: ProgressPropsSchema,
      renderer: ProgressRenderer,
      description: "Progress bar. Value 0-100.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.feedback,
    },

    // Decorative
    Separator: {
      schema: SeparatorPropsSchema,
      renderer: SeparatorRenderer,
      description: "Horizontal line separator.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.decorative,
    },

    // Interactive Panels
    FoldablePanel: {
      schema: FoldablePanelPropsSchema,
      renderer: FoldablePanelRenderer,
      description: "Collapsible panel wrapper for interactive content. Use to wrap charts, maps, 3D views, data grids, or any interactive visualization. Tags: 'map' (cyan), '3d' (purple), 'data-grid' (orange), 'chart' (emerald), 'embed' (blue), 'media' (rose), 'custom' (slate). Provides collapse/expand, badge header, and resize handle. REQUIRED for interactive visualizations in interactives mode.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.panel,
    },

    // ==========================================================================
    // SEMANTIC BOUNDARIES (Agent Targeting Infrastructure)
    // ==========================================================================
    SemanticRegion: {
      schema: SemanticRegionPropsSchema,
      renderer: SemanticRegionRenderer,
      description: `CRITICAL INFRASTRUCTURE: Agent-addressable region wrapper for Evolution agent targeting.

## PURPOSE
SemanticRegion wraps logical UI sections to enable:
1. Agent discovery via get_semantic_map tool
2. Targeted transformation via transform_region tool
3. Structured UI evolution without full-tree regeneration

## DECISION FLOW: When to Use SemanticRegion

    User Request
         │
         ▼
    ┌────────────────────────────────────────┐
    │ Does the UI have distinct functional   │
    │ areas that could be modified           │
    │ independently?                         │
    └────────────────────────────────────────┘
         │
    YES  │  NO
         │   └──► Don't wrap (simple atomic UI)
         ▼
    ┌────────────────────────────────────────┐
    │ Could a user ask to "change the X"     │
    │ where X is a specific section?         │
    └────────────────────────────────────────┘
         │
    YES  │  NO
         │   └──► Don't wrap (tightly coupled)
         ▼
    WRAP IN SemanticRegion with appropriate type

## REGION TYPES & USAGE

| Type         | Use When                                    | Example Requests                           |
|--------------|---------------------------------------------|-------------------------------------------|
| chart        | Analytical visualizations                   | "change the chart", "update metrics"       |
| form         | User input areas                            | "add a field", "modify the filters"        |
| list         | Scrollable collections                      | "show more items", "change the feed"       |
| card         | Card containers, tiles                      | "update the card", "change tile layout"    |
| navigation   | Nav bars, menus, breadcrumbs                | "add a nav item", "reorganize menu"        |
| content      | Static text, documentation                  | "update the description", "change text"    |
| interactive  | Embedded widgets, tools                     | "replace the widget", "change tool"        |
| header       | Page/section headers                        | "update the title", "change header"        |
| footer       | Page/section footers                        | "modify footer", "update links"            |
| sidebar      | Side navigation, auxiliary                  | "change sidebar", "update side panel"      |
| main         | Primary content area                        | "redesign main area", "update content"     |

## WRAPPING PATTERNS

### Pattern 1: Dashboard with Multiple Regions
┌─────────────────────────────────────────────────────────────┐
│ VStack (root)                                               │
│ ├── SemanticRegion[header] ──► Heading, Badge              │
│ ├── HStack                                                  │
│ │   ├── SemanticRegion[chart] ──► Line chart               │
│ │   └── SemanticRegion[chart] ──► Bar chart                │
│ └── SemanticRegion[list] ──► Activity feed                 │
└─────────────────────────────────────────────────────────────┘

### Pattern 2: Form with Sections
┌─────────────────────────────────────────────────────────────┐
│ Card (root)                                                 │
│ ├── SemanticRegion[form, id="user-info"]                   │
│ │   └── Inputs for name, email                             │
│ ├── SemanticRegion[form, id="preferences"]                 │
│ │   └── Switches, selects                                  │
│ └── SemanticRegion[interactive, id="actions"]              │
│     └── Submit, Cancel buttons                             │
└─────────────────────────────────────────────────────────────┘

### Pattern 3: Content Page
┌─────────────────────────────────────────────────────────────┐
│ VStack (root)                                               │
│ ├── SemanticRegion[header] ──► Page title, breadcrumbs     │
│ ├── SemanticRegion[navigation] ──► Tab bar                 │
│ ├── SemanticRegion[main] ──► Primary content               │
│ └── SemanticRegion[footer] ──► Related links               │
└─────────────────────────────────────────────────────────────┘

## ABSTRACT REQUEST HANDLING

When user makes vague requests, use SemanticRegion types to infer intent:

| Abstract Request          | Likely Target Region(s)    | Agent Action                    |
|--------------------------|----------------------------|--------------------------------|
| "make it better"         | main                       | Enhance primary content         |
| "add more info"          | content, main              | Expand information density      |
| "make it interactive"    | chart → interactive        | Add interactivity features      |
| "simplify this"          | ALL regions                | Reduce complexity per region    |
| "update the look"        | header, card, main         | Restyle visual elements         |
| "add filtering"          | list → form + list         | Add form region, connect data   |
| "show trends"            | content → chart            | Replace with visualization      |

## REQUIRED PROPS

- data-semantic-id: MUST be unique, stable, descriptive (e.g., "sales-chart", "user-form")
- data-semantic-label: Human-readable description for agent context
- data-semantic-type: Enables type-based targeting and decision-making

## EXAMPLE JSONL OUTPUT

{"op":"add","path":"/elements/chartRegion","value":{"key":"chartRegion","type":"SemanticRegion","props":{"data-semantic-id":"revenue-trends","data-semantic-label":"Revenue Trends Chart","data-semantic-type":"chart"},"children":["revenueChart"]}}
{"op":"add","path":"/elements/revenueChart","value":{"key":"revenueChart","type":"Line","props":{"chartId":"revenue","data":[...],"xField":"month","yField":"revenue"}}}

## ANTI-PATTERNS (DO NOT DO)

✗ Wrapping every single element (too granular)
✗ Using same data-semantic-id for multiple regions
✗ Omitting data-semantic-type (breaks agent decision-making)
✗ Nesting SemanticRegions directly (use intermediate layout)
✗ Using generic IDs like "region-1" (be descriptive)`,
      hasChildren: true,
      defaultEntrance: defaultAnimations.panel,
    },
  },
}
