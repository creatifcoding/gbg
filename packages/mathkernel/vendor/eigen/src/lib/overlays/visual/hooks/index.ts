/**
 * Visual Overlay Hooks
 *
 * Hooks for managing visual overlays.
 *
 * @module
 */

// Drawer
export {
  useDrawer,
  useDrawerSafe,
  type DrawerOpenOptions,
  type UseDrawerReturn,
} from "./useDrawer"

// Modal
export {
  useModal,
  useModalSafe,
  type ModalOpenOptions,
  type UseModalReturn,
} from "./useModal"

// Toast
export {
  useToast,
  useToastSafe,
  type ToastOpenOptions,
  type ToastVariant,
  type ToastPosition,
  type UseToastReturn,
} from "./useToast"

// Top Bar
export {
  useTopBar,
  useTopBarSafe,
  type TopBarMountOptions,
  type UseTopBarReturn,
} from "./useTopBar"

// Sidebar
export {
  useSidebar,
  useSidebarSafe,
  type SidebarMountOptions,
  type UseSidebarReturn,
} from "./useSidebar"

// Command Palette
export {
  useCommandPalette,
  useCommandPaletteSafe,
  type CommandPaletteOpenOptions,
  type UseCommandPaletteReturn,
} from "./useCommandPalette"

// Suppression
export {
  useSuppressOverlay,
  useSuppressOverlayType,
  useSuppressOverlayInstance,
  useSuppressOverlayControls,
  useSuppressOverlayControlsSafe,
  useIsSuppressed,
  useIsTypeSuppressed,
  type UseSuppressOverlayControlsReturn,
} from "./useSuppressOverlay"
