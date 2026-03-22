/**
 * GEOINT Hooks
 *
 * React hooks for GEOINT state management.
 *
 * PATTERN: stx (State machine + Atoms + XState)
 * - Hooks work standalone (atoms only) or with XState for bidirectional sync
 * - Pass machineRef option to enable bidirectional sync with layout machine
 *
 * IMPORTANT: Components using these hooks must be wrapped in GeointRegistryProvider.
 *
 * @module geoint/hooks
 */

// ─────────────────────────────────────────────────────────────────────────────
// Layout Hooks (NEW - stx pattern)
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Main hook
  useGeointLayout,
  // Lightweight variants
  useGeointLayoutMode,
  useGeointLayoutAnimation,
  useIsGeointLayout,
  // Types
  type UseGeointLayoutResult,
  type UseGeointLayoutOptions,
} from './useGeointLayout'

// ─────────────────────────────────────────────────────────────────────────────
// Panel Hooks (NEW - stx pattern)
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Main hooks
  useGeointSidebar,
  useGeointIntelPanel,
  useGeointTimeline,
  // Lightweight variants
  useGeointSidebarCollapsed,
  useGeointIntelCollapsed,
  useGeointTimelineCollapsed,
  // Types
  type PanelType,
  type UseGeointSidebarResult,
  type UseGeointIntelPanelResult,
  type UseGeointTimelineResult,
  type UseGeointPanelOptions,
} from './useGeointPanel'

// ─────────────────────────────────────────────────────────────────────────────
// Floating Panel Hooks (NEW - Focus mode)
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Main hooks
  useGeointFloatingPanel,
  useGeointFloatingPanels,
  // Lightweight variants
  useGeointActivePanel,
  useGeointMaxPanelZIndex,
  // Types
  type UseGeointFloatingPanelResult,
  type UseGeointFloatingPanelsResult,
  type UseGeointFloatingPanelOptions,
} from './useGeointFloatingPanel'

// ─────────────────────────────────────────────────────────────────────────────
// Entity Hooks
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Main hook
  useGeointEntity,
  // Lightweight variants
  useGeointEntityUI,
  useGeointEntityAnimation,
  useGeointEntityLiveData,
  // Types
  type UseGeointEntityResult,
} from './useGeointEntity'

// ─────────────────────────────────────────────────────────────────────────────
// Selection Hooks
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Main hook
  useGeointSelection,
  // Lightweight variants
  useGeointSelectionCount,
  useIsGeointSelected,
  useGeointHovered,
  // Types
  type UseGeointSelectionResult,
} from './useGeointSelection'

// ─────────────────────────────────────────────────────────────────────────────
// Kori Bridge Hook
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Main hook
  useKoriBridge,
  useKoriBridgeOptional,
  // Provider
  KoriBridgeProvider,
  // Types
  type KoriBridgeOps,
  type KoriBridgeContextValue,
  type KoriBridgeProviderProps,
} from './useKoriBridge'

// ─────────────────────────────────────────────────────────────────────────────
// MapController Hook (NEW - unified map operations)
// ─────────────────────────────────────────────────────────────────────────────

export {
  useMapController,
} from './useMapController'

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Playback Hook
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Main hook
  useTimelinePlayback,
  // Lightweight variants
  useTimelinePlaybackEnabled,
  useTimelinePlayhead,
  useTimelineFilteredResults,
  // Types
  type UseTimelinePlaybackResult,
  type UseTimelinePlaybackOptions,
} from './useTimelinePlayback'
