/**
 * Chart Discriminator Agent Tests
 *
 * Verifies chart selection logic and output format.
 */

import { describe, it, expect } from 'vitest';
import { Effect, Layer } from 'effect';
import {
  ChartDiscriminator,
  ChartDiscriminatorLive,
  makeChartDiscriminator,
} from '../agent';
import type { DiscriminatorInput, DiscriminatorOutput } from '../schemas';

describe('ChartDiscriminator', () => {
  const runWithDiscriminator = <A, E>(
    effect: Effect.Effect<A, E, ChartDiscriminator>
  ) =>
    Effect.runPromise(effect.pipe(Effect.provide(ChartDiscriminatorLive)));

  describe('discriminate', () => {
    it('recommends trend chart for time-series trends', async () => {
      const input: DiscriminatorInput = {
        userPrompt: 'Show me the sales trend over time',
      };

      const result = await runWithDiscriminator(
        Effect.gen(function* () {
          const discriminator = yield* ChartDiscriminator;
          return yield* discriminator.discriminate(input);
        })
      );

      // Any trend chart is valid (Line, Area, Stock)
      expect(['Line', 'Area', 'Stock']).toContain(result.primary.chartType);
      expect(result.consideredCategories).toContain('trend');
    });

    it('recommends Bar chart for comparison', async () => {
      const input: DiscriminatorInput = {
        userPrompt: 'Compare sales by region',
      };

      const result = await runWithDiscriminator(
        Effect.gen(function* () {
          const discriminator = yield* ChartDiscriminator;
          return yield* discriminator.discriminate(input);
        })
      );

      expect(['Bar', 'Column']).toContain(result.primary.chartType);
      expect(result.consideredCategories).toContain('comparison');
    });

    it('recommends Pie chart for part-to-whole', async () => {
      const input: DiscriminatorInput = {
        userPrompt: 'Show the market share breakdown',
      };

      const result = await runWithDiscriminator(
        Effect.gen(function* () {
          const discriminator = yield* ChartDiscriminator;
          return yield* discriminator.discriminate(input);
        })
      );

      expect(['Pie', 'Treemap', 'Sunburst']).toContain(result.primary.chartType);
      expect(result.consideredCategories).toContain('part-to-whole');
    });

    it('recommends correlation chart for correlation analysis', async () => {
      const input: DiscriminatorInput = {
        userPrompt: 'Show a heatmap of the correlation matrix',
      };

      const result = await runWithDiscriminator(
        Effect.gen(function* () {
          const discriminator = yield* ChartDiscriminator;
          return yield* discriminator.discriminate(input);
        })
      );

      // Correlation charts include Heatmap, DualAxes, Venn, and Scatter (via use case)
      expect(['Scatter', 'Heatmap', 'DualAxes', 'Venn']).toContain(result.primary.chartType);
    });

    it('respects explicit chart type mentions', async () => {
      const input: DiscriminatorInput = {
        userPrompt: 'Create a heatmap showing activity',
      };

      const result = await runWithDiscriminator(
        Effect.gen(function* () {
          const discriminator = yield* ChartDiscriminator;
          return yield* discriminator.discriminate(input);
        })
      );

      expect(result.primary.chartType).toBe('Heatmap');
    });

    it('includes mini-schemas in output', async () => {
      const input: DiscriminatorInput = {
        userPrompt: 'Show sales over time',
      };

      const result = await runWithDiscriminator(
        Effect.gen(function* () {
          const discriminator = yield* ChartDiscriminator;
          return yield* discriminator.discriminate(input);
        })
      );

      expect(result.miniSchemas.length).toBeGreaterThan(0);
      expect(result.miniSchemas[0]).toHaveProperty('type');
      expect(result.miniSchemas[0]).toHaveProperty('description');
      expect(result.miniSchemas[0]).toHaveProperty('category');
      expect(result.miniSchemas[0]).toHaveProperty('dataShapes');
    });

    it('detects ambiguous requests', async () => {
      const input: DiscriminatorInput = {
        userPrompt: 'show me data',  // Very vague
      };

      const result = await runWithDiscriminator(
        Effect.gen(function* () {
          const discriminator = yield* ChartDiscriminator;
          return yield* discriminator.discriminate(input);
        })
      );

      // Should still provide a recommendation even if ambiguous
      expect(result.primary).toBeDefined();
    });

    it('respects constraints', async () => {
      const input: DiscriminatorInput = {
        userPrompt: 'Show sales trend',
        constraints: {
          onlyTypes: ['Bar', 'Column'],
        },
      };

      const result = await runWithDiscriminator(
        Effect.gen(function* () {
          const discriminator = yield* ChartDiscriminator;
          return yield* discriminator.discriminate(input);
        })
      );

      expect(['Bar', 'Column']).toContain(result.primary.chartType);
    });
  });

  describe('getSystemPrompt', () => {
    it('generates comprehensive prompt', () => {
      const discriminator = makeChartDiscriminator();
      const prompt = discriminator.getSystemPrompt();

      expect(prompt).toContain('Chart Discriminator Agent');
      expect(prompt).toContain('Chart Categories');
      expect(prompt).toContain('Available Chart Types');
      expect(prompt).toContain('Line');
      expect(prompt).toContain('Bar');
    });

    it('respects constraints in prompt generation', () => {
      const discriminator = makeChartDiscriminator();
      const prompt = discriminator.getSystemPrompt({
        onlyTypes: ['Line', 'Area'],
      });

      expect(prompt).toContain('Line');
      expect(prompt).toContain('Area');
      // Should not contain charts not in onlyTypes
      expect(prompt).not.toContain('### Bar');
    });
  });

  describe('getMiniSchema', () => {
    it('returns mini-schema for valid chart type', () => {
      const discriminator = makeChartDiscriminator();
      const schema = discriminator.getMiniSchema('Line');

      expect(schema).not.toBeNull();
      expect(schema!.type).toBe('Line');
      expect(schema!.category).toBe('trend');
      expect(schema!.dataShapes).toContain('time-series');
    });

    it('returns null for invalid chart type', () => {
      const discriminator = makeChartDiscriminator();
      const schema = discriminator.getMiniSchema('InvalidChart');

      expect(schema).toBeNull();
    });
  });

  describe('getScopedPrompt', () => {
    it('generates scoped prompt for specific charts', () => {
      const discriminator = makeChartDiscriminator();
      const prompt = discriminator.getScopedPrompt(['Line', 'Bar']);

      expect(prompt).toContain('Chart Configuration Guide');
      expect(prompt).toContain('Line');
      expect(prompt).toContain('Bar');
    });
  });
});
