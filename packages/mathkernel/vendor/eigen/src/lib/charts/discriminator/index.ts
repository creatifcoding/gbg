/**
 * Chart Discriminator
 *
 * First-stage chart selection agent with full chart knowledge.
 *
 * @module charts/discriminator
 */

// Schemas
export {
  DataContextSchema,
  SelectionConstraintsSchema,
  DiscriminatorInputSchema,
  ChartRecommendationSchema,
  MiniSchemaSchema,
  DiscriminatorOutputSchema,
  DiscriminatorErrorSchema,
  type DataContext,
  type SelectionConstraints,
  type DiscriminatorInput,
  type ChartRecommendation,
  type MiniSchema,
  type DiscriminatorOutput,
  type DiscriminatorError,
} from './schemas';

// Agent
export {
  ChartDiscriminator,
  ChartDiscriminatorLive,
  makeChartDiscriminator,
  makeChartDiscriminatorLayer,
  NoSuitableChartError,
  InvalidInputError,
  AmbiguousRequestError,
  LLMError,
  type ChartDiscriminatorConfig,
  type DiscriminatorError as DiscriminatorAgentError,
} from './agent';

// Prompt generation
export {
  generateSystemPrompt,
  generateMiniSchema,
  generateMiniSchemas,
  generateScopedPrompt,
} from './prompt-template';

// Tools (internal - used by discriminator agent)
export {
  createDiscriminatorTools,
  SearchChartsParams,
  GetCategoryChartsParams,
  AnalyzeIntentParams,
  ScoreChartFitParams,
  GetChartSchemaParams,
  SearchResultSchema,
  IntentAnalysisSchema,
  ChartFitSuccessSchema,
  ChartNotFoundSchema,
  ChartFitResultSchema,
  type SearchChartsParams as SearchChartsParamsType,
  type GetCategoryChartsParams as GetCategoryChartsParamsType,
  type AnalyzeIntentParams as AnalyzeIntentParamsType,
  type ScoreChartFitParams as ScoreChartFitParamsType,
  type GetChartSchemaParams as GetChartSchemaParamsType,
  type SearchResult,
  type IntentAnalysis,
  type ChartFitSuccess,
  type ChartNotFound,
  type ChartFitResult,
} from './tools';

// AI Tool (external - for other AI agents to call)
export {
  createChartDiscriminatorTool,
  type ChartDiscriminatorTool,
  type ChartDiscriminatorToolResult,
  type ChartDiscriminatorToolError,
  type ChartDiscriminatorToolOutput,
} from './ai-tool';
