'use client'

/**
 * @fileoverview Layout Domain Catalog for CatalogComponents Service
 *
 * Combines:
 * - Effect Schemas for prop validation (from layout-catalog.ts)
 * - React Adapters for rendering (from genifer/react/registries/layout.tsx)
 *
 * This is the single source of truth for layout components.
 *
 * @module layout/catalog/domain-catalog
 */

import { Schema } from "effect"
import type { DomainCatalog, ComponentRenderProps } from "@/lib/genifer/core/CatalogService"
import type { EntranceAnimation } from "@/lib/genifer/core/animation-schema"
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
import type { LayoutBreakpoints, SpacingToken } from "../schemas"
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

/**
 * Breakpoint condition schemas (tagged union for JSON representation)
 * These mirror the actual LayoutBreakpoint schemas but use plain structs for JSON parsing
 */
const MinWidthConditionSchema = Schema.Struct({
  _tag: Schema.Literal('MinWidthCondition'),
  minWidth: Schema.Number,
})

const MaxWidthConditionSchema = Schema.Struct({
  _tag: Schema.Literal('MaxWidthCondition'),
  maxWidth: Schema.Number,
})

const RangeWidthConditionSchema = Schema.Struct({
  _tag: Schema.Literal('RangeWidthCondition'),
  minWidth: Schema.Number,
  maxWidth: Schema.Number,
})

const BreakpointConditionSchema = Schema.Union(
  MinWidthConditionSchema,
  MaxWidthConditionSchema,
  RangeWidthConditionSchema
)

/**
 * Layout breakpoint schema for JSON representation
 * Maps to LayoutBreakpoint class at runtime
 */
const LayoutBreakpointSchema = Schema.Struct({
  condition: BreakpointConditionSchema,
  template: Schema.optional(Schema.String),
  gap: Schema.optional(SpacingSchema),
})

const GridPropsSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  template: Schema.optional(Schema.String),
  breakpoints: Schema.optional(Schema.Array(LayoutBreakpointSchema)),
  gap: Schema.optional(SpacingSchema),
  direction: Schema.optional(LayoutDirection),
  alignItems: Schema.optional(GridAlignment),
  justifyItems: Schema.optional(GridAlignment),
  resizable: Schema.optional(Schema.Boolean),
  initialRatios: Schema.optional(Schema.Array(Schema.Number)),
  minRatio: Schema.optional(Schema.Number),
  className: Schema.optional(Schema.String),
})

