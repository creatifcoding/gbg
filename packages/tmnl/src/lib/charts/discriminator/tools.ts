/**
 * Chart Discriminator Tools
 *
 * Tool definitions for LLM-augmented chart discrimination.
 * The LLM uses these tools to search, analyze, and score charts.
 *
 * @module charts/discriminator/tools
 */

import { Schema, JSONSchema } from 'effect';
import { tool, jsonSchema } from 'ai';
import type { ChartCatalog } from '../composable/ComposableCatalog';
import type { ChartDefinition, ChartCategory as ChartCategoryType } from '../registry/definitions';
import { CATEGORY_DESCRIPTIONS, getCategoryCatalog } from '../composable/categories';
import type { MiniSchema } from './schemas';

// =============================================================================
// Tool Parameter Schemas (Effect Schema)
// =============================================================================

/**
 * Parameters for search_charts tool
 */
export const SearchChartsParams = Schema.Struct({
  query: Schema.String.pipe(
    Schema.annotations({
      description: 'Keyword to search for in chart types, descriptions, or use cases',
    })
  ),
});
export type SearchChartsParams = typeof SearchChartsParams.Type;

/**
 * Chart category literal type
 */
export const ChartCategory = Schema.Literal(
  'comparison',
  'trend',
  'part-to-whole',
  'distribution',
  'ranking',
  'flow',
  'correlation',
  'kpi',
  'text',
  'hierarchical',
  'network'
);
export type ChartCategory = typeof ChartCategory.Type;

/**
 * Parameters for get_category_charts tool
 */
export const GetCategoryChartsParams = Schema.Struct({
  category: ChartCategory.pipe(
    Schema.annotations({
      description: 'Chart category to retrieve',
    })
  ),
});
export type GetCategoryChartsParams = typeof GetCategoryChartsParams.Type;

/**
 * Parameters for analyze_intent tool
 */
export const AnalyzeIntentParams = Schema.Struct({
  prompt: Schema.String.pipe(
    Schema.annotations({
      description: 'User prompt to analyze for visualization intent',
    })
  ),
});
export type AnalyzeIntentParams = typeof AnalyzeIntentParams.Type;

/**
 * Parameters for score_chart_fit tool
 */
export const ScoreChartFitParams = Schema.Struct({
  chartType: Schema.String.pipe(
    Schema.annotations({
      description: 'Chart type to evaluate',
    })
  ),
  intents: Schema.Array(Schema.String).pipe(
    Schema.annotations({
      description: 'Detected intents from prompt analysis',
    })
  ),
  dataShapes: Schema.Array(Schema.String).pipe(
    Schema.annotations({
      description: 'Detected data shapes from prompt analysis',
    })
  ),
});
export type ScoreChartFitParams = typeof ScoreChartFitParams.Type;

/**
 * Parameters for get_chart_schema tool
 */
export const GetChartSchemaParams = Schema.Struct({
  chartType: Schema.String.pipe(
    Schema.annotations({
      description: 'Chart type to get schema for',
    })
  ),
});
export type GetChartSchemaParams = typeof GetChartSchemaParams.Type;

// =============================================================================
// Tool Result Schemas (Effect Schema - TaggedStruct for Discrimination)
// =============================================================================

/**
 * Summary of a chart for tool results (untagged - used as nested data)
 */
export const ChartSummarySchema = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
  category: Schema.String,
  dataShapes: Schema.Array(Schema.String),
  useCases: Schema.Array(Schema.String),
});
export type ChartSummary = typeof ChartSummarySchema.Type;

/**
 * Chart match with relevance score (untagged - used in arrays)
 */
export const ChartMatchSchema = Schema.Struct({
  ...ChartSummarySchema.fields,
  relevance: Schema.Number,
  matchedOn: Schema.Array(Schema.String),
});
export type ChartMatch = typeof ChartMatchSchema.Type;

/**
 * Intent analysis result - TaggedStruct auto-adds _tag
 */
