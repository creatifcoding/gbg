/**
 * Drawer System
 *
 * Stacking drawer system with rolodex animation.
 * Supports global overlays and per-panel scoped drawers.
 *
 * @example
 * ```tsx
 * // App setup
 * import { DrawerStackProvider, GlobalSlot } from '@/lib/drawer'
 *
 * function App() {
 *   return (
 *     <DrawerStackProvider>
 *       <GlobalSlot />
 *       <MainContent />
 *     </DrawerStackProvider>
 *   )
 * }
 *
 * // Opening a drawer
 * import { useDrawer } from '@/lib/drawer'
 *
 * function MyComponent() {
 *   const drawer = useDrawer()
 *
 *   return (
 *     <button onClick={() => drawer.open({
 *       id: 'settings',
 *       slot: 'global',
 *       content: <SettingsPanel />,
 *     })}>
 *       Open Settings
 *     </button>
 *   )
 * }
 * ```
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
