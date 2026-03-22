/**
 * Chart Styler Agent
 *
 * AI SDK agent for per-chart styling via streamText.
 * The LLM's structured output ARE the style patches themselves (JSONL).
 *
 * Architecture: Follows `/ui-generate` archetype
 * - streamText with system prompt → LLM outputs JSONL patches → client validates
 *
 * THIS IS THE PRIMARY STYLE GENERATOR.
 * The services/ subdirectory provides fallback local generation.
 *
 * Pattern: AI SDK streamText + Effect Schema validation
 *
 * @module charts/styler/agent
 */

import { Effect, Schema, Stream, Data } from 'effect';
import { streamText } from 'ai';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import { INTENT_PALETTES, CATEGORY_PALETTES, type ChartCategory } from '../themes/palettes';

// =============================================================================
// Error Types
// =============================================================================

/**
 * Styler error: LLM call failed
 */
export class StylerLLMError extends Data.TaggedError('StylerLLMError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Styler error: invalid patch format
 */
export class InvalidPatchError extends Data.TaggedError('InvalidPatchError')<{
  readonly message: string;
  readonly line: string;
}> {}

export type ChartStylerAgentError = StylerLLMError | InvalidPatchError;

// =============================================================================
// Patch Schema (Effect Schema for validation)
// =============================================================================

/**
 * Schema for style patches emitted by the LLM.
 * Validates JSONL lines as they arrive.
 */
export const AgentStylePatchSchema = Schema.Struct({
  /** Patch type: palette, typography, animation, or complete */
  type: Schema.Literal('palette', 'typography', 'animation', 'complete'),
  /** Confidence level (0-1) */
  confidence: Schema.Number,
  /** Color palette (hex colors) */
  palette: Schema.optional(Schema.Array(Schema.String)),
  /** Typography configuration */
  typography: Schema.optional(
    Schema.Struct({
      family: Schema.String,
      size: Schema.Number,
      weight: Schema.optional(Schema.Number),
    })
  ),
  /** Animation configuration */
  animations: Schema.optional(
    Schema.Struct({
      appear: Schema.optional(
        Schema.Struct({
          animation: Schema.String,
          duration: Schema.Number,
          easing: Schema.optional(Schema.String),
        })
      ),
      update: Schema.optional(
        Schema.Struct({
          animation: Schema.String,
          duration: Schema.Number,
        })
      ),
    })
  ),
  /** Rationale for styling decisions (on complete) */
  rationale: Schema.optional(Schema.String),
});

export type AgentStylePatch = Schema.Schema.Type<typeof AgentStylePatchSchema>;

// =============================================================================
// Agent Input Types
// =============================================================================

/**
 * Input for per-chart styling request.
 */
export interface ChartStylerAgentInput {
  /** The chart ID being styled */
  readonly chartId: string;
  /** User prompt describing desired style */
  readonly prompt: string;
  /** Chart type (Line, Bar, Pie, etc.) */
  readonly chartType: string;
  /** Optional style intent (cyberpunk, minimal, etc.) */
  readonly intent?: string;
  /** Optional data context for data-aware styling */
  readonly dataContext?: {
    /** Field names in the data */
    readonly fields?: readonly string[];
    /** Data shape (e.g., "time-series", "categorical") */
    readonly shape?: string;
    /** Number of data rows */
    readonly rowCount?: number;
  };
}

/**
 * Effect Schema for agent input (for API validation)
 */
export const ChartStylerAgentInputSchema = Schema.Struct({
  chartId: Schema.String,
  prompt: Schema.String,
  chartType: Schema.String,
  intent: Schema.optional(Schema.String),
  dataContext: Schema.optional(
    Schema.Struct({
      fields: Schema.optional(Schema.Array(Schema.String)),
      shape: Schema.optional(Schema.String),
      rowCount: Schema.optional(Schema.Number),
    })
  ),
});

// =============================================================================
// System Prompt Builder
// =============================================================================

// =============================================================================
// System Prompt Builder with Catalog Integration
// =============================================================================

/**
 * Format palette as JSON array string for prompt
 */
const formatPalette = (colors: string[]): string =>
  JSON.stringify(colors);

/**
 * Build palette documentation from actual INTENT_PALETTES and CATEGORY_PALETTES
 */
const buildPaletteDocumentation = (): string => {
  const intentDocs = Object.entries(INTENT_PALETTES)
    .map(([intent, colors]) => `- "${intent}": ${formatPalette(colors)}`)
    .join('\n');

  const categoryDocs = Object.entries(CATEGORY_PALETTES)
    .map(([category, colors]) => `- "${category}": ${formatPalette(colors)}`)
    .join('\n');

  return `
## INTENT PALETTES (use when intent is specified)
${intentDocs}

## CATEGORY PALETTES (use based on chart type)
Chart type → category mapping:
- Line, Area, Stock → "trend"
- Bar, Column, Radar, Rose → "comparison"
- Pie, Treemap, Sunburst, Funnel → "part-to-whole"
- Scatter, Histogram, Box, Violin → "distribution"
- Sankey, Waterfall → "flow"
- Heatmap → "correlation"
- Organization → "hierarchy"
- NetworkGraph → "network"

${categoryDocs}
`;
};

/**
 * Map chart type to category for automatic palette selection
 */
const getChartCategory = (chartType: string): ChartCategory => {
  const mapping: Record<string, ChartCategory> = {
    Line: 'trend', Area: 'trend', Stock: 'trend',
    Bar: 'comparison', Column: 'comparison', Radar: 'comparison', Rose: 'comparison',
    Pie: 'part-to-whole', Treemap: 'part-to-whole', Sunburst: 'part-to-whole', Funnel: 'part-to-whole',
    Scatter: 'distribution', Histogram: 'distribution', Box: 'distribution', Violin: 'distribution',
    Sankey: 'flow', Waterfall: 'flow',
    Heatmap: 'correlation',
    Gauge: 'comparison',
  };
  return mapping[chartType] ?? 'comparison';
};

/**
 * Build the system prompt for chart style generation.
 * Includes actual palette definitions from the codebase.
 */
const buildStyleSystemPrompt = (input: ChartStylerAgentInput): string => {
  const dataContextSection = input.dataContext
    ? `
DATA CONTEXT:
- Fields: ${input.dataContext.fields?.join(', ') ?? 'unknown'}
- Shape: ${input.dataContext.shape ?? 'unknown'}
- Row count: ${input.dataContext.rowCount ?? 'unknown'}
`
    : '';

  // Get suggested palette based on intent or chart category
  const category = getChartCategory(input.chartType);
  const suggestedPalette = input.intent && INTENT_PALETTES[input.intent]
    ? INTENT_PALETTES[input.intent]
    : CATEGORY_PALETTES[category];

  return `You are a chart styling agent that outputs JSONL (JSON Lines) patches for progressive chart styling.

CHART CONTEXT:
- Chart ID: ${input.chartId}
- Chart Type: ${input.chartType}
- Category: ${category}
- Intent: ${input.intent ?? 'auto (use category palette)'}
- Suggested Palette: ${formatPalette(suggestedPalette)}
${dataContextSection}

## AVAILABLE PALETTES (use these exact colors)
${buildPaletteDocumentation()}

## OUTPUT FORMAT (JSONL - one JSON object per line)

CRITICAL RULES:
1. Output ONLY valid JSONL - NO markdown, NO explanation, NO code blocks, NO backticks
2. Each line is a complete JSON object
3. Output patches in order: palette → typography → animation → complete
4. confidence increases: 0.3 → 0.5 → 0.7 → 0.85+
5. "complete" patch includes rationale
6. USE the palette colors from above, don't invent random colors

PATCH SEQUENCE:

1. PALETTE (confidence: 0.3):
{"type":"palette","confidence":0.3,"palette":${formatPalette(suggestedPalette.slice(0, 3))}}

2. TYPOGRAPHY (confidence: 0.5) - include palette from step 1:
{"type":"typography","confidence":0.5,"palette":[...],"typography":{"family":"Inter","size":14,"weight":500}}

3. ANIMATION (confidence: 0.7) - include all previous:
{"type":"animation","confidence":0.7,"palette":[...],"typography":{...},"animations":{"appear":{"animation":"fadeIn","duration":500,"easing":"ease-out"},"update":{"animation":"morph","duration":300}}}

4. COMPLETE (confidence: 0.85+) - include all plus rationale:
{"type":"complete","confidence":0.85,"palette":[...],"typography":{...},"animations":{...},"rationale":"..."}

## ANIMATION OPTIONS
- appear.animation: "fadeIn", "scaleIn", "slideUp", "wipeIn", "growIn"
- appear.easing: "ease-out", "ease-in-out", "linear", "spring"
- appear.duration: 300-800ms
- update.animation: "morph", "fade", "slide"
- update.duration: 200-400ms

## TYPOGRAPHY GUIDELINES
- family: "Inter", "Space Grotesk", "JetBrains Mono" (for data-heavy)
- size: 12-16px (12 minimum)
- weight: 400 (normal), 500 (medium), 600 (semibold)

Now generate JSONL patches for: ${input.prompt}`;
};

// =============================================================================
// Agent Implementation
// =============================================================================

/**
 * Parse a JSONL line and validate with Effect Schema.
 */
const parsePatchLine = (
  line: string
): Effect.Effect<AgentStylePatch, InvalidPatchError> =>
  Effect.gen(function* () {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) {
      return yield* Effect.fail(
        new InvalidPatchError({
          message: 'Line is not valid JSON',
          line: trimmed,
        })
      );
    }

    const parsed = yield* Effect.try({
      try: () => JSON.parse(trimmed) as unknown,
      catch: (e) =>
        new InvalidPatchError({
          message: `JSON parse error: ${String(e)}`,
          line: trimmed,
        }),
    });

    const validated = yield* Schema.decodeUnknown(AgentStylePatchSchema)(parsed).pipe(
      Effect.mapError(
        (e) =>
          new InvalidPatchError({
            message: `Schema validation failed: ${String(e)}`,
            line: trimmed,
          })
      )
    );

    return validated;
  });

