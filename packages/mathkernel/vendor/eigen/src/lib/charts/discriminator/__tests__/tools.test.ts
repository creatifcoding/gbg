/**
 * Chart Discriminator Tools Tests
 *
 * Unit tests for tool functions used in LLM-augmented chart discrimination.
 * Tests the underlying helper functions directly since they're exported.
 */

import { describe, it, expect } from 'vitest';
import { allCharts } from '../../composable/categories';
import {
  createDiscriminatorTools,
  searchCharts,
  analyzePromptIntent,
  scoreChartFit,
  buildMiniSchema,
  toSummary,
} from '../tools';

describe('Discriminator Tools Factory', () => {
  it('creates all required tools', () => {
    const tools = createDiscriminatorTools(allCharts);

    expect(tools).toHaveProperty('search_charts');
    expect(tools).toHaveProperty('get_category_charts');
    expect(tools).toHaveProperty('analyze_intent');
    expect(tools).toHaveProperty('score_chart_fit');
    expect(tools).toHaveProperty('get_chart_schema');
  });

  it('tools have descriptions', () => {
    const tools = createDiscriminatorTools(allCharts);

    expect(tools.search_charts.description).toBeTruthy();
    expect(tools.get_category_charts.description).toBeTruthy();
    expect(tools.analyze_intent.description).toBeTruthy();
    expect(tools.score_chart_fit.description).toBeTruthy();
    expect(tools.get_chart_schema.description).toBeTruthy();
  });

  it('tools have inputSchema defined', () => {
    const tools = createDiscriminatorTools(allCharts);

    // Each tool should have inputSchema defined (AI SDK v4)
    expect(tools.search_charts.inputSchema).toBeDefined();
    expect(tools.get_category_charts.inputSchema).toBeDefined();
    expect(tools.analyze_intent.inputSchema).toBeDefined();
    expect(tools.score_chart_fit.inputSchema).toBeDefined();
    expect(tools.get_chart_schema.inputSchema).toBeDefined();
  });
});

describe('searchCharts', () => {
  it('finds charts by keyword match on type', () => {
    const results = searchCharts(allCharts, 'line');

    expect(results.some(c => c.type === 'Line')).toBe(true);
  });

  it('finds charts by keyword match on category', () => {
    const results = searchCharts(allCharts, 'trend');

    expect(results.length).toBeGreaterThan(0);
    // Should find charts in trend category
    expect(results.some(c => c.category === 'trend')).toBe(true);
  });

  it('finds charts by keyword match on description', () => {
    const results = searchCharts(allCharts, 'time');

    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty array for non-matching keyword', () => {
    const results = searchCharts(allCharts, 'xyznonexistent');

    expect(results.length).toBe(0);
  });

  it('sorts results by relevance descending', () => {
    const results = searchCharts(allCharts, 'line');

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].relevance).toBeGreaterThanOrEqual(results[i].relevance);
    }
  });

  it('caps relevance score at 1.0', () => {
    const results = searchCharts(allCharts, 'line');

    for (const result of results) {
      expect(result.relevance).toBeLessThanOrEqual(1.0);
    }
  });

  it('includes matchedOn field indicating where match occurred', () => {
    const results = searchCharts(allCharts, 'trend');

    const hasMatchedOn = results.some(r => r.matchedOn.length > 0);
    expect(hasMatchedOn).toBe(true);
  });

  it('assigns higher relevance to exact type matches', () => {
    const results = searchCharts(allCharts, 'Bar');

    const barMatch = results.find(r => r.type === 'Bar');
    expect(barMatch).toBeDefined();
    expect(barMatch!.relevance).toBeGreaterThanOrEqual(0.8);
    expect(barMatch!.matchedOn.some(m => m.includes('type'))).toBe(true);
  });
});

