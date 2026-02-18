// ── Surface Spec ────────────────────────────────────────────
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
} from './surface-spec'

export type {
  ChatSurfaceSpec as ChatSurfaceSpecType,
} from './surface-spec'

// ── Message & Connection Types ──────────────────────────────
export {
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
} from './message-types'

export type {
  ChatRole as ChatRoleType,
  ChatMessage as ChatMessageType,
  ConnectionState as ConnectionStateType,
  StreamingState as StreamingStateType,
  AgentInfo as AgentInfoType,
  SendParams as SendParamsType,
} from './message-types'

// ── Adapter Interface ───────────────────────────────────────
export type {
  MorphChatAdapter,
  TransferSurfaceConfig,
  MockAdapterConfig,
  WebSocketAdapterConfig,
  ConductorAdapterConfig,
} from './adapter-types'

// ── Skin Interface (ARCHIVED — kept for type reference only) ──
// Skin abstraction killed in favor of Tailwind-direct styling.
// If theming is needed later, use CSS variables.