/**
 * Stream chart style patches from the LLM.
 *
 * Uses AI SDK streamText with raw text output.
 * The LLM's output ARE the patches - validated with Effect Schema.
 *
 * @example
 * ```ts
 * for await (const patch of streamChartStyleAgent({
 *   chartId: 'chart-1',
 *   prompt: 'Style with cyberpunk theme',
 *   chartType: 'Line',
 *   intent: 'cyberpunk'
 * })) {
 *   console.log(patch.type, patch.confidence, patch.palette);
 * }
 * ```
 */
export async function* streamChartStyleAgent(
  input: ChartStylerAgentInput
): AsyncGenerator<AgentStylePatch, AgentStylePatch, unknown> {
  const systemPrompt = buildStyleSystemPrompt(input);

  // Use AI SDK streamText - LLM outputs JSONL directly
  // The structured output ARE the patches
  const result = streamText({
    model: claudeCode('haiku', { cwd: process.cwd() }),
    system: systemPrompt,
    prompt: input.prompt,
  });

  // Accumulate text and parse complete lines
  let buffer = '';
  let lastPatch: AgentStylePatch = {
    type: 'palette',
    confidence: 0,
  };

  for await (const chunk of result.textStream) {
    buffer += chunk;

    // Process complete lines
    while (buffer.includes('\n')) {
      const newlineIdx = buffer.indexOf('\n');
      const line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);

      if (line.trim()) {
        // Validate line with Effect Schema
        const parseResult = Effect.runSync(
          parsePatchLine(line).pipe(
            Effect.catchAll((e) =>
              Effect.succeed({
                type: 'palette' as const,
                confidence: lastPatch.confidence,
                palette: lastPatch.palette,
                _parseError: e.message,
              })
            )
          )
        );

        // Only yield valid patches (no parse errors)
        if (!('_parseError' in parseResult)) {
          lastPatch = parseResult;
          yield lastPatch;
        }
      }
    }
  }

  // Handle any remaining content in buffer
  if (buffer.trim()) {
    const parseResult = Effect.runSync(
      parsePatchLine(buffer).pipe(Effect.catchAll(() => Effect.succeed(lastPatch)))
    );
    if (parseResult !== lastPatch) {
      lastPatch = parseResult;
      yield lastPatch;
    }
  }

  return lastPatch;
}

