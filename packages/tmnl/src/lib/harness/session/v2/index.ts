/**
 * Session V2 — Greenfield Session Management Schemas
 *
 * Phase 1 deliverable: pure data contracts.
 * No runtime, no services — just the types everything builds against.
 *
 * @module harness/session/v2
 */

// Identity — branded IDs and mappings
export {
  HarnessSessionId,
  PiSessionId,
  EntryId,
  SessionIdMapping,
} from './identity'

// Header — JSONL file header
export {
  SessionHeader,
  SESSION_SCHEMA_VERSION,
} from './header'

// Entries — the tree node types
export {
  // Roles & content
  MessageRole,
  TextContent,
  ImageContent,
  ToolCallContent,
  ToolResultContent,
  ThinkingContent,
  ContentBlock,
  SessionMessage,
  ThinkingLevel,
  // Entry types
  MessageEntry,
  ThinkingLevelChangeEntry,
  ModelChangeEntry,
  CompactionEntry,
  BranchSummaryEntry,
  CustomEntry,
  CustomMessageEntry,
  LabelEntry,
  SessionInfoEntry,
  // Union
  SessionEntry,
  SESSION_ENTRY_TAGS,
  type SessionEntryTag,
} from './entries'

// Metadata — lightweight listing view
export {
  SessionStatus,
  SessionMetadata,
} from './metadata'

// Lifecycle — state machine schemas
export {
  SessionLifecycleState,
  LIFECYCLE_STATES,
  TERMINAL_STATES,
  MUTABLE_STATES,
  // Events
  ConnectEvent,
  ConnectedEvent,
  ConnectFailedEvent,
  StreamStartEvent,
  StreamEndEvent,
  StreamErrorEvent,
  CompactStartEvent,
  CompactEndEvent,
  BranchStartEvent,
  BranchEndEvent,
  DisposeEvent,
  ResetEvent,
  LifecycleEvent,
  // Transition helpers
  TRANSITION_TABLE,
  isValidTransition,
  getTransitionTarget,
} from './lifecycle'

// Events — domain events for EventLog + PubSub
export {
  SessionCreated,
  SessionResumed,
  EntryAppended,
  BranchCreated,
  CompactionPerformed,
  SessionForked,
  SessionDisposed,
  MetadataUpdated,
  SessionEvent,
  SESSION_EVENT_TAGS,
  type SessionEventTag,
} from './events'

// Tree — the aggregate
export {
  SessionTree,
  makeSessionTree,
  countEntriesByTag,
} from './tree'

// Tree ops — pure functions
export {
  appendEntry,
  branchFrom,
  getBranch,
  getEntry,
  getChildren,
  getBranchPoints,
  buildContext,
  makeMessageEntry,
  makeCompactionEntry,
  generateEntryId,
  resetEntryCounter,
  type ContextMessage,
} from './tree-ops'

// Requests — Schema.TaggedRequest for Machine procedures
export {
  SessionError,
  AppendMessage,
  AppendEntry,
  BranchFrom,
  GetBranch,
  GetTree,
  Compact,
  CheckCompaction,
} from './requests'

// Machine — the session actor
export {
  SessionMachine,
  SessionMachineInput,
} from './machine'

// Serialization — JSONL frozen format + JSON blob
export {
  treeToJsonl,
  jsonlToTree,
  treeToJson,
  jsonToTree,
  extractMetadata,
} from './serialization'

// Session Store — DI-able persistence service
export {
  SessionStore,
  type SessionStoreOps,
} from './session-store'

// Tier Orchestrator — multi-tier persistence coordination
export {
  TierOrchestrator,
  type TierOrchestratorOps,
  makeTierOrchestratorLayer,
} from './tier-orchestrator'

// Atoms — React bridge (Atom-as-State pattern)
export {
  // Registry + Provider
  sessionRegistry,
  SessionRegistryProvider,
  // Runtime
  sessionRuntime,
  // Global state
  activeSessionId$,
  sessionList$,
  sessionLoading$,
  // Per-session state families
  sessionTree$,
  sessionBranch$,
  sessionContext$,
  sessionMeta$,
  sessionDirty$,
  // Mutation operations
  createSession,
  resumeSession,
  appendMessage,
  appendRawEntry,
  branchSession,
  compactSession,
  disposeSession,
  exportSession,
  importSession,
  refreshSessionList,
  flushSession,
} from './atoms'

// useSession hook — typed consumer API
export { useSession, type UseSessionResult } from './useSession'

// Facade — bridge to existing harness-adapter
export {
  wireSessionV2,
  appendToSessionV2,
  disposeSessionV2,
  getSessionV2Id,
  hasSessionV2,
  getSessionV2Map,
} from './facade'
