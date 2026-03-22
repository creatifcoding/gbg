/**
 * Scale System
 *
 * CSS custom property injection for scalable UI elements.
 * Independent from layer management.
 */

export {
  ScaleProvider,
  useScale,
  useScaledValue,
  useScaleKeyboardShortcuts,
} from './ScaleProvider';

export {
  DEFAULT_SCALE_CONFIG,
  TYPOGRAPHY_BASE_SIZES,
  SPACING_BASE_SIZES,
  COMPONENT_BASE_SIZES,
  type ScaleConfig,
  type TypographySize,
  type SpacingSize,
  type ComponentSize,
} from './types';
