/**
 * Drawer Renderer Module
 *
 * Unified directional drawer system. All four directions (left, right, top, bottom)
 * are handled by DrawerRendererBase with directional configurations.
 *
 * Architecture:
 * - DrawerRendererBase: The renderer component
 * - useDrawerRenderer: Hook for state/events
 * - directional.ts: Animation variants and styles per direction
 * - types.ts: Shared types
 *
 * @module
 */

// Main renderer
export { DrawerRendererBase, DrawerRendererBase as DrawerRenderer } from "./DrawerRendererBase"

// Hook for custom drawer implementations
export { useDrawerRenderer } from "./useDrawerRenderer"

// Directional configs for extension
export {
  SPRING_CONFIG,
  leftConfig,
  rightConfig,
  topConfig,
  bottomConfig,
  directionalConfigs,
  getDirectionalConfig,
} from "./directional"

// Types
export type {
  DrawerRendererProps,
  DirectionalDrawerConfig,
  DirectionalConfigRegistry,
  UseDrawerRendererReturn,
} from "./types"
