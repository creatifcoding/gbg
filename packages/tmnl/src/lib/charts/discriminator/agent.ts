/**
 * Chart Discriminator Agent
 *
 * Effect.Service for chart type selection and configuration.
 * First-stage agent with FULL chart knowledge - downstream agents
 * receive only scoped mini-schemas.
 *
 * Uses AI SDK with generateText + Output.object (Effect Schema) for LLM-based discrimination.
 * The agent reads user prompts and outputs structured chart recommendations.
 *
 * @module charts/discriminator/agent
 */

import { Effect, Context, Layer, Data, Schema } from 'effect';
import { generateText, stepCountIs, type LanguageModel } from 'ai';
import { allCharts } from '../composable/categories';
import { ChartCatalog } from '../composable/ComposableCatalog';
import {
  type DiscriminatorInput,
  type DiscriminatorOutput,
  type MiniSchema,
  type SelectionConstraints,
  DiscriminatorOutputSchema,
} from './schemas';
import {
  generateSystemPrompt,
  generateScopedPrompt,
} from './prompt-template';
import { createDiscriminatorTools } from './tools';
import type { ChartDefinition } from '../registry/definitions';

// =============================================================================
// Error Types
// =============================================================================

/**
 * Discriminator error: no suitable chart found
 */
export class NoSuitableChartError extends Data.TaggedError('NoSuitableChartError')<{
  readonly message: string;
  readonly consideredOptions: readonly string[];
}> {}

/**
 * Discriminator error: invalid input
 */
export class InvalidInputError extends Data.TaggedError('InvalidInputError')<{
  readonly message: string;
  readonly field: string;
}> {}

/**
 * Discriminator error: ambiguous request needing clarification
 */
export class AmbiguousRequestError extends Data.TaggedError('AmbiguousRequestError')<{
  readonly message: string;
  readonly clarificationNeeded: readonly string[];
}> {}

/**
 * Discriminator error: LLM call failed
 */