describe('analyzePromptIntent', () => {
  it('returns all required fields', () => {
    const result = analyzePromptIntent('test prompt');

    expect(result).toHaveProperty('_tag', 'IntentAnalysis');
    expect(result).toHaveProperty('intents');
    expect(result).toHaveProperty('dataShapes');
    expect(result).toHaveProperty('mentions');
    expect(result).toHaveProperty('suggestedCategories');
  });

  it('detects trend intent from time keywords', () => {
    const result = analyzePromptIntent('Show me the sales trend over time');

    expect(result.intents).toContain('trend');
    expect(result.suggestedCategories).toContain('trend');
  });

  it('detects comparison intent', () => {
    const result = analyzePromptIntent('Compare revenue between regions');

    expect(result.intents).toContain('comparison');
    expect(result.suggestedCategories).toContain('comparison');
  });

  it('detects part-to-whole intent', () => {
    const result = analyzePromptIntent('Show the market share breakdown by company');

    expect(result.intents).toContain('part-to-whole');
  });

  it('detects distribution intent', () => {
    const result = analyzePromptIntent('Show the distribution of values');

    expect(result.intents).toContain('distribution');
    expect(result.suggestedCategories).toContain('distribution');
  });

  it('detects flow intent', () => {
    const result = analyzePromptIntent('Visualize the user journey through the process');

    expect(result.intents).toContain('flow');
    expect(result.suggestedCategories).toContain('flow');
  });

  it('detects time-series data shape', () => {
    const result = analyzePromptIntent('Display monthly sales figures');

    expect(result.dataShapes).toContain('time-series');
  });

  it('detects categorical data shape', () => {
    const result = analyzePromptIntent('Group by category and segment');

    expect(result.dataShapes).toContain('categorical');
  });

  it('detects hierarchical data shape', () => {
    const result = analyzePromptIntent('Show parent-child relationships in tree');

    expect(result.dataShapes).toContain('hierarchical');
  });

  it('detects explicit chart mentions', () => {
    const result = analyzePromptIntent('Create a pie chart showing revenue distribution');

    expect(result.mentions).toContain('Pie');
  });

  it('handles prompts with multiple chart mentions', () => {
    const result = analyzePromptIntent('Should I use a bar chart or a line chart for this?');

    expect(result.mentions).toContain('Bar');
    expect(result.mentions).toContain('Line');
  });

  it('detects multiple intents from complex prompts', () => {
    const result = analyzePromptIntent(
      'Compare the trend of sales over time and show distribution'
    );

    expect(result.intents).toContain('trend');
    expect(result.intents).toContain('comparison');
    expect(result.intents).toContain('distribution');
  });

  it('provides default values for vague prompts', () => {
    const result = analyzePromptIntent('show me data');

    expect(result.intents.length).toBeGreaterThan(0);
    expect(result.suggestedCategories.length).toBeGreaterThan(0);
  });

  it('detects heatmap mentions', () => {
    const result = analyzePromptIntent('Display a heatmap of correlations');

    expect(result.mentions).toContain('Heatmap');
  });

  it('detects gauge mentions', () => {
    const result = analyzePromptIntent('Show a gauge for progress tracking');

    expect(result.mentions).toContain('Gauge');
    expect(result.intents).toContain('progress');
  });
});

