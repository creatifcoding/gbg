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
// Implementation Stubs (TODO: Implement)
// ─────────────────────────────────────────────────────────────

// TODO: export { LayerProvider } from './LayerProvider'
// TODO: export { useLayer } from './hooks/useLayer'
// TODO: export { useRegisterLayer } from './hooks/useRegisterLayer'
// TODO: export { useLayerStyle } from './hooks/useLayerStyle'
// TODO: export { useLayerOps } from './hooks/useLayerOps'
// TODO: export { LayerRegistry } from './services/LayerRegistry'
// TODO: export { LayerOperations } from './services/LayerOperations'
// TODO: export { layerRuntimeAtom, layersMapAtom, sortedLayersAtom } from './atoms'
