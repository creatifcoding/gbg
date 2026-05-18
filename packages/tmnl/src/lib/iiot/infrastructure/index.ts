/**
 * IIoT Infrastructure — Event Sourcing, Feature Flags, and Deployment
 *
 * Core infrastructure services that underpin the IIoT system:
 * - **EventLog** — Event sourcing journal with in-memory and SQL backends
 * - **Feature Flags** — Gradual rollout of EventLog migration per domain
 * - **Deployment Mode** — Config-driven layer selection (test/tauri/cluster)
 *
 * @module @gbg/tmnl/iiot/infrastructure
 * @see {@link IIoTFeatureFlags} for EventLog migration flags
 * @see {@link DeploymentModeConfig} for runtime mode selection
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
  IIoTDomainEventHandlersLayer,

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
  simpleCompact,
  type IIoTSqlEventJournalConfig,
} from './sql-event-journal'

// =============================================================================
// Feature Flags (EventLog Migration)
// =============================================================================

export {
  IIoTFeatureFlags,
  IIoTFeatureFlagsDefault,
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlagsEnabledLayer,
  IIoTFeatureFlagsEnvLayer,
  makeFeatureFlagsLayer,
  isAlarmEventSourcingEnabled,
  isEquipmentStateEventSourcingEnabled,
  isWorkOrderEventSourcingEnabled,
  isBatchRecordEventSourcingEnabled,
} from './feature-flags'

// =============================================================================
// Deployment Mode Configuration
// =============================================================================

export {
  DeploymentMode,
  DeploymentModeConfig,
  DeploymentModeTestLayer,
  DeploymentModeTauriLayer,
  DeploymentModeClusterLayer,
  DeploymentModeEnvLayer,
  type DeploymentModeConfigShape,
} from './deployment-mode'
