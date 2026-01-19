/**
 * PaletteService
 *
 * Layer 1 primitive service for color palette operations.
 * No dependencies on other services.
 *
 * @module charts/styler/services/palette
 */

import { Context, Effect, Layer } from 'effect';
import { VANTA_COLORS } from '@/components/portal/tokens';
import { INTENT_PALETTES, CATEGORY_PALETTES, extendPalette, type ChartCategory } from '../../themes/palettes';
import { PaletteGenerationError } from '../errors';

// =============================================================================
// Service Interface
// =============================================================================

export interface PaletteService {
  /**
   * Get the default VANTA color palette.
   */
  readonly getDefaultPalette: () => Effect.Effect<string[]>;

  /**
   * Get palette for a styling intent.
   */
  readonly getPaletteForIntent: (intent: string) => Effect.Effect<string[], PaletteGenerationError>;

  /**
   * Get palette for a chart category.
   */
  readonly getPaletteForCategory: (category: ChartCategory) => Effect.Effect<string[]>;

  /**
   * Derive palette from data context.
   */
  readonly derivePaletteFromData: (dataContext: DataContext) => Effect.Effect<string[]>;

  /**
   * Extend a palette to a minimum length.
   */
  readonly extendPalette: (palette: string[], minLength: number) => Effect.Effect<string[]>;
}

export interface DataContext {
  readonly fields?: readonly string[];
  readonly shape?: string;
  readonly rowCount?: number;
}

// =============================================================================
// Service Tag
// =============================================================================

export const PaletteService = Context.GenericTag<PaletteService>('charts/PaletteService');

// =============================================================================
// Implementation
// =============================================================================

export const makePaletteService = (): PaletteService => ({
  getDefaultPalette: () =>
    Effect.succeed([
      VANTA_COLORS.accent.cyan,
      VANTA_COLORS.accent.emerald,
      VANTA_COLORS.accent.amber,
      VANTA_COLORS.accent.rose,
      VANTA_COLORS.accent.violet,
    ]),

  getPaletteForIntent: (intent) =>
    Effect.gen(function* () {
      const palette = INTENT_PALETTES[intent];
      if (!palette) {
        // Return minimal fallback instead of failing
        return [VANTA_COLORS.accent.cyan, VANTA_COLORS.text.secondary];
      }
      return palette;
    }),

  getPaletteForCategory: (category) =>
    Effect.succeed(CATEGORY_PALETTES[category] ?? CATEGORY_PALETTES['comparison']),

  derivePaletteFromData: (dataContext) =>
    Effect.gen(function* () {
      const fieldCount = dataContext.fields?.length ?? 3;

      // Time-series data emphasizes trend
      if (dataContext.shape === 'time-series') {
        return INTENT_PALETTES['emphasize-trend'] ?? [VANTA_COLORS.accent.cyan];
      }

      // Few fields - minimal palette
      if (fieldCount <= 2) {
        return [VANTA_COLORS.accent.cyan, VANTA_COLORS.text.secondary];
      }

      // More fields - comparison palette
      return CATEGORY_PALETTES['comparison'].slice(0, Math.min(fieldCount, 5));
    }),

  extendPalette: (palette, minLength) =>
    Effect.succeed(extendPalette(palette, minLength)),
});

// =============================================================================
// Layer
// =============================================================================

export const PaletteServiceLive = Layer.succeed(PaletteService, makePaletteService());
