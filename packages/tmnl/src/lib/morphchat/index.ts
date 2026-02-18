/**
 * MorphChat — Adaptive Chat Surface Architecture
 *
 * One surface. Any shape. Every context.
 *
 * @module morphchat
 */

// ── Schemas (spec, messages, connection) ────────────────────
export {
  ChatSurfaceSpec,
  ComposerVariant,
  ThreadMode,
  InlineTaskMode,
  AgentSelectorMode,
  ConnectionDisplayMode,
  FrameChromeLevel,
  KeyboardShortcutScope,
  ContextChipMode,
  ScrollBehavior,
  mergeSpec,
  decodeSpec,
  ChatRole,
  MessageStatus,
  AttachmentKind,
  ChatAttachment,
  ChatMessage,
  ConnectionPhase,
  ConnectionState,
  AgentInfo,
  StreamingState,
  SendParams,
  DISCONNECTED,
  CONNECTED,
  STREAMING_IDLE,
} from './schemas'

export type {
  MorphChatAdapter,
  TransferSurfaceConfig,
  MockAdapterConfig,
  WebSocketAdapterConfig,
  ConductorAdapterConfig,
} from './schemas'

// ── Presets ──────────────────────────────────────────────────
export * as presets from './specs'
export { ALL_PRESETS, PRESET_LIST } from './specs'

// ── Atoms ───────────────────────────────────────────────────
export { morphChatRegistry, MorphChatRegistryProvider } from './atoms'
export type { SurfaceId } from './atoms'

// ── Machines ────────────────────────────────────────────────
export { surfaceMachine } from './machines'
export type { SurfaceMachineContext, SurfaceMachineEvent } from './machines'
export {
  getOrCreateSurfaceActor,
  sendSurfaceEvent,
  disposeSurfaceActor,
} from './machines'

// ── Adapters ────────────────────────────────────────────────
export { createMockChatAdapter } from './adapters'
export type {
  MockChatAdapter,
  MockAdapterFullConfig,
  MockAdapterSurfaceConfig,
  MockStatusRow,
  MockCommandChip,
} from './adapters'

// ── Components ──────────────────────────────────────────────
export {
  MorphChatSurface,
  type MorphChatSurfaceProps,
  useMorphChatContext,
  type MorphChatContextValue,
} from './components'

// ── Hooks ───────────────────────────────────────────────────
export { useMorphChat } from './hooks'
export { useSurfaceMachine } from './hooks'
export { useMorphTransition } from './hooks'
export { useAdapterState } from './hooks'

// ── Skins (ARCHIVED — Tailwind-direct styling, no skin indirection) ──

// =============================================================================
// Compound Component Assembly
// =============================================================================

import { MorphChatSurface } from './components'

/**
 * MorphChat namespace — the primary consumer API.
 *
 * ```tsx
 * <MorphChat.Surface
 *   spec={MorphChat.presets.Conductor}
 *   adapter={myAdapter}
 * />
 * ```
 */
export const MorphChat = {
  Surface: MorphChatSurface,
} as const
