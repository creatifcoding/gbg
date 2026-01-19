/**
 * Chart Styler Module
 *
 * Per-chart style state management with Effect Schema validation
 * and effect-atom integration.
 *
 * ## Architecture
 *
 * ```
 * chartStyleFamily(chartId) → ChartStyleState atom
 *       ↓ (derived)
 * chartResolvedThemeFamily(chartId) → G2ThemeConfig
 *       ↓ (consumed by)
 * <ChartRenderer theme={resolvedTheme} />
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { getChartStyleAtoms, makeChartStyleId } from '@/lib/charts/styler'
 *
 * // Get atoms for a chart
 * const chartId = makeChartStyleId('my-chart')
 * const atoms = getChartStyleAtoms(chartId)
 *
 * // Read/write via registry
 * const style = registry.get(atoms.style)
 * registry.set(atoms.style, { ...style, intent: 'cyberpunk' })
 *
 * // Use resolved theme in React
 * const theme = useAtomValue(atoms.resolvedTheme)
 * ```
 *
 * @module charts/styler
 */

// =============================================================================
// Schemas
// =============================================================================

export {
  // Branded types
  ChartStyleId,
  makeChartStyleId,
  // Theme variant
  BaseThemeVariant,
  // Configuration schemas
  TypographyConfig,
  AnimationConfig,
  AxisOverride,
  // State schemas
  ChartStyleState,
  DEFAULT_STYLE_STATE,
  StylePatch,
  // Styler I/O schemas
  StylerInput,
  StylerOutput,
  // Utilities
  applyStylePatch,
  resetStyleState,
} from './schemas';

export type {
  ChartStyleId as ChartStyleIdType,
  BaseThemeVariant as BaseThemeVariantType,
  TypographyConfig as TypographyConfigType,
  AnimationConfig as AnimationConfigType,
  AxisOverride as AxisOverrideType,
  ChartStyleState as ChartStyleStateType,
  StylePatch as StylePatchType,
  StylerInput as StylerInputType,
  StylerOutput as StylerOutputType,
} from './schemas';

// =============================================================================
// Atoms
// =============================================================================

export {
  // Per-chart atom families
  chartStyleFamily,
  chartIsStreamingFamily,
  chartConfidenceFamily,
  // Derived atoms
  systemThemeAtom,
  chartResolvedThemeFamily,
  // Bundle accessor
  getChartStyleAtoms,
  // Operations factory
  createChartStyleOps,
} from './atoms';

export type { ChartStyleAtoms } from './atoms';

// =============================================================================
// Errors
// =============================================================================

export {
  StylerInputError,
  StylerLLMError,
  NoStyleMatchError,
  PaletteGenerationError,
  AnimationConfigError,
  type StylerError,
} from './errors';

// =============================================================================
// Layer 1: Primitive Services
// =============================================================================

export {
  // Palette service
  PaletteService,
  PaletteServiceLive,
  makePaletteService,
  type DataContext,
} from './services/palette';

export {
  // Typography service
  TypographyService,
  TypographyServiceLive,
  makeTypographyService,
  type Typography,
  type ContainerSize,
} from './services/typography';

export {
  // Animation service
  AnimationService,
  AnimationServiceLive,
  makeAnimationService,
  type AnimationConfig as AnimationServiceConfig,
} from './services/animation';

// =============================================================================
// Layer 3: Orchestrator Service
// =============================================================================

export {
  // ChartStyler orchestrator
  ChartStyler,
  ChartStylerLive,
  makeChartStyler,
  runChartStyler,
  // Schema re-exports for convenience
  StylerInputSchema,
} from './service';

export type {
  StylerOutput as ChartStylerOutput,
  StylerInput as ChartStylerInput,
} from './service';

// =============================================================================
// AI Tool
// =============================================================================

export {
  // One-shot tool
  createChartStylerTool,
  // Streaming tool
  createChartStylerStreamingTool,
  // Standalone async generator
  streamChartStyle,
  // Types
  type ChartStylerTool,
  type ChartStylerStreamingTool,
  type ChartStylerToolSuccess,
  type ChartStylerToolError,
  type ChartStylerToolOutput,
  type ChartStylerStreamPatch,
  type StreamingStatus,
} from './ai-tool';

// =============================================================================
// Streaming
// =============================================================================

export {
  // Stream creation
  createStyleStream,
  // Registry integration
  streamStyleToRegistry,
  runStyleStream,
  // Callback interface
  streamStyleWithCallbacks,
  // Types
  type StyleStreamPatch,
  type StyleStreamEvent,
  type StreamStyleOptions,
} from './streaming';
