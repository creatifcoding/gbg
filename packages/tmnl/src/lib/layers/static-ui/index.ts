/**
 * Static UI Layer System
 *
 * Provides:
 * - ScaleProvider: Context for global UI scaling
 * - Type definitions for static UI layers
 * - Presets for z-index, position, and pointer-events
 */

export * from './types';
export { ScaleProvider, useScale, useScaleKeyboardShortcuts, useScaledValue } from './ScaleProvider';