/**
 * Stream chart style as an Effect Stream.
 * Bridges async generator to Effect-native streaming.
 */
export const streamChartStyleAgentEffect = (
  input: ChartStylerAgentInput
): Stream.Stream<AgentStylePatch, ChartStylerAgentError> =>
  Stream.fromAsyncIterable(
    streamChartStyleAgent(input),
    (e) =>
      new StylerLLMError({
        message: `Stream error: ${String(e)}`,
        cause: e,
      })
  );

/**
 * Get complete style synchronously (collects all patches).
 */
export const generateChartStyleViaAgent = (
  input: ChartStylerAgentInput
): Effect.Effect<AgentStylePatch, ChartStylerAgentError> =>
  Effect.gen(function* () {
    let lastPatch: AgentStylePatch = { type: 'palette', confidence: 0 };

    yield* Stream.runForEach(streamChartStyleAgentEffect(input), (patch) =>
      Effect.sync(() => {
        lastPatch = patch;
      })
    );

    return lastPatch;
  });

// =============================================================================
// Registry Integration
// =============================================================================

import type { Registry } from '@effect-atom/atom';
import {
  chartStyleFamily,
  chartIsStreamingFamily,
  chartConfidenceFamily,
} from './atoms';
import type { ChartStyleId } from './schemas';

