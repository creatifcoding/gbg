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
  // ── Message Parts (structured content blocks) ──
  TextPart,
  ThinkingPart,
  ToolInvocationState,
  ToolInvocationPart,
  FilePart,
  ChatMessagePart,
  // ── Part utilities ──
  flattenPartsToText,
  getMessageParts,
  // ── Message ──
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
  TextPart as TextPartType,
  ThinkingPart as ThinkingPartType,
  ToolInvocationState as ToolInvocationStateType,
  ToolInvocationPart as ToolInvocationPartType,
  FilePart as FilePartType,
  ChatMessagePart as ChatMessagePartType,
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

// ── Content View Spec (preset-aware compound rendering) ──────
export {
  ContentDensity,
  InteractivityConfig,
  AnimationConfig,
  SpacingConfig,
  BlockOverrides,
  ContentViewSpec,
  DENSITY_TIERS,
  deriveContentViewSpec,
  mergeContentViewSpec,
} from './content-view-spec'

export type {
  ContentDensity as ContentDensityType,
  InteractivityConfig as InteractivityConfigType,
  AnimationConfig as AnimationConfigType,
  SpacingConfig as SpacingConfigType,
  BlockOverrides as BlockOverridesType,
  ContentViewSpec as ContentViewSpecType,
} from './content-view-spec'

// ── Skin Interface (ARCHIVED — kept for type reference only) ──
// Skin abstraction killed in favor of Tailwind-direct styling.
// If theming is needed later, use CSS variables.
