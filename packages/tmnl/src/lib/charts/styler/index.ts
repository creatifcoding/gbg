/**
 * Chart Styler Module
 *
 * Per-chart style state management with Effect Schema validation
 * and effect-atom integration.
 *
 * ## Architecture
 *
 * The agent is the PRIMARY style generator:
 * - streamChartStyleAgent: LLM outputs JSONL patches directly
 * - Effect Schema validates each patch as it arrives
 * - Registry integration for reactive UI updates
 *
 * The service provides LOCAL fallback (no LLM required):
 * - ChartStyler: Orchestrates palette/typography/animation services
 * - Use when offline or for deterministic styling
 *
 * ## Usage
 *
 * ```typescript
 * // Agent (recommended - actual LLM streaming)
 * import { streamChartStyleAgent } from '@/lib/charts/styler'
 *
 * for await (const patch of streamChartStyleAgent({
 *   chartId: 'my-chart',
 *   prompt: 'Style with cyberpunk theme',
 *   chartType: 'Line',
 *   intent: 'cyberpunk'
 * })) {
 *   console.log(patch.type, patch.confidence, patch.palette);
 * }
 *
 * // Fallback (local generation)
 * import { ChartStyler, ChartStylerLive } from '@/lib/charts/styler'
 *
 * const style = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const styler = yield* ChartStyler;
 *     return yield* styler.generateStyle({ chartType: 'Line', intent: 'minimal' });
 *   }).pipe(Effect.provide(ChartStylerLive))
 * );
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
  StylerLLMError as ServiceStylerLLMError,
  NoStyleMatchError,
  PaletteGenerationError,
  AnimationConfigError,
  type StylerError,
} from './errors';

// =============================================================================
// Agent (PRIMARY - LLM streaming)
// =============================================================================

export {
  // Core streaming
  streamChartStyleAgent,
  streamChartStyleAgentEffect,
  generateChartStyleViaAgent,
  // Registry integration
  streamStyleAgentToRegistry,
  runStyleAgentToRegistry,
  // Callback interface
  streamStyleAgentWithCallbacks,
  // AI SDK tool
  createChartStylerAgentTool,
  // Schemas
  AgentStylePatchSchema,
  ChartStylerAgentInputSchema,
  // Error types
  StylerLLMError,
  InvalidPatchError,
  // Types
  type AgentStylePatch,
  type ChartStylerAgentInput,
  type ChartStylerAgentError,
  type StreamStyleAgentOptions,
} from './agent';

// =============================================================================
// Primitive Services (for local generation)
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
// Orchestrator Service (LOCAL fallback - no LLM)
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
