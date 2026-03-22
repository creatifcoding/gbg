/**
 * Drawer System
 *
 * Stacking drawer system with rolodex animation.
 * Supports global overlays and per-panel scoped drawers.
 *
 * @deprecated EPOCH-0004: This module is being migrated to the Visual Overlay System.
 * New code should use:
 *
 * ```tsx
 * // NEW: Use VisualOverlayProvider (already mounted in main.tsx)
 * import { useDrawer } from '@/lib/overlays/visual'
 *
 * function MyComponent() {
 *   const drawer = useDrawer()
 *   return (
 *     <button onClick={() => drawer.open({
 *       slot: 'global',
 *       side: 'right',
 *     }, <SettingsPanel />)}>
 *       Open Settings
 *     </button>
 *   )
 * }
 * ```
 *
 * The legacy API below remains functional but will be removed in a future release.
 *
 * @module
 */

// Types
export type {
  DrawerSide,
  DrawerAnimationState,
  DrawerSlotType,
  DrawerConfig,
  DrawerInstance,
  DrawerStackState,
  DrawerSlot,
  RolodexConfig,
  ParallaxConfig,
} from './types'

export {
  DEFAULT_ROLODEX_CONFIG,
  DEFAULT_PARALLAX_CONFIG,
  DEFAULT_DRAWER_CONFIG,
  initialDrawerStackState,
} from './types'

// Context & Provider
export {
  DrawerStackProvider,
  useDrawerStack,
  useDrawerStackSafe,
  useDrawerCount,
  useHasOpenDrawers,
  useTopDrawerId,
  drawerStackAtom,
  slotRegistryAtom,
} from './DrawerStackContext'

// Components
export { Drawer, DrawerRenderer } from './Drawer'
export { GlobalSlot, GLOBAL_SLOT_ID } from './GlobalSlot'
export { PanelSlot } from './PanelSlot'

// Hooks
export { useDrawer, useDrawerInstance, type UseDrawerReturn } from './hooks'

// Animations
export {
  rolodexIn,
  rolodexOut,
  rolodexSwitch,
  resetRolodexStyles,
  parallaxLiftStack,
  parallaxCollapse,
  parallaxReorder,
  applyParallaxStyles,
  resetParallaxStyles,
} from './animations'

// ─────────────────────────────────────────────────────────────
// EPOCH-0004: Visual Overlay System Re-exports
// Use these for new code - the legacy exports above will be removed
// ─────────────────────────────────────────────────────────────

export {
  // New drawer hook with content-as-second-arg API
  useDrawer as useVisualDrawer,
  useDrawerSafe as useVisualDrawerSafe,
  type DrawerOpenOptions,
  type UseDrawerReturn as UseVisualDrawerReturn,
} from '../overlays/visual'
