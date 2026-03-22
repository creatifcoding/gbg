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
  PanelContext,
  usePanelContext,
  type PanelContextValue,
  type PanelContextState,
  type PanelContextActions,
  type PanelContextMeta,
} from './PanelContext'

export {
  FloatingDimensionProvider,
  useFloatingDimensions,
  FloatingDimensionContext,
} from './FloatingDimensionContext'

export {
  FloatingBoundsProvider,
  useFloatingBounds,
  type FloatingBoundsProviderProps,
} from './FloatingBoundsContext'

export {
  getBounds,
  setBounds,
  clampPosition,
  clampDimensions,
  clampResize,
  Bounds,
} from './bounds'
