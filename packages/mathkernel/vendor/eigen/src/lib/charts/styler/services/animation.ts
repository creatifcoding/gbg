/**
 * AnimationService
 *
 * Layer 1 primitive service for animation configuration.
 * No dependencies on other services.
 *
 * @module charts/styler/services/animation
 */

import { Context, Effect, Layer } from 'effect';

// =============================================================================
// Types
// =============================================================================

export interface AnimationConfig {
  readonly appear?: {
    readonly animation: string;
    readonly duration: number;
    readonly easing?: string;
  };
  readonly update?: {
    readonly animation: string;
    readonly duration: number;
  };
  readonly enter?: {
    readonly animation: string;
    readonly duration: number;
  };
}

// =============================================================================
// Service Interface
// =============================================================================

export interface AnimationService {
  /**
   * Get default animation configuration.
   */
  readonly getDefaultAnimation: () => Effect.Effect<AnimationConfig>;

  /**
   * Get animation optimized for a chart type.
   */
  readonly getAnimationForChartType: (chartType: string) => Effect.Effect<AnimationConfig>;

  /**
   * Get animation for a styling intent.
   */
  readonly getAnimationForIntent: (intent: string) => Effect.Effect<AnimationConfig>;

  /**
   * Get animation with custom duration scaling.
   */
  readonly getAnimationWithDuration: (
    baseConfig: AnimationConfig,
    scale: number
  ) => Effect.Effect<AnimationConfig>;
}

// =============================================================================
// Service Tag
// =============================================================================

export const AnimationService = Context.GenericTag<AnimationService>('charts/AnimationService');

// =============================================================================
// Chart Animation Presets
// =============================================================================

const CHART_ANIMATIONS: Record<string, AnimationConfig> = {
  // Line charts - wave in
  Line: { appear: { animation: 'wave-in', duration: 800, easing: 'ease-out' } },
  Area: { appear: { animation: 'wave-in', duration: 700, easing: 'ease-out' } },
  Stock: { appear: { animation: 'wave-in', duration: 600 } },

  // Bar charts - grow in
  Bar: { appear: { animation: 'grow-in-x', duration: 500 } },
  Column: { appear: { animation: 'grow-in-y', duration: 500 } },
  Histogram: { appear: { animation: 'grow-in-y', duration: 500 } },
  Waterfall: { appear: { animation: 'grow-in-y', duration: 600 } },

  // Circular charts - zoom in
  Pie: { appear: { animation: 'zoom-in', duration: 500 } },
  Rose: { appear: { animation: 'zoom-in', duration: 500 } },
  Radar: { appear: { animation: 'zoom-in', duration: 500 } },
  RadialBar: { appear: { animation: 'zoom-in', duration: 500 } },

  // Point charts - scatter zoom
  Scatter: { appear: { animation: 'zoom-in', duration: 400 } },

  // Gauge/Liquid - fade in
  Gauge: { appear: { animation: 'fade-in', duration: 800 } },
  Liquid: { appear: { animation: 'fade-in', duration: 800 } },

  // Tree/Hierarchy - path in
  Treemap: { appear: { animation: 'zoom-in', duration: 600 } },
  Sunburst: { appear: { animation: 'zoom-in', duration: 600 } },
  Sankey: { appear: { animation: 'path-in', duration: 1000 } },

  // Graphs - fade
  NetworkGraph: { appear: { animation: 'fade-in', duration: 500 } },
  FlowGraph: { appear: { animation: 'fade-in', duration: 500 } },
  OrganizationChart: { appear: { animation: 'fade-in', duration: 500 } },
  MindMap: { appear: { animation: 'fade-in', duration: 500 } },
};

const INTENT_ANIMATIONS: Record<string, AnimationConfig> = {
  'emphasize-trend': { appear: { animation: 'wave-in', duration: 1000, easing: 'ease-out' } },
  'compare-categories': { appear: { animation: 'grow-in-y', duration: 600 } },
  'show-distribution': { appear: { animation: 'zoom-in', duration: 500 } },
  'highlight-outliers': { appear: { animation: 'zoom-in', duration: 400 } },
  'cyberpunk': { appear: { animation: 'fade-in', duration: 300 } },
  'minimal': { appear: { animation: 'fade-in', duration: 200 } },
};

// =============================================================================
// Implementation
// =============================================================================

export const makeAnimationService = (): AnimationService => ({
  getDefaultAnimation: () =>
    Effect.succeed({
      appear: { animation: 'fade-in', duration: 300 },
    }),

  getAnimationForChartType: (chartType) =>
    Effect.succeed(
      CHART_ANIMATIONS[chartType] ?? { appear: { animation: 'fade-in', duration: 300 } }
    ),

  getAnimationForIntent: (intent) =>
    Effect.succeed(
      INTENT_ANIMATIONS[intent] ?? { appear: { animation: 'fade-in', duration: 400 } }
    ),

  getAnimationWithDuration: (baseConfig, scale) =>
    Effect.succeed({
      appear: baseConfig.appear
        ? { ...baseConfig.appear, duration: Math.round(baseConfig.appear.duration * scale) }
        : undefined,
      update: baseConfig.update
        ? { ...baseConfig.update, duration: Math.round(baseConfig.update.duration * scale) }
        : undefined,
      enter: baseConfig.enter
        ? { ...baseConfig.enter, duration: Math.round(baseConfig.enter.duration * scale) }
        : undefined,
    }),
});

// =============================================================================
// Layer
// =============================================================================

export const AnimationServiceLive = Layer.succeed(AnimationService, makeAnimationService());
