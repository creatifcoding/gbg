/**
 * Floating Panel Contexts barrel
 *
 * @module
 */

export {
  FloatingPanelContext,
  useFloatingPanelContext,
  type FloatingPanelContextValue,
} from './FloatingPanelContext'

export {
  FloatingDimensionProvider,
  useFloatingDimensions,
  FloatingDimensionContext,
} from './FloatingDimensionContext'

export {
  FloatingBoundsProvider,
  useFloatingBounds,
  getBounds,
  clampPosition,
  clampDimensions,
  clampResize,
  Bounds,
  type FloatingBoundsProviderProps,
} from './FloatingBoundsContext'
