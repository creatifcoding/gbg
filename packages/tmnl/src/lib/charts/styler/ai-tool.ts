/**
 * Chart Styler AI Tool
 *
 * Wraps ChartStyler service as an AI SDK tool for external agents.
 * Uses Effect Schema for type-safe input/output definitions.
 *
 * Pattern: Effect Schema → JSONSchema.make() → AI SDK jsonSchema()
 *
 * @module charts/styler/ai-tool
 */

import { tool, jsonSchema } from 'ai';
import { Effect, Stream, JSONSchema } from 'effect';
import { ChartStyler, ChartStylerLive } from './service';
import {
  StylerInput,
  type StylerInput as StylerInputType,
  type TypographyConfig as TypographyConfigType,
  type AnimationConfig as AnimationConfigType,
} from './schemas';
import { createStyleStream, type StyleStreamEvent } from './streaming';

// =============================================================================
// Tool Output Types
// =============================================================================

export interface ChartStylerToolSuccess {
  readonly palette: string[];
  readonly typography: {
    readonly family: string;
    readonly size: number;
    readonly weight?: number;
  };
  readonly animations: {
    readonly appear?: {
      readonly animation: string;
      readonly duration: number;
      readonly easing?: string;
    };
    readonly update?: {
      readonly animation: string;
      readonly duration: number;
    };
  };
  readonly confidence: number;
  readonly rationale: string;
}

export interface ChartStylerToolError {
  readonly error: true;
  readonly errorType: string;
  readonly message: string;
}

export type ChartStylerToolOutput = ChartStylerToolSuccess | ChartStylerToolError;

// =============================================================================
// Streaming Output Types
// =============================================================================

/**
 * Streaming status types for progressive updates.
 */
export type StreamingStatus = 'starting' | 'partial' | 'complete' | 'error';

/**
 * Streaming patch yielded during progressive style generation.
 */
export interface ChartStylerStreamPatch {
  readonly status: StreamingStatus;
  readonly confidence: number;
  readonly palette?: string[];
  readonly typography?: TypographyConfigType;
  readonly animations?: AnimationConfigType;
  readonly rationale?: string;
  readonly errorMessage?: string;
}

// =============================================================================
// One-Shot Tool Factory
// =============================================================================

/**
 * Create a chart_styler tool for AI SDK v6.
 *
 * Uses Effect Schema converted to JSON Schema via JSONSchema.make().
 *
 * @example
 * ```ts
 * import { createChartStylerTool } from '@/lib/charts/styler'
 *
 * const tools = {
 *   chart_styler: createChartStylerTool(),
 * }
 *
 * const result = await generateText({
 *   model: openai('gpt-4o'),
 *   tools,
 *   prompt: "Style this line chart with a cyberpunk theme",
 * })
 * ```
 */
export function createChartStylerTool() {
  return tool({
    description: `Generate intelligent chart styling based on context.
Produces: color palette, typography, animations, confidence score, and rationale.

Use when:
- User wants custom chart styling
- Applying a visual theme to a chart
- Generating data-aware color palettes

Supported intents:
- "emphasize-trend" - Highlight data trends
- "compare-categories" - Compare multiple categories
- "show-distribution" - Show data distribution
- "highlight-outliers" - Emphasize unusual values
- "cyberpunk" - Neon colors, tech feel
- "minimal" - Subtle, reduced colors`,

    inputSchema: jsonSchema<StylerInputType>(
      JSONSchema.make(StylerInput) as Parameters<typeof jsonSchema>[0]
    ),

    execute: async (input: StylerInputType): Promise<ChartStylerToolOutput> => {
      const program = Effect.gen(function* () {
        const styler = yield* ChartStyler;
        const result = yield* styler.generateStyle(input);
        return result;
      }).pipe(
        Effect.provide(ChartStylerLive),
        Effect.map(
          (output): ChartStylerToolSuccess => ({
            palette: output.palette,
            typography: output.typography,
            animations: output.animations,
            confidence: output.confidence,
            rationale: output.rationale,
          })
        ),
        Effect.catchAll((error) =>
          Effect.succeed({
            error: true as const,
            errorType: (error as { _tag?: string })._tag ?? 'Unknown',
            message: String(error),
          })
        )
      );

      return Effect.runPromise(program);
    },
  });
}

// =============================================================================
// Streaming Tool Factory (Effect-Native)
// =============================================================================

/**
 * Map StyleStreamEvent to ChartStylerStreamPatch.
 */