const StackPropsSchema = Schema.Struct({
  direction: Schema.optional(LayoutDirection),
  gap: Schema.optional(SpacingSchema),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  wrap: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const VStackPropsSchema = Schema.Struct({
  gap: Schema.optional(SpacingSchema),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  wrap: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
})

const HStackPropsSchema = Schema.Struct({
  gap: Schema.optional(SpacingSchema),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  wrap: Schema.optional(Schema.Boolean),
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
  const { template, breakpoints, gap, direction, resizable, initialRatios, minRatio, className, ...rest } = element.props
  return (
    <Grid
      id={element.key}
      template={template as string}
      breakpoints={breakpoints as LayoutBreakpoints}
      gap={gap as SpacingToken}
      direction={direction as "row" | "column"}
      resizable={resizable as boolean}
      initialRatios={initialRatios as number[]}
      minRatio={minRatio as number}
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
  const { gap, align, justify, fill, wrap, className, ...rest } = element.props
  return (
    <VStack
      gap={gap as SpacingToken}
      align={align as any}
      justify={justify as any}
      fill={fill as boolean}
      wrap={wrap as boolean}
      className={className as string}
      {...rest}
    >
      {children}
    </VStack>
  )
}

function HStackRenderer({ element, children }: ComponentRenderProps) {
  const { gap, align, justify, fill, wrap, className, ...rest } = element.props
  return (
    <HStack
      gap={gap as SpacingToken}
      align={align as any}
      justify={justify as any}
      fill={fill as boolean}
      wrap={wrap as boolean}
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
  const { grow, shrink, basis, alignSelf, order, className, ...rest } = element.props
  return (
    <FlexItem
      grow={grow as number}
      shrink={shrink as number}
      basis={basis as string | number}
      alignSelf={alignSelf as any}
      order={order as number}
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
  const { orientation, spacing, className } = element.props
  return (
    <Divider
      orientation={orientation as "horizontal" | "vertical"}
      spacing={spacing as SpacingToken}
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
// Default Entrance Animations
// =============================================================================

/**
 * Default animations for layout components.
 * These are used when the LLM omits the entrance field on an element.
 */
const defaultAnimations = {
  /** Invisible elements - instant (0ms), satisfies schema without visible effect */
  instant: {
    property: 'opacity',
    easing: 'linear',
    duration: 'instant',
  } satisfies EntranceAnimation,

  container: {
    property: 'opacity',
    easing: 'out-quad',
    duration: 'normal',
  } satisfies EntranceAnimation,

  stack: {
    property: 'opacity+translateY',
    easing: 'out-cubic',
    duration: 'normal',
    stagger: true,
  } satisfies EntranceAnimation,

  center: {
    property: 'opacity+scale',
    easing: 'out-back',
    duration: 'slow',
  } satisfies EntranceAnimation,

  decorative: {
    property: 'opacity+scale',
    easing: 'out-quart',
    duration: 'fast',
  } satisfies EntranceAnimation,
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
 * - Default entrance animations for each component
 *
 * @example
 * ```ts
 * import { layoutDomainCatalog } from '@/lib/layout/catalog/domain-catalog'
 * import { createCatalogLayer } from '@/lib/genifer/core/CatalogService'
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
      description: 'CSS Grid layout. Use template for columns (e.g., "1fr 1fr"). breakpoints: Array of responsive rules like [{ condition: { _tag: "MinWidthCondition", minWidth: 768 }, template: "1fr 1fr" }]. resizable: true enables drag handles. initialRatios: [0.3, 0.7] sets initial proportions. minRatio limits minimum resize. Gap uses VANTA spacing tokens (0, 4, 8, 12, 16, 24, 32, 48, 64).',
      hasChildren: true,
      defaultEntrance: defaultAnimations.container,
    },
    Stack: {
      schema: StackPropsSchema,
      renderer: StackRenderer,
      description: 'Linear flex layout. Default direction is "column" (vertical). wrap: true allows items to flow to next line when exceeding container width. Use gap for spacing between children.',
      hasChildren: true,
      defaultEntrance: defaultAnimations.stack,
    },
    VStack: {
      schema: VStackPropsSchema,
      renderer: VStackRenderer,
      description: "Vertical stack (shorthand for Stack with direction=column). wrap: true allows items to flow to next line.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.stack,
    },
    HStack: {
      schema: HStackPropsSchema,
      renderer: HStackRenderer,
      description: "Horizontal stack (shorthand for Stack with direction=row). wrap: true allows items to flow to next line.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.stack,
    },
    Flex: {
      schema: FlexPropsSchema,
      renderer: FlexRenderer,
      description: "Full flexbox control. Use for complex layouts with wrap, alignment, and justify options.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.container,
    },
    FlexItem: {
      schema: FlexItemPropsSchema,
      renderer: FlexItemRenderer,
      description: "Flex child with explicit grow/shrink/basis. alignSelf overrides parent alignment for this item. order controls visual position without changing DOM.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.container,
    },
    Spacer: {
      schema: SpacerPropsSchema,
      renderer: SpacerRenderer,
      description: "Flexible space filler. Expands to fill available space in flex containers.",
      hasChildren: false,
      defaultEntrance: defaultAnimations.instant,
    },
    Divider: {
      schema: DividerPropsSchema,
      renderer: DividerRenderer,
      description: "Visual separator line. Auto-adapts to parent direction. spacing controls margin around divider (VANTA spacing tokens).",
      hasChildren: false,
      defaultEntrance: defaultAnimations.decorative,
    },
    Center: {
      schema: CenterPropsSchema,
      renderer: CenterRenderer,
      description: "Centers content both horizontally and vertically. Shorthand for Flex with center alignment.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.center,
    },
    AspectRatio: {
      schema: AspectRatioPropsSchema,
      renderer: AspectRatioRenderer,
      description: "Maintains aspect ratio. Use ratio prop (e.g., 16/9 for video, 1 for square).",
      hasChildren: true,
      defaultEntrance: defaultAnimations.container,
    },
    Wrap: {
      schema: WrapPropsSchema,
      renderer: WrapRenderer,
      description: "Flex container that wraps children to the next line when they exceed container width.",
      hasChildren: true,
      defaultEntrance: defaultAnimations.stack,
    },
  },
}
