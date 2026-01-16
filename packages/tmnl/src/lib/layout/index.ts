/**
 * @module layout
 * @description Universal Layout System for TMNL
 *
 * A service-based layout system with Grid, Stack, Flex primitives,
 * using VANTA tokens and array-based responsive breakpoints.
 *
 * ## Quick Start
 *
 * ```tsx
 * import { Grid, Stack, Flex } from '@/lib/layout'
 *
 * // Basic grid
 * <Grid template="1fr 1fr" gap={16}>
 *   <Card />
 *   <Card />
 * </Grid>
 *
 * // Vertical stack
 * <Stack gap={24}>
 *   <Header />
 *   <Content />
 * </Stack>
 *
 * // Responsive grid
 * <Grid
 *   template="1fr"
 *   breakpoints={[
 *     { condition: { _tag: "MinWidthCondition", minWidth: 768 }, template: "1fr 1fr" }
 *   ]}
 * >
 *   ...
 * </Grid>
 * ```
 *
 * ## Architecture
 *
 * - **Schemas**: Effect Schema definitions for props, spacing, breakpoints
 * - **Atoms**: Atom factory for resize state (instanceId-based)
 * - **Services**: BreakpointService, ResizeService, LayoutService
 * - **Hooks**: useContainerSize, useBreakpoint
 * - **Components**: Grid, Stack, Flex, ResizeHandle
 * - **Catalog**: json-render integration
 */

// =============================================================================
// Schemas
// =============================================================================

export {
  // Spacing
  SPACING_VALUES,
  SpacingToken,
  SpacingTokenWithDefault,
  spacingToCss,
  spacingToVar,
  type SpacingValue,
  // Alignment
  AlignItems,
  FlexDirection,
  FlexWrap,
  GridAlignment,
  JustifyContent,
  LayoutDirection,
  // Breakpoints
  BreakpointCondition,
  BREAKPOINT_PRESETS,
  LayoutBreakpoint,
  LayoutBreakpoints,
  maxWidth,
  MinWidthCondition,
  MaxWidthCondition,
  minWidth,
  range,
  RangeWidthCondition,
  // Resize
  clampRatio,
  defaultResizeState,
  equalRatios,
  normalizeRatios,
  Position,
  ResizeDirection,
  ResizeHandleProps as ResizeHandlePropsSchema,
  ResizeResult,
  ResizeState,
  // Grid
  estimateColumnCount,
  GridProps as GridPropsSchema,
  GridState,
  ratiosToTemplate,
  // Stack
  HStackProps as HStackPropsSchema,
  StackProps as StackPropsSchema,
  VStackProps as VStackPropsSchema,
  // Flex
  FlexItemProps as FlexItemPropsSchema,
  FlexProps as FlexPropsSchema,
} from "./schemas"

// =============================================================================
// Atoms
// =============================================================================

export {
  // Factory
  clearAllLayoutAtoms,
  createLayoutAtoms,
  disposeLayoutAtoms,
  getLayoutAtoms,
  getRegisteredInstanceIds,
  hasLayoutAtoms,
  updateLayoutCellCount,
  type LayoutAtoms,
  // State operations
  createStateUpdater,
  endDrag,
  getRatios,
  getState,
  resetRatios,
  setRatios,
  startDrag,
  updateDrag,
} from "./atoms"

// =============================================================================
// Services
// =============================================================================

export {
  // Breakpoint
  BreakpointService,
  BreakpointServiceLive,
  createDesktopFirstEvaluator,
  createMobileFirstEvaluator,
  evaluateBreakpoints,
  type BreakpointResult,
  // Resize
  calculateResizeSync,
  distributeSpace,
  getHandlePositions,
  pixelToRatioDelta,
  ratioToPixel,
  ResizeService,
  ResizeServiceLive,
  snapToGrid,
  type ResizeInput,
  // Layout
  createLayoutController,
  LayoutService,
  LayoutServiceLive,
  type LayoutController,
  type LayoutInitOptions,
  type ResizeOptions,
} from "./services"

// =============================================================================
// Hooks
// =============================================================================

export {
  // Container size
  useContainerHeight,
  useContainerMeasure,
  useContainerSize,
  useContainerWidth,
  type ContainerSize,
  type UseContainerSizeOptions,
  // Breakpoint
  createBreakpointHook,
  useBreakpoint,
  useBreakpointTemplate,
  useDesktopFirst,
  useMobileFirst,
  type UseBreakpointOptions,
} from "./hooks"

// =============================================================================
// Components
// =============================================================================

export {
  // Grid
  Grid,
  type GridProps,
  // Stack
  Divider,
  HStack,
  Spacer,
  Stack,
  VStack,
  type DividerProps,
  type HStackProps,
  type StackProps,
  type VStackProps,
  // Flex
  AspectRatio,
  Center,
  Flex,
  FlexItem,
  Wrap,
  type AspectRatioProps,
  type CenterProps,
  type FlexItemProps,
  type FlexProps,
  type WrapProps,
  // ResizeHandle
  ResizeHandle,
  type ResizeHandleProps,
} from "./components"

// =============================================================================
// Catalog
// =============================================================================

export {
  layoutCatalog,
  layoutExamples,
  spacingExamples,
  type LayoutCatalog,
} from "./catalog"