/**
 * Stream style updates directly into effect-atom registry.
 *
 * Updates the chart's style atoms as patches arrive from the LLM,
 * enabling reactive UI updates.
 */
export function streamStyleAgentToRegistry(
  registry: Registry.Registry,
  chartId: ChartStyleId,
  input: ChartStylerAgentInput
): Effect.Effect<AgentStylePatch, ChartStylerAgentError> {
  return Effect.gen(function* () {
    const styleAtom = chartStyleFamily(chartId);
    const streamingAtom = chartIsStreamingFamily(chartId);
    const confidenceAtom = chartConfidenceFamily(chartId);

    // Mark as streaming
    registry.set(streamingAtom, true);
    registry.set(confidenceAtom, 0);

    let lastPatch: AgentStylePatch = { type: 'palette', confidence: 0 };

    yield* Stream.runForEach(streamChartStyleAgentEffect(input), (patch) =>
      Effect.sync(() => {
        lastPatch = patch;
        registry.set(confidenceAtom, patch.confidence);

        // Update style state with patch data
        const currentStyle = registry.get(styleAtom);
        if (patch.palette && patch.palette.length > 0) {
          registry.set(styleAtom, {
            ...currentStyle,
            colorPalette: patch.palette,
            intent: input.intent ?? null,
          });
        }

        // Mark complete when done
        if (patch.type === 'complete') {
          registry.set(streamingAtom, false);
        }
      })
    );

    // Ensure streaming is marked complete
    registry.set(streamingAtom, false);

    return lastPatch;
  });
}

/**
 * Run style streaming with registry updates.
 */
export function runStyleAgentToRegistry(
  registry: Registry.Registry,
  chartId: ChartStyleId,
  input: ChartStylerAgentInput
): Promise<AgentStylePatch> {
  return Effect.runPromise(streamStyleAgentToRegistry(registry, chartId, input));
}

// =============================================================================
// Callback Interface (for React hooks)
// =============================================================================

/**
 * Options for streaming with callbacks.
 */
export interface StreamStyleAgentOptions {
  readonly input: ChartStylerAgentInput;
  readonly onPatch?: (patch: AgentStylePatch) => void;
  readonly onComplete?: (patch: AgentStylePatch) => void;
  readonly onError?: (error: string) => void;
}

/**
 * Stream styles with callback interface for React hooks.
 */
export function streamStyleAgentWithCallbacks(
  options: StreamStyleAgentOptions
): Effect.Effect<void, ChartStylerAgentError> {
  const { input, onPatch, onComplete, onError } = options;

  return Stream.runForEach(streamChartStyleAgentEffect(input), (patch) =>
    Effect.sync(() => {
      onPatch?.(patch);
      if (patch.type === 'complete') {
        onComplete?.(patch);
      }
    })
  ).pipe(
    Effect.catchAll((e) =>
      Effect.sync(() => {
        onError?.(e.message);
      })
    )
  );
}

// =============================================================================
// AI SDK Tool Wrapper
// =============================================================================

/**
 * Create an AI SDK streaming tool for chart styling.
 * Returns async generator that yields style patches.
 *
 * This tool can be used by other AI agents to style charts.
 */
export function createChartStylerAgentTool() {
  return {
    description: `Generate intelligent chart styling with progressive streaming.
Yields style patches with increasing confidence as styling progresses.

Output sequence:
1. palette (0.3): Initial color palette
2. typography (0.5): + Font configuration
3. animation (0.7): + Animation settings
4. complete (0.85+): Full style with rationale

Use when:
- User wants live style preview
- Progressive UI updates during styling
- Real-time feedback on style generation`,

    parameters: {
      type: 'object' as const,
      properties: {
        chartId: { type: 'string', description: 'Chart identifier' },
        prompt: { type: 'string', description: 'Style description/request' },
        chartType: {
          type: 'string',
          enum: ['Line', 'Bar', 'Pie', 'Area', 'Scatter', 'Radar', 'Gauge', 'Treemap', 'Heatmap', 'Funnel'],
          description: 'Chart type',
        },
        intent: {
          type: 'string',
          description: 'Style intent (cyberpunk, minimal, emphasize-trend, etc.)',
        },
      },
      required: ['chartId', 'prompt', 'chartType'],
    },

    execute: async function* (params: {
      chartId: string;
      prompt: string;
      chartType: string;
      intent?: string;
    }) {
      yield* streamChartStyleAgent({
        chartId: params.chartId,
        prompt: params.prompt,
        chartType: params.chartType,
        intent: params.intent,
      });
    },
  };
}