describe('scoreChartFit', () => {
  it('returns ChartFitSuccess with proper _tag', () => {
    const lineDef = allCharts.get('Line')!;
    const result = scoreChartFit(lineDef, ['trend'], ['time-series']);

    expect(result._tag).toBe('ChartFitSuccess');
  });

  it('returns higher score for good category-intent fit', () => {
    const lineDef = allCharts.get('Line')!;
    const result = scoreChartFit(lineDef, ['trend'], ['time-series']);

    expect(result.score).toBeGreaterThan(0.3);
  });

  it('returns lower score for poor category-intent fit', () => {
    const pieDef = allCharts.get('Pie')!;
    const result = scoreChartFit(pieDef, ['trend'], ['time-series']);

    // Pie doesn't match trend/time-series well
    expect(result.score).toBeLessThan(0.8);
  });

  it('includes matched intents in result', () => {
    const barDef = allCharts.get('Bar')!;
    const result = scoreChartFit(barDef, ['comparison'], ['categorical']);

    expect(result.matchedIntents).toContain('comparison');
  });

  it('includes matched data shapes in result', () => {
    const lineDef = allCharts.get('Line')!;
    const result = scoreChartFit(lineDef, ['trend'], ['time-series']);

    expect(result.matchedDataShapes).toContain('time-series');
  });

  it('provides rationale for scoring', () => {
    const lineDef = allCharts.get('Line')!;
    const result = scoreChartFit(lineDef, ['trend'], ['time-series']);

    expect(result.rationale).toBeTruthy();
    expect(result.rationale.length).toBeGreaterThan(10);
  });

  it('caps score at 1.0', () => {
    const lineDef = allCharts.get('Line')!;
    // Even with multiple matching criteria, score shouldn't exceed 1.0
    const result = scoreChartFit(lineDef, ['trend', 'temporal', 'growth'], ['time-series']);

    expect(result.score).toBeLessThanOrEqual(1.0);
  });

  it('includes chartType in result', () => {
    const barDef = allCharts.get('Bar')!;
    const result = scoreChartFit(barDef, ['comparison'], []);

    expect(result.chartType).toBe('Bar');
  });
});

describe('buildMiniSchema', () => {
  it('builds schema from definition', () => {
    const def = allCharts.get('Bar')!;
    const schema = buildMiniSchema(def);

    expect(schema.type).toBe('Bar');
    expect(schema.category).toBe('comparison');
    expect(schema.description).toBeTruthy();
    expect(Array.isArray(schema.dataShapes)).toBe(true);
    expect(Array.isArray(schema.requiredFields)).toBe(true);
  });

  it('includes supportsSeriesGrouping flag', () => {
    const def = allCharts.get('Line')!;
    const schema = buildMiniSchema(def);

    expect(typeof schema.supportsSeriesGrouping).toBe('boolean');
  });

  it('includes usageHint from use cases', () => {
    const def = allCharts.get('Line')!;
    const schema = buildMiniSchema(def);

    expect(schema.usageHint).toBeTruthy();
    expect(schema.usageHint.length).toBeGreaterThan(0);
  });

  it('limits usageHint to first 3 use cases', () => {
    const def = allCharts.get('Line')!;
    const schema = buildMiniSchema(def);

    // usageHint is joined use cases
    const useCaseCount = schema.usageHint.split(';').length;
    expect(useCaseCount).toBeLessThanOrEqual(3);
  });

  it('handles charts without requiredFields', () => {
    // Some charts may not have requiredFields defined
    const def = allCharts.get('Gauge')!;
    const schema = buildMiniSchema(def);

    expect(Array.isArray(schema.requiredFields)).toBe(true);
  });
});

describe('toSummary', () => {
  it('converts definition to summary', () => {
    const def = allCharts.get('Heatmap')!;
    const summary = toSummary(def);

    expect(summary.type).toBe('Heatmap');
    expect(summary.category).toBe('correlation');
    expect(summary.description).toBeTruthy();
    expect(Array.isArray(summary.dataShapes)).toBe(true);
    expect(Array.isArray(summary.useCases)).toBe(true);
  });

  it('converts Sets to Arrays', () => {
    const def = allCharts.get('Line')!;
    const summary = toSummary(def);

    // Should be plain arrays, not Sets
    expect(Array.isArray(summary.dataShapes)).toBe(true);
    expect(Array.isArray(summary.useCases)).toBe(true);
  });

  it('preserves all relevant fields', () => {
    const def = allCharts.get('Pie')!;
    const summary = toSummary(def);

    expect(summary.type).toBe(def.type);
    expect(summary.description).toBe(def.description);
    expect(summary.category).toBe(def.category);
    // ChartDefinition uses Sets, toSummary converts to Arrays
    expect(summary.dataShapes.length).toBe(Array.from(def.dataShapes).length);
    expect(summary.useCases.length).toBe(Array.from(def.useCases).length);
  });
});
