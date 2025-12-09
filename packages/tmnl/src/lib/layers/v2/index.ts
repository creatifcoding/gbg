/**
 * Layer System v2
 *
 * Wrapper-free layer management with hook-based style injection.
 *
 * STATUS: Architecture defined, implementation pending.
 * See ARCHITECTURE.md for design details.
 *
 * @example
 * ```tsx
 * import { LayerProvider, useLayer } from '@/lib/layers/v2'
 *
 * function App() {
 *   return (
 *     <LayerProvider>
 *       <MyLayeredComponent />
 *     </LayerProvider>
 *   )
 * }
 *
 * function MyLayeredComponent() {
 *   const { id, style, ops } = useLayer({
 *     name: 'my-layer',
 *     initialZIndex: 10,
 *     positionMode: 'absolute',
 *   })
 *
 *   return (
 *     <div style={style} data-layer-id={id}>
 *       Content here
 *       <button onClick={ops.bringToFront}>↑</button>
 *     </div>
 *   )
 * }
 * ```
 */

// ─────────────────────────────────────────────────────────────
// Types (Available now)
// ─────────────────────────────────────────────────────────────

export type {
  PositionMode,
  PointerEventsBehavior,
  LayerInstance,
  LayerConfig,
  LayerOps,
  UseLayerReturn,
  LayerRegistryOps,
  LayerOperationsOps,
} from './types'

export { Z_INDEX_GAP, LAYER_DEFAULTS } from './types'

// ─────────────────────────────────────────────────────────────
// Atoms (Atom-as-State Doctrine)
// ─────────────────────────────────────────────────────────────

export {
  // Registry singleton
  layerRegistry,
  // Core state atoms
  layersMapAtom,
  layerIdCounterAtom,
  // Derived atoms
  sortedLayersAtom,
  visibleLayersAtom,
  layerCountAtom,
  maxZIndexAtom,
  minZIndexAtom,
  visualHashAtom,
  // Layer family
  layerFamily,
  // Mutation utilities
  generateLayerId,
  addLayer,
  removeLayer,
  updateLayer,
  getLayer,
  getAllLayers,
  getSortedLayers,
  // Z-index operations
  calculateFrontZIndex,
  calculateBackZIndex,
  bringToFront,
  sendToBack,
  setVisible,
  setPointerEvents,
  setZIndex,
  setPositionMode,
  // Reset utilities
  resetAllLayers,
} from './atoms'

// ─────────────────────────────────────────────────────────────
// Services (Effect.Service<>() Pattern)
// ─────────────────────────────────────────────────────────────

export { LayerRegistry, LayerOperations } from './services'

// ─────────────────────────────────────────────────────────────
// Provider (React Context)
// ─────────────────────────────────────────────────────────────

export { LayerProvider, type LayerProviderProps } from './LayerProvider'

// ─────────────────────────────────────────────────────────────
// Hooks (React Integration)
// ─────────────────────────────────────────────────────────────

export {
  useLayer,
  useExistingLayer,
  useLayerStyle,
  useLayerStyleFromValues,
  useLayerOps,
  useGlobalLayerOps,
  type ExtendedLayerOps,
} from './hooks'
