/**
 * Testbed Services
 *
 * Effect.Service implementations for the testbed editing system.
 */

// =============================================================================
// WorktreeManager
// =============================================================================

export {
  // Service
  WorktreeManager,
  type WorktreeManagerShape,
  // Config
  WorktreeConfig,
  type WorktreeConfigShape,
  // Schemas
  WorktreeInfo,
  WorktreeCreateOptions,
  // Errors
  WorktreeError,
  // Layers
  WorktreeManagerLive,
  WorktreeManagerDefault,
  WorktreeManagerService,
} from './WorktreeManager'

// =============================================================================
// DevServerManager
// =============================================================================

export {
  // Service
  DevServerManager,
  type DevServerManagerShape,
  // Config
  DevServerConfig,
  type DevServerConfigShape,
  // Schemas
  ServerInfo,
  // Errors
  DevServerError,
  // Layers
  DevServerManagerLive,
  DevServerManagerDefault,
  DevServerManagerService,
} from './DevServerManager'

// =============================================================================
// EditSessionService
// =============================================================================

export {
  // Service
  EditSessionService,
  type EditSessionServiceShape,
  // Schemas
  SessionStatus,
  PendingChange,
  UndoEntry,
  EditSession,
  SessionEvent,
  // Errors
  EditSessionError,
  // Layers
  EditSessionServiceLive,
  EditSessionServiceBundle,
} from './EditSessionService'
