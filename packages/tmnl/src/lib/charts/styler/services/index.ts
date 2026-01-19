/**
 * Chart Styler Services Index
 *
 * Exports all Effect services for chart styling.
 *
 * @module charts/styler/services
 */

// =============================================================================
// Layer 1: Primitive Services
// =============================================================================

export {
  PaletteService,
  PaletteServiceLive,
  makePaletteService,
  type DataContext,
} from './palette';

export {
  TypographyService,
  TypographyServiceLive,
  makeTypographyService,
  type Typography,
  type ContainerSize,
} from './typography';

export {
  AnimationService,
  AnimationServiceLive,
  makeAnimationService,
  type AnimationConfig,
} from './animation';
