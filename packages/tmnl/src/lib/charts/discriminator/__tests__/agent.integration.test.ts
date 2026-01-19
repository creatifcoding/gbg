/**
 * Chart Discriminator Agent Integration Tests
 *
 * Integration tests using a real LLM provider to verify
 * end-to-end chart discrimination with tool use.
 *
 * These tests require an API key to be configured.
 * Run with: bun test src/lib/charts/discriminator/__tests__/agent.integration.test.ts
 *
 * Skip by setting: SKIP_LLM_TESTS=1
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Effect } from 'effect';
import { claudeCode } from 'ai-sdk-provider-claude-code';
import { makeChartDiscriminator, type ChartDiscriminatorConfig } from '../agent';
import type { DiscriminatorInput } from '../schemas';

// Skip integration tests if SKIP_LLM_TESTS is set or in CI without API keys
const shouldSkip =
  process.env['SKIP_LLM_TESTS'] === '1' ||
  process.env['CI'] === 'true';

describe.skipIf(shouldSkip)('ChartDiscriminator (LLM Integration)', () => {
  let discriminator: ReturnType<typeof makeChartDiscriminator>;

  beforeAll(() => {
    // Use Claude Code provider directly (requires `claude login` for CLI auth)
    // Using haiku for fast, cheap integration tests
    const config: ChartDiscriminatorConfig = {
      model: claudeCode('haiku'),
    };
    discriminator = makeChartDiscriminator(config);
  });

  it('selects Line chart for time-series trend', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show me how sales changed over the last 12 months',
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    // Should select a trend-appropriate chart
    expect(['Line', 'Area', 'Stock']).toContain(result.primary.chartType);
    expect(result.consideredCategories).toContain('trend');
    expect(result.reasoning).toBeTruthy();
    expect(result.reasoning.length).toBeGreaterThan(10);
    expect(result.primary.confidence).toBeGreaterThan(0);
    expect(result.primary.confidence).toBeLessThanOrEqual(1);
  }, 60000); // 60s timeout for LLM call with tools

  it('selects Pie chart for market share', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show the market share breakdown by company',
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    expect(['Pie', 'Treemap', 'Sunburst']).toContain(result.primary.chartType);
    expect(result.consideredCategories).toContain('part-to-whole');
    expect(result.miniSchemas.length).toBeGreaterThan(0);
  }, 60000);

  it('selects Bar chart for comparison', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Compare revenue across different product categories',
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    expect(['Bar', 'Column', 'GroupedBar']).toContain(result.primary.chartType);
    expect(result.primary.rationale).toBeTruthy();
  }, 60000);

  it('selects Heatmap for correlation analysis', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Display a heatmap showing correlation between metrics',
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    expect(result.primary.chartType).toBe('Heatmap');
  }, 60000);

  it('respects onlyTypes constraint', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show me the sales trend over time',
      constraints: {
        onlyTypes: ['Bar', 'Column'],
      },
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    // Even though "trend" suggests Line, constraints limit to Bar/Column
    expect(['Bar', 'Column']).toContain(result.primary.chartType);
  }, 60000);

  it('respects excludeTypes constraint', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show market share breakdown',
      constraints: {
        excludeTypes: ['Pie'],
      },
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    // Pie excluded, should use alternative
    expect(result.primary.chartType).not.toBe('Pie');
    expect(['Treemap', 'Sunburst', 'Bar']).toContain(result.primary.chartType);
  }, 60000);

  it('includes mini-schemas in output', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show distribution of values',
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    expect(result.miniSchemas.length).toBeGreaterThan(0);
    const miniSchema = result.miniSchemas[0];
    expect(miniSchema).toHaveProperty('type');
    expect(miniSchema).toHaveProperty('description');
    expect(miniSchema).toHaveProperty('category');
    expect(miniSchema).toHaveProperty('dataShapes');
    expect(miniSchema).toHaveProperty('requiredFields');
    expect(miniSchema).toHaveProperty('supportsSeriesGrouping');
    expect(miniSchema).toHaveProperty('usageHint');
  }, 60000);

  it('provides alternatives for ambiguous requests', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Visualize the data',
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    // Should still provide a recommendation
    expect(result.primary).toBeDefined();
    expect(result.primary.chartType).toBeTruthy();
    // For ambiguous requests, might flag as ambiguous
    // (LLM may or may not set wasAmbiguous based on interpretation)
  }, 60000);

  it('uses data context when provided', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show me the data',
      dataContext: {
        fields: ['date', 'revenue', 'product_category'],
        inferredShape: 'time-series',
        rowCount: 365,
      },
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    // With time-series shape, should prefer trend charts
    expect(['Line', 'Area', 'Stock', 'Bar']).toContain(result.primary.chartType);
  }, 60000);

  it('selects Sankey for flow visualization', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show the flow of users through our conversion funnel',
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    expect(['Sankey', 'Funnel', 'FlowGraph']).toContain(result.primary.chartType);
    expect(result.consideredCategories.some(c => c === 'flow' || c === 'ranking')).toBe(true);
  }, 60000);

  it('selects Gauge for KPI visualization', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show a gauge displaying our progress toward the sales target',
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    expect(['Gauge', 'Progress']).toContain(result.primary.chartType);
  }, 60000);
});

/**
 * Tests that run without an LLM (using fallback logic)
 * These verify the agent still works in test/offline mode
 */
describe('ChartDiscriminator (Fallback Mode)', () => {
  const discriminator = makeChartDiscriminator(); // No config = fallback mode

  it('returns valid output in fallback mode', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show trend over time',
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    expect(result.primary).toBeDefined();
    expect(result.primary.chartType).toBeTruthy();
    expect(result.reasoning).toContain('Fallback');
  });

  it('fallback respects constraints', async () => {
    const input: DiscriminatorInput = {
      userPrompt: 'Show trend over time',
      constraints: {
        onlyTypes: ['Bar', 'Column'],
      },
    };

    const result = await Effect.runPromise(discriminator.discriminate(input));

    expect(['Bar', 'Column']).toContain(result.primary.chartType);
  });
});
