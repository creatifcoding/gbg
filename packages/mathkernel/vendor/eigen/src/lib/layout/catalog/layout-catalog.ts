/**
 * @module layout/catalog/layout-catalog
 * @description genifer catalog integration for layout components
 */

import { Schema } from "effect"
import { createCatalogSync } from "@/lib/genifer/core/catalog"
import {
  AlignItems,
  FlexDirection,
  FlexWrap,
  GridAlignment,
  JustifyContent,
  LayoutDirection,
  SPACING_VALUES,
  type SpacingValue,
} from "../schemas"

// =============================================================================
// Prop Schemas for Catalog
// =============================================================================

/**
 * Spacing schema for catalog (simplified for AI generation)
 */
const SpacingSchema = Schema.Number.pipe(
  Schema.filter(
    (n): n is SpacingValue => (SPACING_VALUES as readonly number[]).includes(n),
    {
      message: () => `Must be one of: ${SPACING_VALUES.join(", ")}`,
    }
  )
)

/**
 * Grid props schema for catalog
 */
const GridPropsSchema = Schema.Struct({
  /** Unique identifier */
  id: Schema.optional(Schema.String),
  /** Grid template (e.g., "1fr 1fr", "repeat(3, 1fr)") */
  template: Schema.optional(Schema.String),
  /** Gap between cells */
  gap: Schema.optional(SpacingSchema),
  /** Grid direction */
  direction: Schema.optional(LayoutDirection),
  /** Align items */
  alignItems: Schema.optional(GridAlignment),
  /** Justify items */
  justifyItems: Schema.optional(GridAlignment),
  /** Enable resize handles */
  resizable: Schema.optional(Schema.Boolean),
  /** CSS class */
  className: Schema.optional(Schema.String),
})

/**
 * Stack props schema for catalog
 */
const StackPropsSchema = Schema.Struct({
  /** Direction (column = vertical, row = horizontal) */
  direction: Schema.optional(LayoutDirection),
  /** Gap between items */
  gap: Schema.optional(SpacingSchema),
  /** Align items on cross-axis */
  align: Schema.optional(AlignItems),
  /** Justify content on main-axis */
  justify: Schema.optional(JustifyContent),
  /** Whether stack fills available space */
  fill: Schema.optional(Schema.Boolean),
  /** CSS class */
  className: Schema.optional(Schema.String),
})

/**
 * VStack props (vertical stack)
 */