export class LLMError extends Data.TaggedError('LLMError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type DiscriminatorError =
  | NoSuitableChartError
  | InvalidInputError
  | AmbiguousRequestError
  | LLMError;

// =============================================================================
// ChartDiscriminator Service Interface
// =============================================================================

/**
 * Configuration for the ChartDiscriminator service
 */
export interface ChartDiscriminatorConfig {
  /** Language model to use for discrimination */
  readonly model: LanguageModel;
}

/**
 * ChartDiscriminator service interface
 */
export interface ChartDiscriminator {
  /**
   * Select chart type(s) based on user input using LLM
   */
  readonly discriminate: (
    input: DiscriminatorInput
  ) => Effect.Effect<DiscriminatorOutput, DiscriminatorError>;

  /**
   * Get the system prompt for chart discrimination
   */
  readonly getSystemPrompt: (
    constraints?: SelectionConstraints
  ) => string;

  /**
   * Get mini-schema for a specific chart type
   */
  readonly getMiniSchema: (chartType: string) => MiniSchema | null;

  /**
   * Get scoped prompt for downstream agents
   */
  readonly getScopedPrompt: (chartTypes: string[]) => string;

  /**
   * Get the catalog (for advanced use cases)
   */
  readonly getCatalog: () => ChartCatalog;
}

/**
 * Context.Tag for ChartDiscriminator
 */
export const ChartDiscriminator = Context.GenericTag<ChartDiscriminator>(
  'charts/ChartDiscriminator'
);

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create the ChartDiscriminator service implementation
 *
 * @param config - Configuration including the language model
 */
export const makeChartDiscriminator = (config?: ChartDiscriminatorConfig): ChartDiscriminator => {
  /**
   * Core discrimination logic via LLM with tool augmentation
   *
   * Uses generateText with tools for structured chart selection.
   * The LLM can use tools to search, analyze, and score charts before
   * outputting a final structured recommendation.
   */
  const discriminate = (
    input: DiscriminatorInput
  ): Effect.Effect<DiscriminatorOutput, DiscriminatorError> =>
    Effect.gen(function* () {
      const { userPrompt, dataContext, constraints } = input;

      // Build the effective catalog based on constraints
      const effectiveCatalog = buildEffectiveCatalog(constraints);

      // Build the system prompt with tool-augmented instructions
      const systemPrompt = generateToolAugmentedSystemPrompt(constraints);

      // Build the user message with context
      let userMessage = userPrompt;
      if (dataContext) {
        userMessage += '\n\n## Data Context\n';
        if (dataContext.fields) {
          userMessage += `Fields: ${dataContext.fields.join(', ')}\n`;
        }
        if (dataContext.inferredShape) {
          userMessage += `Data shape: ${dataContext.inferredShape}\n`;
        }
        if (dataContext.rowCount) {
          userMessage += `Row count: ${dataContext.rowCount}\n`;
        }
      }

      // If no model configured, use a fallback heuristic approach
      // (for testing without an LLM)
      if (!config?.model) {
        return yield* fallbackDiscriminate(input, constraints);
      }

      // Create tools bound to the effective catalog
      const tools = createDiscriminatorTools(effectiveCatalog);

      // Call the LLM with tools and multi-step capability
      const result = yield* Effect.tryPromise({
        try: () =>
          generateText({
            model: config.model,
            system: systemPrompt,
            prompt: userMessage,
            tools,
            stopWhen: stepCountIs(5), // Allow up to 5 tool calls
          }),
        catch: (error) =>
          new LLMError({
            message: `LLM call failed: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          }),
      });

      // Extract JSON from the final response text
      const text = result.text;
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
                        text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return yield* Effect.fail(
          new LLMError({
            message: 'LLM response did not contain valid JSON',
          })
        );
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];

      // Parse and validate with Effect Schema
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        return yield* Effect.fail(
          new LLMError({
            message: `Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`,
            cause: e,
          })
        );
      }

      // Validate against the schema
      const validated = yield* Schema.decodeUnknown(DiscriminatorOutputSchema)(parsed).pipe(
        Effect.mapError((e) =>
          new LLMError({
            message: `LLM response did not match schema: ${String(e)}`,
            cause: e,
          })
        )
      );

      return validated;
    });

  const getSystemPrompt = (constraints?: SelectionConstraints): string => {
    return generateSystemPrompt(constraints);
  };

  const getMiniSchema = (chartType: string): MiniSchema | null => {
    const def = allCharts.get(chartType);
    if (!def) return null;
    return buildMiniSchemaObject(def);
  };

  const getScopedPrompt = (chartTypes: string[]): string => {
    return generateScopedPrompt(chartTypes);
  };

  const getCatalog = (): ChartCatalog => {
    return allCharts;
  };

  return {
    discriminate,
    getSystemPrompt,
    getMiniSchema,
    getScopedPrompt,
    getCatalog,
  };
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build effective catalog based on selection constraints.
 * Applies onlyTypes (whitelist) and excludeTypes (blacklist) filters.
 */
function buildEffectiveCatalog(constraints?: SelectionConstraints): ChartCatalog {
  let catalog = allCharts;

  if (constraints?.onlyTypes && constraints.onlyTypes.length > 0) {
    catalog = catalog.pick(...constraints.onlyTypes);
  }

  if (constraints?.excludeTypes && constraints.excludeTypes.length > 0) {
    catalog = catalog.omit(...constraints.excludeTypes);
  }

  return catalog;
}

/**
 * Generate system prompt with tool-augmented instructions.
 * Describes how the LLM should use available tools to select charts.
 */
function generateToolAugmentedSystemPrompt(constraints?: SelectionConstraints): string {
  const catalog = buildEffectiveCatalog(constraints);
  const availableTypes = [...catalog].map(d => d.type).join(', ');

  return `# Chart Discriminator Agent

You are a chart selection agent. Your job is to analyze user requests and recommend the most appropriate chart type(s) for data visualization.

## Available Tools

You have access to the following tools to help you make informed decisions:

1. **search_charts** - Search for charts by keyword. Use this to find charts that match specific concepts.
2. **get_category_charts** - Get all charts in a category (comparison, trend, part-to-whole, etc.)
3. **analyze_intent** - Analyze a user prompt to extract visualization intents and data shape signals.
4. **score_chart_fit** - Score how well a specific chart matches given intents and data shapes.
5. **get_chart_schema** - Get detailed schema information for a specific chart type.

## Your Process

1. First, use **analyze_intent** on the user's prompt to understand what they want to visualize.
2. Based on the intents and data shapes detected, use **search_charts** or **get_category_charts** to find candidate charts.
3. For promising candidates, use **score_chart_fit** to evaluate their suitability.
4. Use **get_chart_schema** to get details for your top recommendations.
5. Finally, output your structured recommendation as JSON.

## Available Chart Types

${availableTypes}

## Output Format

After using tools to research, output a JSON object with this structure:

\`\`\`json
{
  "primary": {
    "chartType": "Line",
    "config": {
      "xField": "date",
      "yField": "value"
    },
    "confidence": 0.85,
    "rationale": "Why this chart was selected",
    "expectedInsight": "What insight this chart will provide"
  },
  "alternatives": [
    {
      "chartType": "Area",
      "config": {},
      "confidence": 0.7,
      "rationale": "Alternative option rationale",
      "expectedInsight": "Alternative insight"
    }
  ],
  "miniSchemas": [
    {
      "type": "Line",
      "description": "A line chart for trends",
      "category": "trend",
      "dataShapes": ["time-series", "multi-series"],
      "requiredFields": ["xField", "yField"],
      "supportsSeriesGrouping": true,
      "usageHint": "Ideal for time-series data; Show trends over time"
    }
  ],
  "consideredCategories": ["trend", "comparison"],
  "reasoning": "Overall reasoning about the selection process",
  "wasAmbiguous": false
}
\`\`\`

**CRITICAL: miniSchemas must include ALL fields for each entry:**
- \`type\` (required): The exact chart type name (e.g., "Line", "Bar", "Pie")
- \`description\` (required): Brief description of the chart
- \`category\` (required): The chart's category
- \`dataShapes\` (required): Array of supported data shapes
- \`requiredFields\` (required): Array of required field names
- \`supportsSeriesGrouping\` (required): Boolean indicating series support
- \`usageHint\` (required): Example use cases joined by semicolon

## Guidelines

- Always use at least one tool before making a recommendation
- Prefer charts that match the detected data shape
- Consider the user's explicit requests (if they ask for a "pie chart", prioritize Pie)
- Provide alternatives when there are multiple good options
- Set wasAmbiguous=true if the request is unclear and you had to make assumptions
`;
}

/**
 * Build MiniSchema object from ChartDefinition
 */
function buildMiniSchemaObject(def: ChartDefinition): MiniSchema {
  return {
    type: def.type,
    description: def.description,
    category: def.category,
    dataShapes: Array.from(def.dataShapes),
    requiredFields: def.requiredFields ? Array.from(def.requiredFields) : [],
    supportsSeriesGrouping: def.seriesField ?? false,
    usageHint: Array.from(def.useCases).slice(0, 3).join('; '),
  };
}

/**
 * Fallback discrimination for testing without an LLM.
 *
 * Uses simple keyword matching to select a chart.
 * This is NOT production-quality - it's just for tests.
 */
function fallbackDiscriminate(
  input: DiscriminatorInput,
  constraints?: SelectionConstraints
): Effect.Effect<DiscriminatorOutput, DiscriminatorError> {
  return Effect.gen(function* () {
    const { userPrompt } = input;
    const lower = userPrompt.toLowerCase();

    // Build effective catalog based on constraints
    let catalog = allCharts;

    if (constraints?.onlyTypes && constraints.onlyTypes.length > 0) {
      catalog = catalog.pick(...constraints.onlyTypes);
    }

    if (constraints?.excludeTypes && constraints.excludeTypes.length > 0) {
      catalog = catalog.omit(...constraints.excludeTypes);
    }

    if (catalog.isEmpty()) {
      return yield* Effect.fail(
        new NoSuitableChartError({
          message: 'No charts available after applying constraints',
          consideredOptions: [],
        })
      );
    }

    // Simple keyword-based chart selection
    let selectedType = 'Bar'; // default
    let category = 'comparison';

    // Explicit chart mentions take priority
    const chartMentions: [RegExp, string][] = [
      [/\bheatmap\b/i, 'Heatmap'],
      [/\bline\s*(chart|graph)?\b/i, 'Line'],
      [/\barea\s*(chart|graph)?\b/i, 'Area'],
      [/\bbar\s*(chart|graph)?\b/i, 'Bar'],
      [/\bcolumn\s*(chart|graph)?\b/i, 'Column'],
      [/\bpie\s*(chart|graph)?\b/i, 'Pie'],
      [/\bscatter\b/i, 'Scatter'],
      [/\btreemap\b/i, 'Treemap'],
      [/\bsunburst\b/i, 'Sunburst'],
      [/\bsankey\b/i, 'Sankey'],
      [/\bfunnel\b/i, 'Funnel'],
      [/\bgauge\b/i, 'Gauge'],
      [/\bstock\b/i, 'Stock'],
      [/\bhistogram\b/i, 'Histogram'],
      [/\bbox\s*(plot)?\b/i, 'Box'],
      [/\bviolin\b/i, 'Violin'],
      [/\bword\s*cloud\b/i, 'WordCloud'],
      [/\bnetwork\s*(graph)?\b/i, 'NetworkGraph'],
      [/\bflow\s*(chart|graph)?\b/i, 'FlowGraph'],
      [/\borg\s*(chart)?\b/i, 'OrganizationChart'],
      [/\bmind\s*map\b/i, 'MindMap'],
    ];

    for (const [pattern, chartType] of chartMentions) {
      if (pattern.test(lower) && catalog.has(chartType)) {
        selectedType = chartType;
        const def = catalog.get(chartType);
        category = def?.category ?? 'comparison';
        break;
      }
    }

    // If no explicit mention, use category patterns
    if (selectedType === 'Bar') {
      const categoryPatterns: [RegExp, string, string][] = [
        [/\b(trend|over\s*time|temporal|history|growth|decline)\b/i, 'Line', 'trend'],
        [/\b(proportion|percentage|share|breakdown|market\s*share)\b/i, 'Pie', 'part-to-whole'],
        [/\b(distribution|spread|frequency)\b/i, 'Histogram', 'distribution'],
        [/\b(rank|ranking|top|bottom|leaderboard)\b/i, 'Funnel', 'ranking'],
        [/\b(flow|process|journey|pipeline)\b/i, 'Sankey', 'flow'],
        [/\b(correlation|relationship|matrix)\b/i, 'Heatmap', 'correlation'],
        [/\b(kpi|gauge|progress|meter|score)\b/i, 'Gauge', 'kpi'],
        [/\b(compare|comparison|versus|vs)\b/i, 'Bar', 'comparison'],
      ];

      for (const [pattern, chartType, cat] of categoryPatterns) {
        if (pattern.test(lower) && catalog.has(chartType)) {
          selectedType = chartType;
          category = cat;
          break;
        }
      }
    }

    const def = catalog.get(selectedType);
    if (!def) {
      // Fall back to first available chart
      const first = [...catalog][0];
      if (!first) {
        return yield* Effect.fail(
          new NoSuitableChartError({
            message: 'No suitable chart found',
            consideredOptions: [],
          })
        );
      }
      selectedType = first.type;
      category = first.category;
    }

    const selectedDef = catalog.get(selectedType)!;

    const primary = {
      chartType: selectedDef.type,
      config: {},
      confidence: 0.7,
      rationale: `Selected ${selectedDef.type} based on prompt analysis`,
      expectedInsight: selectedDef.useCases[0] || `Visualize data using ${selectedDef.type}`,
    };

    // Get alternatives from same category
    const alternatives = [...catalog.byCategory(selectedDef.category)]
      .filter(d => d.type !== selectedType)
      .slice(0, 2)
      .map(d => ({
        chartType: d.type,
        config: {},
        confidence: 0.5,
        rationale: `Alternative ${d.category} chart`,
        expectedInsight: d.useCases[0] || `Visualize data using ${d.type}`,
      }));

    // Build mini-schemas for all recommended charts
    const miniSchemas = [selectedDef, ...alternatives.map(a => catalog.get(a.chartType)!)]
      .filter(Boolean)
      .map(buildMiniSchemaObject);

    return {
      primary,
      alternatives,
      miniSchemas,
      consideredCategories: [category],
      reasoning: `Fallback selection based on keyword matching in prompt`,
      wasAmbiguous: false,
    };
  });
}

// =============================================================================
// Layer
// =============================================================================

/**
 * Default layer for ChartDiscriminator (no LLM, uses fallback)
 */
export const ChartDiscriminatorLive = Layer.succeed(
  ChartDiscriminator,
  makeChartDiscriminator()
);

/**
 * Create a layer with a specific language model
 */
export const makeChartDiscriminatorLayer = (config: ChartDiscriminatorConfig) =>
  Layer.succeed(ChartDiscriminator, makeChartDiscriminator(config));
