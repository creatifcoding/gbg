// ── Registry ────────────────────────────────────────────────
export { morphChatRegistry, MorphChatRegistryProvider } from './registry'

// ── Per-Surface UI Atoms ────────────────────────────────────
export {
  type SurfaceId,
  surfaceId,
  activeSpecFamily,
  previousSpecFamily,
  isMorphingFamily,
  composerFocusedFamily,
  scrollPositionFamily,
  focusedMessageFamily,
  selectedMessagesFamily,
  taskPanelExpandedFamily,
  activeAgentFamily,
  surfaceErrorFamily,
} from './surface-atoms'

// ── Adapter Registry ────────────────────────────────────────
export {
  registerAdapter,
  unregisterAdapter,
  getAdapter,
} from './data-atoms'