export const IntentAnalysisSchema = Schema.TaggedStruct('IntentAnalysis', {
  intents: Schema.Array(Schema.String),
  dataShapes: Schema.Array(Schema.String),
  mentions: Schema.Array(Schema.String),
  suggestedCategories: Schema.Array(Schema.String),
});
export type IntentAnalysis = typeof IntentAnalysisSchema.Type;

/**
 * Successful chart fit score - TaggedStruct
 */
export const ChartFitSuccessSchema = Schema.TaggedStruct('ChartFitSuccess', {
  chartType: Schema.String,
  score: Schema.Number,
  rationale: Schema.String,
  matchedIntents: Schema.Array(Schema.String),
  matchedDataShapes: Schema.Array(Schema.String),
});
export type ChartFitSuccess = typeof ChartFitSuccessSchema.Type;

/**
 * Chart not found error - TaggedStruct
 */
export const ChartNotFoundSchema = Schema.TaggedStruct('ChartNotFound', {
  chartType: Schema.String,
  message: Schema.String,
});
export type ChartNotFound = typeof ChartNotFoundSchema.Type;

/**
 * Chart fit score result - discriminated union
 */
export const ChartFitResultSchema = Schema.Union(
  ChartFitSuccessSchema,
  ChartNotFoundSchema
);
export type ChartFitResult = typeof ChartFitResultSchema.Type;

/**
 * Search results wrapper - TaggedStruct
 */
export const SearchResultSchema = Schema.TaggedStruct('SearchResult', {
  charts: Schema.Array(ChartMatchSchema),
  totalInCatalog: Schema.Number,
});
export type SearchResult = typeof SearchResultSchema.Type;

/**
 * Category charts result - TaggedStruct
 */
export const CategoryChartsResultSchema = Schema.TaggedStruct('CategoryChartsResult', {
  category: Schema.String,
  description: Schema.String,
  charts: Schema.Array(ChartSummarySchema),
});
export type CategoryChartsResult = typeof CategoryChartsResultSchema.Type;

/**
 * Mini-schema for a chart type (matches MiniSchema from ./schemas)
 */
export const MiniSchemaResultSchema = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
  category: Schema.String,
  dataShapes: Schema.Array(Schema.String),
  requiredFields: Schema.Array(Schema.String),
  supportsSeriesGrouping: Schema.Boolean,
  usageHint: Schema.String,
});

/**
 * Schema success result - TaggedStruct
 */
export const SchemaSuccessSchema = Schema.TaggedStruct('SchemaSuccess', {
  schema: MiniSchemaResultSchema,
});
export type SchemaSuccess = typeof SchemaSuccessSchema.Type;

/**
 * Schema result - discriminated union for get_chart_schema
 */
export const SchemaResultSchema = Schema.Union(
  SchemaSuccessSchema,
  ChartNotFoundSchema
);
export type SchemaResult = typeof SchemaResultSchema.Type;

// =============================================================================
// Tool Implementation Helpers
// =============================================================================

/**
 * Convert ChartDefinition to ChartSummary
 */
function toSummary(def: ChartDefinition): ChartSummary {
  return {
    type: def.type,
    description: def.description,
    category: def.category,
    dataShapes: Array.from(def.dataShapes),
    useCases: Array.from(def.useCases),
  };
}

/**
 * Search charts by keyword with relevance scoring
 */
