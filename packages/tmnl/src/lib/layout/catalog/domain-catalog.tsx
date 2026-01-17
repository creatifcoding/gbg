'use client'

/**
 * @fileoverview Layout Domain Catalog for CatalogComponents Service
 *
 * Combines:
 * - Effect Schemas for prop validation (from layout-catalog.ts)
 * - React Adapters for rendering (from json-render/react/registries/layout.tsx)
 *
 * This is the single source of truth for layout components.
 *
 * @module layout/catalog/domain-catalog
 */

import { Schema } from "effect"
import type { DomainCatalog, ComponentRenderProps } from "@/lib/json-render/core/CatalogService"
import {
  Grid,
  Stack,
  VStack,
  HStack,
  Flex,
  FlexItem,
  Spacer,
  Divider,
  Center,
  AspectRatio,
  Wrap,
} from "../components"
import type { SpacingToken } from "../schemas"
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
// Prop Schemas
// =============================================================================

/**
 * Spacing schema (validates VANTA spacing tokens)
 */
const SpacingSchema = Schema.Number.pipe(
  Schema.filter(
    (n): n is SpacingValue => (SPACING_VALUES as readonly number[]).includes(n),
    { message: () => `Must be one of: ${SPACING_VALUES.join(", ")}` }
  )
)

const GridPropsSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  template: Schema.optional(Schema.String),
  gap: Schema.optional(SpacingSchema),
  direction: Schema.optional(LayoutDirection),
  alignItems: Schema.optional(GridAlignment),
  justifyItems: Schema.optional(GridAlignment),
  resizable: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const StackPropsSchema = Schema.Struct({
  direction: Schema.optional(LayoutDirection),
  gap: Schema.optional(SpacingSchema),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const VStackPropsSchema = Schema.Struct({
  gap: Schema.optional(SpacingSchema),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const HStackPropsSchema = Schema.Struct({
  gap: Schema.optional(SpacingSchema),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const FlexPropsSchema = Schema.Struct({
  direction: Schema.optional(FlexDirection),
  wrap: Schema.optional(FlexWrap),
  gap: Schema.optional(SpacingSchema),
  rowGap: Schema.optional(SpacingSchema),
  columnGap: Schema.optional(SpacingSchema),
  alignItems: Schema.optional(AlignItems),
  alignContent: Schema.optional(JustifyContent),
  justifyContent: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  inline: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const FlexItemPropsSchema = Schema.Struct({
  grow: Schema.optional(Schema.Number),
  shrink: Schema.optional(Schema.Number),
  basis: Schema.optional(Schema.String),
  alignSelf: Schema.optional(AlignItems),
  order: Schema.optional(Schema.Number),
  className: Schema.optional(Schema.String),
})

const SpacerPropsSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
})

const DividerPropsSchema = Schema.Struct({
  orientation: Schema.optional(Schema.Literal("horizontal", "vertical")),
  spacing: Schema.optional(SpacingSchema),
  className: Schema.optional(Schema.String),
})

const CenterPropsSchema = Schema.Struct({
  gap: Schema.optional(SpacingSchema),
  fill: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const AspectRatioPropsSchema = Schema.Struct({
  ratio: Schema.optional(Schema.Number),
  className: Schema.optional(Schema.String),
})

const WrapPropsSchema = Schema.Struct({
  gap: Schema.optional(SpacingSchema),
  alignItems: Schema.optional(AlignItems),
  justifyContent: Schema.optional(JustifyContent),
  className: Schema.optional(Schema.String),
})

// =============================================================================
// Renderers (Adapters)
// =============================================================================

function GridRenderer({ element, children }: ComponentRenderProps) {
  const { template, breakpoints, gap, direction, resizable, className, ...rest } = element.props
  return (
    <Grid
      id={element.key}
      template={template as string}
      breakpoints={breakpoints as any}
      gap={gap as SpacingToken}
      direction={direction as "row" | "column"}
      resizable={resizable as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </Grid>
  )
}

function StackRenderer({ element, children }: ComponentRenderProps) {
  const { direction, gap, align, justify, wrap, fill, className, ...rest } = element.props
  return (
    <Stack
      direction={direction as "row" | "column"}
      gap={gap as SpacingToken}
      align={align as any}
      justify={justify as any}
      wrap={wrap as boolean}
      fill={fill as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </Stack>
  )
}

function VStackRenderer({ element, children }: ComponentRenderProps) {
  const { gap, align, justify, fill, className, ...rest } = element.props
  return (
    <VStack
      gap={gap as SpacingToken}
      align={align as any}
      justify={justify as any}
      fill={fill as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </VStack>
  )
}

function HStackRenderer({ element, children }: ComponentRenderProps) {
  const { gap, align, justify, fill, className, ...rest } = element.props
  return (
    <HStack
      gap={gap as SpacingToken}
      align={align as any}
      justify={justify as any}
      fill={fill as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </HStack>
  )
}

function FlexRenderer({ element, children }: ComponentRenderProps) {
  const { direction, wrap, gap, alignItems, justifyContent, fill, className, ...rest } = element.props
  return (
    <Flex
      direction={direction as any}
      wrap={wrap as any}
      gap={gap as SpacingToken}
      alignItems={alignItems as any}
      justifyContent={justifyContent as any}
      fill={fill as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </Flex>
  )
}

function FlexItemRenderer({ element, children }: ComponentRenderProps) {
  const { grow, shrink, basis, className, ...rest } = element.props
  return (
    <FlexItem
      grow={grow as number}
      shrink={shrink as number}
      basis={basis as string | number}
      className={className as string}
      {...rest}
    >
      {children}
    </FlexItem>
  )
}

function SpacerRenderer(_props: ComponentRenderProps) {
  return <Spacer />
}

function DividerRenderer({ element }: ComponentRenderProps) {
  const { orientation, className } = element.props
  return (
    <Divider
      orientation={orientation as "horizontal" | "vertical"}
      className={className as string}
    />
  )
}

function CenterRenderer({ element, children }: ComponentRenderProps) {
  const { className, ...rest } = element.props
  return (
    <Center className={className as string} {...rest}>
      {children}
    </Center>
  )
}

function AspectRatioRenderer({ element, children }: ComponentRenderProps) {
  const { ratio, className, ...rest } = element.props
  return (
    <AspectRatio ratio={ratio as number} className={className as string} {...rest}>
      {children}
    </AspectRatio>
  )
}

function WrapRenderer({ element, children }: ComponentRenderProps) {
  const { gap, alignItems, justifyContent, className, ...rest } = element.props
  return (
    <Wrap
      gap={gap as SpacingToken}
      alignItems={alignItems as any}
      justifyContent={justifyContent as any}
      className={className as string}
      {...rest}
    >
      {children}
    </Wrap>
  )
}

// =============================================================================
// Domain Catalog Export
// =============================================================================

/**
 * Layout Domain Catalog
 *
 * Single source of truth for layout components:
 * - Schemas for AI prompt generation and validation
 * - Renderers for React rendering
 * - Descriptions for AI context
 *
 * @example
 * ```ts
 * import { layoutDomainCatalog } from '@/lib/layout/catalog/domain-catalog'
 * import { createCatalogLayer } from '@/lib/json-render/core/CatalogService'
 *
 * const CatalogLive = createCatalogLayer(layoutDomainCatalog)
 * ```
 */
export const layoutDomainCatalog: DomainCatalog = {
  name: "TMNL Layout",
  components: {
    Grid: {
      schema: GridPropsSchema,
      renderer: GridRenderer,
      description: 'CSS Grid layout. Use template for columns (e.g., "1fr 1fr" for 2 equal columns). Gap uses VANTA spacing tokens (0, 4, 8, 12, 16, 24, 32, 48, 64).',
      hasChildren: true,
    },
    Stack: {
      schema: StackPropsSchema,
      renderer: StackRenderer,
      description: 'Linear flex layout. Default direction is "column" (vertical). Use gap for spacing between children.',
      hasChildren: true,
    },
    VStack: {
      schema: VStackPropsSchema,
      renderer: VStackRenderer,
      description: "Vertical stack (shorthand for Stack with direction=column).",
      hasChildren: true,
    },
    HStack: {
      schema: HStackPropsSchema,
      renderer: HStackRenderer,
      description: "Horizontal stack (shorthand for Stack with direction=row).",
      hasChildren: true,
    },
    Flex: {
      schema: FlexPropsSchema,
      renderer: FlexRenderer,
      description: "Full flexbox control. Use for complex layouts with wrap, alignment, and justify options.",
      hasChildren: true,
    },
    FlexItem: {
      schema: FlexItemPropsSchema,
      renderer: FlexItemRenderer,
      description: "Flex child with explicit grow/shrink/basis. Use inside Flex for controlled sizing.",
      hasChildren: true,
    },
    Spacer: {
      schema: SpacerPropsSchema,
      renderer: SpacerRenderer,
      description: "Flexible space filler. Expands to fill available space in flex containers.",
      hasChildren: false,
    },
    Divider: {
      schema: DividerPropsSchema,
      renderer: DividerRenderer,
      description: "Visual separator line. Auto-adapts to parent direction.",
      hasChildren: false,
    },
    Center: {
      schema: CenterPropsSchema,
      renderer: CenterRenderer,
      description: "Centers content both horizontally and vertically. Shorthand for Flex with center alignment.",
      hasChildren: true,
    },
    AspectRatio: {
      schema: AspectRatioPropsSchema,
      renderer: AspectRatioRenderer,
      description: "Maintains aspect ratio. Use ratio prop (e.g., 16/9 for video, 1 for square).",
      hasChildren: true,
    },
    Wrap: {
      schema: WrapPropsSchema,
      renderer: WrapRenderer,
      description: "Flex container that wraps children to the next line when they exceed container width.",
      hasChildren: true,
    },
  },
}
