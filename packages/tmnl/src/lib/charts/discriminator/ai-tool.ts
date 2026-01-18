/**
 * Chart Discriminator AI Tool
 *
 * AI SDK tool wrapper that exposes the chart discriminator as a callable tool
 * for external AI agents. This is a single tool that wraps the full discriminator
 * functionality, unlike the internal tools used by the discriminator agent itself.
 *
 * Usage:
 * ```typescript
 * import { createChartDiscriminatorTool } from '@/lib/charts/discriminator/ai-tool'
 *
 * // In your AI agent setup
 * const tools = {
 *   chart_discriminator: createChartDiscriminatorTool({ model: yourModel }),
 * }
 * ```
 *
 * @module charts/discriminator/ai-tool
 */

import { tool, jsonSchema } from 'ai';
import { Effect, JSONSchema } from 'effect';
import { makeChartDiscriminator, type ChartDiscriminatorConfig } from './agent';
import { DiscriminatorInputSchema, type DiscriminatorInput } from './schemas';

// =============================================================================
// Tool Result Schema
// =============================================================================

/**
 * Simplified output for AI agents consuming the discriminator result
 */
export interface ChartDiscriminatorToolResult {
  /** Primary recommended chart type */
  chartType: string;
  /** Recommended field configuration */
  config: {
    xField?: string;
    yField?: string;
    seriesField?: string;
    colorField?: string;
    angleField?: string;
    valueField?: string;
    sourceField?: string;
    targetField?: string;
    additional?: unknown;
  };
  /** Confidence score (0-1) */
  confidence: number;
  /** Explanation of why this chart was selected */
  rationale: string;
  /** What insight this chart will reveal */
  expectedInsight: string;
  /** Alternative chart options */
  alternatives: Array<{
    chartType: string;
    confidence: number;
  }>;
  /** Whether the request was ambiguous */
  wasAmbiguous: boolean;
  /** Overall selection reasoning */
  reasoning: string;
}

/**
 * Error result when discrimination fails
 */
export interface ChartDiscriminatorToolError {
  error: true;
  errorType: 'NoSuitableChart' | 'InvalidInput' | 'AmbiguousRequest' | 'LLMError';
  message: string;
  details?: unknown;
}

export type ChartDiscriminatorToolOutput =
  | ChartDiscriminatorToolResult
  | ChartDiscriminatorToolError;

// =============================================================================
// Tool Factory
// =============================================================================

/**
 * Create a chart discriminator tool for AI SDK integration.
 *
 * This tool wraps the full ChartDiscriminator service, allowing external AI
 * agents to request chart type selection with a single tool call.
 *
 * The discriminator uses LLM-augmented reasoning (with internal tools) to:
 * 1. Analyze user intent from the prompt
 * 2. Search for matching chart types
 * 3. Score candidates against the data context
 * 4. Return ranked recommendations
 *
 * @param config - Optional configuration with language model
 * @returns AI SDK tool for chart discrimination
 *
 * @example
 * ```typescript
 * import { anthropic } from '@ai-sdk/anthropic'
 * import { createChartDiscriminatorTool } from '@/lib/charts/discriminator/ai-tool'
 *
 * const tools = {
 *   chart_discriminator: createChartDiscriminatorTool({
 *     model: anthropic('claude-3-5-sonnet-20241022'),
 *   }),
 * }
 *
 * // In generateText or agent loop
 * const result = await generateText({
 *   model: myModel,
 *   tools,
 *   prompt: "Show me a chart of sales trends over time",
 * })
 * ```
 */
export function createChartDiscriminatorTool(config?: ChartDiscriminatorConfig) {
  const discriminator = makeChartDiscriminator(config);

  return tool({
    description: `Select the optimal chart type for data visualization.

Analyzes user prompts and optional data context to recommend the best chart type.
Returns the primary recommendation with confidence score, configuration hints,
and alternative options.

Use this tool when:
- The user wants to visualize data but hasn't specified a chart type
- You need to select the most appropriate chart for given data
- You want intelligent chart type recommendations based on data shape

Input:
- userPrompt: Natural language description of what to visualize
- dataContext (optional): Information about the data (fields, shape, row count)
- constraints (optional): Whitelist/blacklist chart types or categories

Output:
- chartType: Recommended chart type (e.g., "Line", "Bar", "Pie")
- config: Field mappings (xField, yField, seriesField, etc.)
- confidence: 0-1 score for the recommendation
- rationale: Why this chart was selected
- alternatives: Other good options
- wasAmbiguous: Whether the request needed assumptions`,

    inputSchema: jsonSchema<DiscriminatorInput>(
      JSONSchema.make(DiscriminatorInputSchema) as Parameters<typeof jsonSchema>[0]
    ),

    execute: async (input: DiscriminatorInput): Promise<ChartDiscriminatorToolOutput> => {
      const result = await Effect.runPromise(
        discriminator.discriminate(input).pipe(
          Effect.map((output): ChartDiscriminatorToolResult => ({
            chartType: output.primary.chartType,
            config: output.primary.config,
            confidence: output.primary.confidence,
            rationale: output.primary.rationale,
            expectedInsight: output.primary.expectedInsight,
            alternatives: output.alternatives.map(alt => ({
              chartType: alt.chartType,
              confidence: alt.confidence,
            })),
            wasAmbiguous: output.wasAmbiguous,
            reasoning: output.reasoning,
          })),
          Effect.catchAll((error): Effect.Effect<ChartDiscriminatorToolError> => {
            const errorResult: ChartDiscriminatorToolError = {
              error: true,
              errorType: 'LLMError',
              message: 'Unknown error',
            };

            if ('_tag' in error) {
              switch (error._tag) {
                case 'NoSuitableChartError':
                  errorResult.errorType = 'NoSuitableChart';
                  errorResult.message = error.message;
                  errorResult.details = { consideredOptions: error.consideredOptions };
                  break;
                case 'InvalidInputError':
                  errorResult.errorType = 'InvalidInput';
                  errorResult.message = error.message;
                  errorResult.details = { field: error.field };
                  break;
                case 'AmbiguousRequestError':
                  errorResult.errorType = 'AmbiguousRequest';
                  errorResult.message = error.message;
                  errorResult.details = { clarificationNeeded: error.clarificationNeeded };
                  break;
                case 'LLMError':
                  errorResult.errorType = 'LLMError';
                  errorResult.message = error.message;
                  errorResult.details = { cause: error.cause };
                  break;
              }
            }

            return Effect.succeed(errorResult);
          })
        )
      );

      return result;
    },
  });
}

/**
 * Type for the discriminator tool
 */
export type ChartDiscriminatorTool = ReturnType<typeof createChartDiscriminatorTool>;