function searchCharts(catalog: ChartCatalog, query: string): ChartMatch[] {
  const lower = query.toLowerCase();
  const matches: ChartMatch[] = [];

  for (const def of catalog) {
    const matchedOn: string[] = [];
    let relevance = 0;

    // Exact type match (highest relevance)
    if (def.type.toLowerCase() === lower) {
      relevance += 1.0;
      matchedOn.push('type (exact)');
    } else if (def.type.toLowerCase().includes(lower)) {
      relevance += 0.8;
      matchedOn.push('type (partial)');
    }

    // Category match
    if (def.category.toLowerCase().includes(lower)) {
      relevance += 0.6;
      matchedOn.push('category');
    }

    // Description match
    if (def.description.toLowerCase().includes(lower)) {
      relevance += 0.4;
      matchedOn.push('description');
    }

    // Use case match
    for (const useCase of def.useCases) {
      if (useCase.toLowerCase().includes(lower)) {
        relevance += 0.3;
        matchedOn.push(`useCase: ${useCase}`);
        break; // Only count once
      }
    }

    // Data shape match
    for (const shape of def.dataShapes) {
      if (shape.toLowerCase().includes(lower)) {
        relevance += 0.5;
        matchedOn.push(`dataShape: ${shape}`);
        break;
      }
    }

    if (relevance > 0) {
      matches.push({
        ...toSummary(def),
        relevance: Math.min(relevance, 1.0), // Cap at 1.0
        matchedOn,
      });
    }
  }

  // Sort by relevance descending
  return matches.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Analyze prompt for visualization intent
 */
function analyzePromptIntent(prompt: string): IntentAnalysis {
  const lower = prompt.toLowerCase();
  const intents: string[] = [];
  const dataShapes: string[] = [];
  const mentions: string[] = [];
  const suggestedCategories: string[] = [];

  // Intent patterns
  const intentPatterns: [RegExp, string, string][] = [
    [/\b(trend|over\s*time|temporal|history|growth|decline|change)\b/i, 'trend', 'trend'],
    [/\b(compare|comparison|versus|vs|against|between)\b/i, 'comparison', 'comparison'],
    [/\b(proportion|percentage|share|breakdown|composition|part)\b/i, 'part-to-whole', 'part-to-whole'],
    [/\b(distribution|spread|frequency|histogram|bell\s*curve)\b/i, 'distribution', 'distribution'],
    [/\b(rank|ranking|top|bottom|leaderboard|order)\b/i, 'ranking', 'ranking'],
    [/\b(flow|process|journey|pipeline|movement|stage)\b/i, 'flow', 'flow'],
    [/\b(correlation|relationship|matrix|association)\b/i, 'correlation', 'correlation'],
    [/\b(kpi|gauge|progress|meter|score|target)\b/i, 'progress', 'kpi'],
    [/\b(word|text|frequency|cloud|tag)\b/i, 'text-analysis', 'text'],
    [/\b(hierarchy|tree|org|organization|parent|child)\b/i, 'hierarchy', 'hierarchical'],
    [/\b(network|graph|node|edge|connection)\b/i, 'network', 'network'],
  ];

  for (const [pattern, intent, category] of intentPatterns) {
    if (pattern.test(lower)) {
      if (!intents.includes(intent)) intents.push(intent);
      if (!suggestedCategories.includes(category)) suggestedCategories.push(category);
    }
  }

  // Data shape patterns
  const dataShapePatterns: [RegExp, string][] = [
    [/\b(time|date|month|year|day|hour|weekly|monthly|yearly)\b/i, 'time-series'],
    [/\b(category|categorical|group|segment)\b/i, 'categorical'],
    [/\b(tree|nested|parent|children|hierarchy)\b/i, 'hierarchical'],
    [/\b(node|edge|graph|connection|link)\b/i, 'network'],
    [/\b(distribution|histogram|range)\b/i, 'distribution'],
    [/\b(series|multiple|several|different)\b/i, 'multi-series'],
    [/\b(single|one|total|overall|score|percentage)\b/i, 'single-value'],
  ];

  for (const [pattern, shape] of dataShapePatterns) {
    if (pattern.test(lower) && !dataShapes.includes(shape)) {
      dataShapes.push(shape);
    }
  }

  // Chart type mentions
  const chartMentions: [RegExp, string][] = [
    [/\bline\s*(chart|graph)?\b/i, 'Line'],
    [/\bbar\s*(chart|graph)?\b/i, 'Bar'],
    [/\bpie\s*(chart|graph)?\b/i, 'Pie'],
    [/\bscatter\b/i, 'Scatter'],
    [/\bheatmap\b/i, 'Heatmap'],
    [/\btreemap\b/i, 'Treemap'],
    [/\bsankey\b/i, 'Sankey'],
    [/\bgauge\b/i, 'Gauge'],
    [/\bfunnel\b/i, 'Funnel'],
    [/\barea\s*(chart|graph)?\b/i, 'Area'],
    [/\bcolumn\s*(chart|graph)?\b/i, 'Column'],
    [/\bradar\b/i, 'Radar'],
    [/\bhistogram\b/i, 'Histogram'],
    [/\bbox\s*(plot)?\b/i, 'Box'],
    [/\bviolin\b/i, 'Violin'],
    [/\bword\s*cloud\b/i, 'WordCloud'],
    [/\bsunburst\b/i, 'Sunburst'],
  ];

  for (const [pattern, chartType] of chartMentions) {
    if (pattern.test(lower) && !mentions.includes(chartType)) {
      mentions.push(chartType);
    }
  }

  // Default suggestions if none found
  if (intents.length === 0) {
    intents.push('visualization'); // Generic
  }
  if (suggestedCategories.length === 0) {
    suggestedCategories.push('comparison'); // Safe default
  }

  return IntentAnalysisSchema.make({
    intents,
    dataShapes,
    mentions,
    suggestedCategories,
  });
}

/**
 * Score how well a chart fits given intents and data shapes
 */
function scoreChartFit(
  def: ChartDefinition,
  intents: readonly string[],
  dataShapes: readonly string[]
): ChartFitSuccess {
  let score = 0;
  const matchedIntents: string[] = [];
  const matchedDataShapes: string[] = [];
  const rationales: string[] = [];

  // Category to intent mapping
  const categoryIntentMap: Record<string, string[]> = {
    'trend': ['trend', 'temporal', 'growth', 'change'],
    'comparison': ['comparison', 'compare', 'versus'],
    'part-to-whole': ['proportion', 'breakdown', 'composition', 'part-to-whole'],
    'distribution': ['distribution', 'spread', 'frequency'],
    'ranking': ['ranking', 'order', 'top'],
    'flow': ['flow', 'process', 'journey'],
    'correlation': ['correlation', 'relationship'],
    'kpi': ['progress', 'target', 'score'],
    'text': ['text-analysis', 'frequency'],
    'hierarchical': ['hierarchy', 'tree'],
    'network': ['network', 'graph'],
  };

  // Check category-intent alignment
  const categoryIntents = categoryIntentMap[def.category] || [];
  for (const intent of intents) {
    if (categoryIntents.includes(intent)) {
      score += 0.4;
      matchedIntents.push(intent);
      rationales.push(`Category '${def.category}' aligns with intent '${intent}'`);
    }
  }

  // Check data shape alignment
  for (const shape of dataShapes) {
    if (def.dataShapes.includes(shape as any)) {
      score += 0.3;
      matchedDataShapes.push(shape);
      rationales.push(`Supports data shape '${shape}'`);
    }
  }

  // Use case relevance boost
  const useCaseLower = def.useCases.map(u => u.toLowerCase()).join(' ');
  for (const intent of intents) {
    if (useCaseLower.includes(intent.toLowerCase())) {
      score += 0.2;
      rationales.push(`Use case mentions '${intent}'`);
    }
  }

  // Normalize score to 0-1
  score = Math.min(score, 1.0);

  return ChartFitSuccessSchema.make({
    chartType: def.type,
    score,
    rationale: rationales.length > 0 ? rationales.join('. ') : 'No specific alignment found',
    matchedIntents,
    matchedDataShapes,
  });
}

/**
 * Build MiniSchema from ChartDefinition
 */
function buildMiniSchema(def: ChartDefinition): MiniSchema {
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

// =============================================================================
// Tool Factory
// =============================================================================

/**
 * Create discriminator tools bound to a specific catalog
 *
 * @param catalog - The chart catalog to search/analyze
 * @returns Object containing all discriminator tools
 */
export function createDiscriminatorTools(catalog: ChartCatalog) {
  return {
    /**
     * Search for charts by keyword/pattern
     */
    search_charts: tool({
      description:
        'Find charts matching a keyword or pattern. Searches chart types, descriptions, use cases, and data shapes. Returns ranked matches with relevance scores.',
      inputSchema: jsonSchema<SearchChartsParams>(
        JSONSchema.make(SearchChartsParams) as Parameters<typeof jsonSchema>[0]
      ),
      execute: async ({ query }): Promise<SearchResult> => {
        const charts = searchCharts(catalog, query);
        return SearchResultSchema.make({
          charts: charts.slice(0, 10), // Limit to top 10
          totalInCatalog: catalog.size,
        });
      },
    }),

    /**
     * Get all charts in a category
     */
    get_category_charts: tool({
      description:
        'List all charts in a specific category. Categories: comparison, trend, part-to-whole, distribution, ranking, flow, correlation, kpi, text, hierarchical, network.',
      inputSchema: jsonSchema<GetCategoryChartsParams>(
        JSONSchema.make(GetCategoryChartsParams) as Parameters<typeof jsonSchema>[0]
      ),
      execute: async ({ category }): Promise<CategoryChartsResult> => {
        const categoryCatalog = getCategoryCatalog(category);
        const filtered = categoryCatalog
          ? catalog.intersection(categoryCatalog)
          : catalog.byCategory(category as ChartCategoryType);

        return CategoryChartsResultSchema.make({
          category,
          description: CATEGORY_DESCRIPTIONS[category] || '',
          charts: filtered.values().map(toSummary),
        });
      },
    }),

    /**
     * Analyze a prompt for visualization intent
     */
    analyze_intent: tool({
      description:
        'Parse a user prompt to detect visualization intents (trend, comparison, etc.), likely data shapes (time-series, categorical, etc.), and explicit chart type mentions.',
      inputSchema: jsonSchema<AnalyzeIntentParams>(
        JSONSchema.make(AnalyzeIntentParams) as Parameters<typeof jsonSchema>[0]
      ),
      execute: async ({ prompt }): Promise<IntentAnalysis> => {
        return analyzePromptIntent(prompt);
      },
    }),

    /**
     * Score how well a chart fits criteria
     */
    score_chart_fit: tool({
      description:
        'Evaluate how well a specific chart type matches given intents and data shapes. Returns a 0-1 score with detailed rationale.',
      inputSchema: jsonSchema<ScoreChartFitParams>(
        JSONSchema.make(ScoreChartFitParams) as Parameters<typeof jsonSchema>[0]
      ),
      execute: async ({ chartType, intents, dataShapes }): Promise<ChartFitResult> => {
        const def = catalog.get(chartType);
        if (!def) {
          return ChartNotFoundSchema.make({
            chartType,
            message: `Chart type '${chartType}' not found in catalog`,
          });
        }
        return scoreChartFit(def, intents, dataShapes);
      },
    }),

    /**
     * Get the full mini-schema for a chart type
     */
    get_chart_schema: tool({
      description:
        'Get detailed schema information for a chart type including required fields, data shapes, and configuration hints.',
      inputSchema: jsonSchema<GetChartSchemaParams>(
        JSONSchema.make(GetChartSchemaParams) as Parameters<typeof jsonSchema>[0]
      ),
      execute: async ({ chartType }): Promise<SchemaResult> => {
        const def = catalog.get(chartType);
        if (!def) {
          return ChartNotFoundSchema.make({
            chartType,
            message: `Chart type '${chartType}' not found in catalog`,
          });
        }
        return SchemaSuccessSchema.make({
          schema: buildMiniSchema(def),
        });
      },
    }),
  };
}

/**
 * Type for the tools object returned by createDiscriminatorTools
 */
export type DiscriminatorTools = ReturnType<typeof createDiscriminatorTools>;

// =============================================================================
// Utility Exports
// =============================================================================

export {
  searchCharts,
  analyzePromptIntent,
  scoreChartFit,
  buildMiniSchema,
  toSummary,
};
