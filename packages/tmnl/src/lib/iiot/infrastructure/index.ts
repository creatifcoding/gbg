/**
 * IIoT Infrastructure Layer
 *
 * Provides the service infrastructure for IIoT event sourcing and persistence.
 *
 * @module @gbg/tmnl/iiot/infrastructure
 */

// =============================================================================
// EventLog Infrastructure
// =============================================================================

export {
  // Schema (value and type share same name)
  IIoTEventLogSchema,

  // Layers - Memory (for development/testing)
  IIoTEventJournalMemoryLayer,
  IIoTEventLogStackLayer,

  // Layers - SQL (for production)
  IIoTEventJournalSqlLayer,
  makeIIoTEventJournalSqlLayerWithIdentity,
  makeIIoTEventLogStackSqlLayer,

  // Layers - Shared
  IIoTIdentityLayer,
  IIoTEventLogLayer,

  // Deprecated
  IIoTEventJournalLayer,

  // Re-exports
  EventLog,
  EventJournal,

  // Types
  type Entry,
  type EventJournalError,
} from './eventlog-layer'

// =============================================================================
// SQL Event Journal (direct access)
// =============================================================================

export {
  makeIIoTSqlEventJournal,
  IIoTSqlEventJournalLayer,
  type IIoTSqlEventJournalConfig,
} from './sql-event-journal'