const VStackPropsSchema = Schema.Struct({
  gap: Schema.optional(SpacingSchema),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

/**
 * HStack props (horizontal stack)
 */
const HStackPropsSchema = Schema.Struct({
  gap: Schema.optional(SpacingSchema),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

/**
 * Flex props schema for catalog
 */
const FlexPropsSchema = Schema.Struct({
  /** Direction with reverse options */
  direction: Schema.optional(FlexDirection),
  /** Wrap behavior */
  wrap: Schema.optional(FlexWrap),
  /** Gap between items */
  gap: Schema.optional(SpacingSchema),
  /** Row gap */
  rowGap: Schema.optional(SpacingSchema),
  /** Column gap */
  columnGap: Schema.optional(SpacingSchema),
  /** Align items on cross-axis */
  alignItems: Schema.optional(AlignItems),
  /** Align content (multi-line) */
  alignContent: Schema.optional(JustifyContent),
  /** Justify content on main-axis */
  justifyContent: Schema.optional(JustifyContent),
  /** Fill available space */
  fill: Schema.optional(Schema.Boolean),
  /** Render as inline-flex */
  inline: Schema.optional(Schema.Boolean),
  /** CSS class */
  className: Schema.optional(Schema.String),
})

/**
 * FlexItem props schema
 */
const FlexItemPropsSchema = Schema.Struct({
  /** Flex grow factor */
  grow: Schema.optional(Schema.Number),
  /** Flex shrink factor */
  shrink: Schema.optional(Schema.Number),
  /** Flex basis */
  basis: Schema.optional(Schema.String),
  /** Align self override */
  alignSelf: Schema.optional(AlignItems),
  /** Order for reordering */
  order: Schema.optional(Schema.Number),
  /** CSS class */
  className: Schema.optional(Schema.String),
})

/**
 * Spacer (no props needed)
 */
const SpacerPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

/**
 * Divider props
 */
const DividerPropsSchema = Schema.Struct({
  orientation: Schema.optional(Schema.Literal("horizontal", "vertical")),
  spacing: Schema.optional(SpacingSchema),
  className: Schema.optional(Schema.String),
})

/**
 * Center props (centered flex)
 */
const CenterPropsSchema = Schema.Struct({
  gap: Schema.optional(SpacingSchema),
  fill: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

/**
 * AspectRatio props
 */
const AspectRatioPropsSchema = Schema.Struct({
  /** Width/height ratio (e.g., 16/9 = 1.777) */
  ratio: Schema.optional(Schema.Number),
  className: Schema.optional(Schema.String),
})

// =============================================================================
// Catalog
// =============================================================================

/**
 * Layout component catalog for genifer
 */
export const layoutCatalog = createCatalogSync({
  name: "TMNL Layout",
  components: {
    Grid: {
      props: GridPropsSchema,
      hasChildren: true,
      description:
        'CSS Grid layout. Use template for columns (e.g., "1fr 1fr" for 2 equal columns). Gap uses VANTA spacing tokens (0, 4, 8, 12, 16, 24, 32, 48, 64).',
    },
    Stack: {
      props: StackPropsSchema,
      hasChildren: true,
      description:
        'Linear flex layout. Default direction is "column" (vertical). Use gap for spacing between children.',
    },
    VStack: {
      props: VStackPropsSchema,
      hasChildren: true,
      description: "Vertical stack (shorthand for Stack with direction=column).",
    },
    HStack: {
      props: HStackPropsSchema,
      hasChildren: true,
      description: "Horizontal stack (shorthand for Stack with direction=row).",
    },
    Flex: {
      props: FlexPropsSchema,
      hasChildren: true,
      description:
        "Full flexbox control. Use for complex layouts with wrap, alignment, and justify options.",
    },
    FlexItem: {
      props: FlexItemPropsSchema,
      hasChildren: true,
      description:
        "Flex child with explicit grow/shrink/basis. Use inside Flex for controlled sizing.",
    },
    Spacer: {
      props: SpacerPropsSchema,
      hasChildren: false,
      description:
        "Flexible space filler. Expands to fill available space in flex containers.",
    },
    Divider: {
      props: DividerPropsSchema,
      hasChildren: false,
      description: "Visual separator line. Auto-adapts to parent direction.",
    },
    Center: {
      props: CenterPropsSchema,
      hasChildren: true,
      description:
        "Centers content both horizontally and vertically. Shorthand for Flex with center alignment.",
    },
    AspectRatio: {
      props: AspectRatioPropsSchema,
      hasChildren: true,
      description:
        "Maintains aspect ratio. Use ratio prop (e.g., 16/9 for video, 1 for square).",
    },
  },
})

/**
 * Type for the layout catalog
 */
export type LayoutCatalog = typeof layoutCatalog

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate spacing example for AI prompts
 */
export const spacingExamples = `
Spacing values (VANTA tokens):
- 0: No spacing
- 4: Tight (0.25rem)
- 8: Compact (0.5rem)
- 12: Small (0.75rem)
- 16: Default (1rem)
- 24: Medium (1.5rem)
- 32: Large (2rem)
- 48: Extra large (3rem)
- 64: Maximum (4rem)
`.trim()

/**
 * Generate layout usage examples for AI prompts
 */
export const layoutExamples = `
## Layout Examples

### Two-column grid
\`\`\`json
{
  "type": "Grid",
  "props": { "template": "1fr 1fr", "gap": 16 },
  "children": [
    { "type": "Card", "props": { "title": "Left" } },
    { "type": "Card", "props": { "title": "Right" } }
  ]
}
\`\`\`

### Vertical stack with spacing
\`\`\`json
{
  "type": "VStack",
  "props": { "gap": 24 },
  "children": [
    { "type": "Header" },
    { "type": "Content" },
    { "type": "Footer" }
  ]
}
\`\`\`

### Horizontal layout with spacer
\`\`\`json
{
  "type": "HStack",
  "props": { "gap": 8, "align": "center" },
  "children": [
    { "type": "Logo" },
    { "type": "Spacer" },
    { "type": "Navigation" }
  ]
}
\`\`\`

### Centered modal
\`\`\`json
{
  "type": "Center",
  "props": { "fill": true },
  "children": [
    { "type": "Dialog", "props": { "title": "Confirm" } }
  ]
}
\`\`\`
`.trim()
