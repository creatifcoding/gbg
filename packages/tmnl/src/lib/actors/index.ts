/**
 * Actors Module - Public API
 *
 * Effect-powered services for workspace orchestration and session persistence.
 * Uses @effect/sql-sqlite-wasm for browser-based SQLite persistence.
 *
 * ## Usage
 *
 * ```tsx
 * import { ActorProvider, useWorkspace, useSession } from '@/lib/actors'
 * import type { UserId } from '@/lib/actors'
 *
 * // Wrap your app
 * function App() {
 *   return (
 *     <ActorProvider>
 *       <BufferProvider>
 *         <MyEditor />
 *       </BufferProvider>
 *     </ActorProvider>
 *   )
 * }
 *
 * // Use workspace for shared buffer registry
 * function BufferManager() {
 *   const { createBuffer, listBuffers } = useWorkspace()
 *   // ...
 * }
 *
 * // Use session for per-user tab/window state
 * function TabManager({ userId }: { userId: UserId }) {
 *   const { createTab, setActiveTab } = useSession({ userId })
 *   // ...
 * }
 * ```
 *
 * @module lib/actors
 */

// =============================================================================
// Schemas (Effect Schema types)
// =============================================================================

export {
  // Branded IDs
  BufferId,
  TabId,
  WindowId,
  UserId,
  // Buffer types
  BufferType,
  BufferMeta,
  BufferEntry,
  WorkspaceState,
  // Session types
  CursorPosition,
  ScrollPosition,
  EditorMode,
  SessionTab,
  SessionWindow,
  SessionState,
  // Events
  WorkspaceEvent,
  SessionEvent,
  // Persistence
  PersistedState,
} from './schemas'

export type {
  BufferId as BufferIdType,
  TabId as TabIdType,
  WindowId as WindowIdType,
  UserId as UserIdType,
  BufferType as BufferTypeValue,
  BufferMeta as BufferMetaType,
  SessionTab as SessionTabType,
  SessionWindow as SessionWindowType,
  SessionState as SessionStateType,
} from './schemas'

// =============================================================================
// Services (Effect-based)
// =============================================================================

export {
  WorkspaceService,
  WorkspaceServiceLive,
  SessionService,
  SessionServiceFactory,
  SessionServiceFactoryLive,
  ActorPersistence,
  ActorPersistenceLayer,
  type WorkspaceServiceShape,
  type SessionServiceShape,
  type SessionServiceFactoryShape,
  type CreateBufferOptions,
  type CreateTabOptions,
  type UpdateTabOptions,
  type UpdateWindowOptions,
} from './services'

// =============================================================================
// Components
// =============================================================================

// Primary: Effect-based ActorProvider
export {
  ActorProvider,
  useActorContext,
  useActorReady,
  useWorkspaceService,
  type ActorProviderProps,
  type ActorContextValue,
} from './components'

// @deprecated: RivetKit-based provider - NOT exported due to Node.js dependencies
// If needed, import directly from: '@/lib/actors/components/RivetProvider'
export type {
  RivetProviderProps,
  RivetContextValue,
} from './components'

// =============================================================================
// Hooks
// =============================================================================

export {
  useWorkspace,
  useSession,
  type UseWorkspaceOptions,
  type UseWorkspaceResult,
  type UseSessionOptions,
  type UseSessionResult,
} from './hooks'

// =============================================================================
// Legacy (deprecated) - NOT exported to avoid bundling rivetkit
// =============================================================================

// NOTE: RivetKit-based registry and actors are NOT exported here
// because rivetkit has Node.js-only dependencies (module.createRequire).
// If needed for server-side code, import directly:
//   import { actorRegistry } from '@/lib/actors/registry'
//   import { workspace, session } from '@/lib/actors/actors'

// Re-export types only (no runtime import)
export type { ActorRegistry } from './registry'
export type {
  WorkspaceBufferMeta,
  SessionTab as LegacySessionTab,
  SessionWindow as LegacySessionWindow,
} from './actors'
