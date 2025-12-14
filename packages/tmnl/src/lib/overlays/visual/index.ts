/**
 * Visual Overlay System
 *
 * Unified visual overlay orchestration layer for drawer, modal, toast,
 * command-palette, top-bar, and sidebar overlays.
 *
 * @module
 */

// Constants
export {
  Z_INDEX_TIERS,
  Z_INDEX_STACK_GAP,
  GLOBAL_SLOT_ID,
  RESERVED_SLOT_IDS,
  GLOBAL_ONLY_TYPES,
  SLOTTED_TYPES,
  ANIMATION_DURATIONS,
  ANIMATION_EASINGS,
  BACKDROP_OPACITY,
  BACKDROP_BLUR,
  BACKDROP_COLOR,
  calculateZIndex,
  isReservedSlotId,
  supportsSlotScoping,
  isGlobalOnlyType,
  getAnimationDuration,
  getAnimationEasing,
  type GlobalOnlyType,
  type SlottedType,
} from "./constants"

// Providers
export {
  VisualOverlayProvider,
  useVisualOverlay,
  useVisualOverlaySafe,
  VisualOverlayContext,
  type VisualOverlayContextValue,
  type VisualOverlayProviderProps,
} from "./providers"

// Hooks
export {
  // Drawer
  useDrawer,
  useDrawerSafe,
  type DrawerOpenOptions,
  type UseDrawerReturn,
  // Modal
  useModal,
  useModalSafe,
  type ModalOpenOptions,
  type UseModalReturn,
  // Toast
  useToast,
  useToastSafe,
  type ToastOpenOptions,
  type ToastVariant,
  type ToastPosition,
  type UseToastReturn,
  // Top Bar
  useTopBar,
  useTopBarSafe,
  type TopBarMountOptions,
  type UseTopBarReturn,
  // Command Palette
  useCommandPalette,
  useCommandPaletteSafe,
  type CommandPaletteOpenOptions,
  type UseCommandPaletteReturn,
  // Suppression
  useSuppressOverlay,
  useSuppressOverlayType,
  useSuppressOverlayInstance,
  useSuppressOverlayControls,
  useSuppressOverlayControlsSafe,
  useIsSuppressed,
  useIsTypeSuppressed,
  type UseSuppressOverlayControlsReturn,
} from "./hooks"

// Slots
export { GlobalSlot, type GlobalSlotProps } from "./slots"
export { PanelSlot, type PanelSlotProps } from "./slots"

// Renderers
export {
  DrawerRenderer,
  type DrawerRendererProps,
  ModalRenderer,
  type ModalRendererProps,
  ToastRenderer,
  type ToastRendererProps,
  CommandPaletteRenderer,
  type CommandPaletteRendererProps,
  TopBarRenderer,
  type TopBarRendererProps,
  SidebarRenderer,
  type SidebarRendererProps,
} from "./renderers"