function mapEventToPatch(event: StyleStreamEvent): ChartStylerStreamPatch | null {
  switch (event._tag) {
    case 'Started':
      return {
        status: 'starting',
        confidence: 0,
      };

    case 'Patch':
      return {
        status: 'partial',
        confidence: event.patch.confidence,
        palette: event.patch.palette,
        typography: event.patch.typography,
        animations: event.patch.animations,
      };

    case 'Complete':
      return {
        status: 'complete',
        confidence: event.output.confidence,
        palette: event.output.palette,
        typography: event.output.typography,
        animations: event.output.animations,
        rationale: event.output.rationale,
      };

    case 'Error':
      return {
        status: 'error',
        confidence: 0,
        errorMessage: event.error,
      };

    default:
      return null;
  }
}

/**
 * Create a streaming chart_styler tool for AI SDK v6.
 *
 * Uses Effect-native Stream.toAsyncIterable for bridging Effect Streams
 * to async iteration. Yields progressive style patches with increasing
 * confidence as styling progresses.
 *
 * @example
 * ```ts
 * import { createChartStylerStreamingTool } from '@/lib/charts/styler'
 *
 * const tools = {
 *   chart_styler_stream: createChartStylerStreamingTool(),
 * }
 *
 * const result = streamText({
 *   model: openai('gpt-4o'),
 *   tools,
 *   prompt: "Style this line chart with a cyberpunk theme",
 * })
 *
 * // Patches arrive progressively:
 * // { status: 'starting', confidence: 0 }
 * // { status: 'partial', confidence: 0.3, palette: ['#0ff', '#f0f'] }
 * // { status: 'partial', confidence: 0.5, ... }
 * // { status: 'complete', confidence: 0.85, rationale: '...' }
 * ```
 */
export function createChartStylerStreamingTool() {
  return tool({
    description: `Generate intelligent chart styling with progressive streaming.
Yields style patches with increasing confidence as styling progresses.

Output sequence:
1. Starting (0): Stream initialized
2. Partial (0.3): Initial palette
3. Partial (0.5): + Typography
4. Partial (0.7): + Animations
5. Complete (0.85+): Full style with rationale

Use when:
- User wants live style preview
- Progressive UI updates during styling
- Real-time feedback on style generation`,

    inputSchema: jsonSchema<StylerInputType>(
      JSONSchema.make(StylerInput) as Parameters<typeof jsonSchema>[0]
    ),

    execute: async function* (input: StylerInputType) {
      // Create stream with dependencies provided via Stream.provideLayer
      const stream = createStyleStream(input).pipe(
        Stream.map(mapEventToPatch),
        Stream.filter((patch): patch is ChartStylerStreamPatch => patch !== null),
        Stream.provideLayer(ChartStylerLive)
      );

      // Convert to AsyncIterable (stream now has R=never after provideLayer)
      const asyncIterable = Stream.toAsyncIterable(stream);

      // Yield patches as they arrive
      let lastPatch: ChartStylerStreamPatch | undefined;
      for await (const patch of asyncIterable) {
        lastPatch = patch;
        yield patch;
      }

      // Return the final patch as the tool result
      return (
        lastPatch ?? {
          status: 'error' as const,
          confidence: 0,
          errorMessage: 'No patches received',
        }
      );
    },
  });
}

// =============================================================================
// Standalone Async Generator (for direct use)
// =============================================================================

/**
 * Stream chart style patches as an async generator.
 *
 * For direct use outside AI SDK tools - e.g., in API routes or React hooks.
 * Uses Stream.toAsyncIterable within proper Effect context.
 *
 * @example
 * ```ts
 * for await (const patch of streamChartStyle({ chartType: 'Line', intent: 'cyberpunk' })) {
 *   console.log(`Confidence: ${patch.confidence}`, patch.palette);
 * }
 * ```
 */
export async function* streamChartStyle(
  input: StylerInputType
): AsyncGenerator<ChartStylerStreamPatch, ChartStylerStreamPatch, unknown> {
  // Create stream with dependencies provided via Stream.provideLayer
  const stream = createStyleStream(input).pipe(
    Stream.map(mapEventToPatch),
    Stream.filter((patch): patch is ChartStylerStreamPatch => patch !== null),
    Stream.provideLayer(ChartStylerLive)
  );

  // Convert to AsyncIterable
  const asyncIterable = Stream.toAsyncIterable(stream);

  let lastPatch: ChartStylerStreamPatch = {
    status: 'starting',
    confidence: 0,
  };

  for await (const patch of asyncIterable) {
    lastPatch = patch;
    yield patch;
  }

  return lastPatch;
}

// =============================================================================
// Type Exports
// =============================================================================

export type ChartStylerTool = ReturnType<typeof createChartStylerTool>;
export type ChartStylerStreamingTool = ReturnType<typeof createChartStylerStreamingTool>;

// Re-export schemas for convenience
export { StylerInput } from './schemas';
export type { StylerOutput } from './schemas';
