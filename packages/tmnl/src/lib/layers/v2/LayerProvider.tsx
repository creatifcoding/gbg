/**
 * Layer System v2 — LayerProvider
 *
 * React context provider that exposes the module-level layerRegistry
 * to effect-atom React hooks.
 *
 * This enables:
 * - useAtomValue(layersMapAtom) in components
 * - Synchronous mutations via atom utility functions
 * - Both use the same registry = reactive updates
 *
 * @experimental v2 API - Wrapper-free layer system
 */

import * as React from "react"
import { RegistryContext } from "@effect-atom/atom-react"
import { layerRegistry } from "./atoms"

// ─────────────────────────────────────────────────────────────────────────────
// LayerProvider Component
// ─────────────────────────────────────────────────────────────────────────────

export interface LayerProviderProps {
  children: React.ReactNode
}

/**
 * LayerProvider
 *
 * Provides the module-level layerRegistry to React components via effect-atom context.
 *
 * Usage:
 * ```tsx
 * function App() {
 *   return (
 *     <LayerProvider>
 *       <MyLayeredComponent />
 *     </LayerProvider>
 *   )
 * }
 * ```
 *
 * Inside children, you can use:
 * - useAtomValue(layersMapAtom) - Subscribe to layer state
 * - addLayer(), removeLayer() etc - Mutate state (triggers re-renders)
 */
export function LayerProvider({ children }: LayerProviderProps): React.ReactElement {
  return (
    <RegistryContext.Provider value={layerRegistry}>
      {children}
    </RegistryContext.Provider>
  )
}
