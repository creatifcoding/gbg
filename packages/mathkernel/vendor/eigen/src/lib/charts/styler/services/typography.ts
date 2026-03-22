/**
 * TypographyService
 *
 * Layer 1 primitive service for typography configuration.
 * No dependencies on other services.
 *
 * @module charts/styler/services/typography
 */

import { Context, Effect, Layer } from 'effect';
import { VANTA_TYPOGRAPHY } from '@/components/portal/tokens';

// =============================================================================
// Types
// =============================================================================

export interface Typography {
  readonly family: string;
  readonly size: number;
  readonly weight?: number;
}

export type ContainerSize = 'sm' | 'md' | 'lg';

// =============================================================================
// Service Interface
// =============================================================================

export interface TypographyService {
  /**
   * Get default typography configuration.
   */
  readonly getDefaultTypography: () => Effect.Effect<Typography>;

  /**
   * Get typography optimized for a chart type.
   */
  readonly getTypographyForChartType: (chartType: string) => Effect.Effect<Typography>;

  /**
   * Get typography scaled for container size.
   */
  readonly getTypographyForSize: (containerSize: ContainerSize) => Effect.Effect<Typography>;
}

// =============================================================================
// Service Tag
// =============================================================================

export const TypographyService = Context.GenericTag<TypographyService>('charts/TypographyService');

// =============================================================================
// Chart Type Typography Map
// =============================================================================

const CHART_TYPOGRAPHY: Record<string, Partial<Typography>> = {
  // Gauges and metrics need larger text
  Gauge: { size: 14, weight: 500 },
  Liquid: { size: 14, weight: 500 },
  Bullet: { size: 13 },

  // Dense charts need smaller text
  Heatmap: { size: 11 },
  Treemap: { size: 11 },
  Sunburst: { size: 11 },
  CirclePacking: { size: 11 },

  // Graph charts
  NetworkGraph: { size: 12 },
  OrganizationChart: { size: 12 },
  MindMap: { size: 12 },
};

// =============================================================================
// Implementation
// =============================================================================

export const makeTypographyService = (): TypographyService => ({
  getDefaultTypography: () =>
    Effect.succeed({
      family: VANTA_TYPOGRAPHY.family.mono,
      size: 12,
      weight: 400,
    }),

  getTypographyForChartType: (chartType) =>
    Effect.succeed({
      family: VANTA_TYPOGRAPHY.family.mono,
      size: CHART_TYPOGRAPHY[chartType]?.size ?? 12,
      weight: CHART_TYPOGRAPHY[chartType]?.weight ?? 400,
    }),

  getTypographyForSize: (containerSize) =>
    Effect.succeed({
      family: VANTA_TYPOGRAPHY.family.mono,
      size: containerSize === 'sm' ? 10 : containerSize === 'lg' ? 14 : 12,
      weight: 400,
    }),
});

// =============================================================================
// Layer
// =============================================================================

export const TypographyServiceLive = Layer.succeed(TypographyService, makeTypographyService());
