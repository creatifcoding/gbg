/**
 * IIoT Event Journal DDL - Partitioned EventLog Tables
 *
 * Creates tables compatible with @effect/sql/SqlEventJournal for IIoT event sourcing.
 * Extended with partitioning by entity_type for optimized query performance.
 *
 * Tables:
 * - iiot.event_journal: Main partitioned event storage (alarm, work_order, equipment, task, approval)
 * - iiot.event_remotes: Remote sync tracking for CRDT-compatible replication
 *
 * @see @effect/sql/SqlEventJournal for base schema
 * @see @effect/experimental/EventJournal for EventLog API
 * @see thoughts/shared/specs/entity-system/04-storage-architecture.md
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Event Journal Table DDL (Partitioned)
// =============================================================================

/**
 * Entity types for partitioning.
 * Maps to ISA-95 domain concepts.
 */
export const ENTITY_TYPES = [
  'alarm',
  'work_order',
  'equipment',
  'task',
  'approval',
] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

/**
 * Creates the main event_journal partitioned table in the iiot schema.
 *
 * Columns:
 * - sequence_num: BIGSERIAL for ordering within partition
 * - entity_type: VARCHAR(64) for partition key (alarm, work_order, equipment, task, approval)
 * - primary_key: VARCHAR(255) for entity ID (AlarmId, WorkOrderId, MachineId, etc.)
 * - event_tag: VARCHAR(128) for event type (AlarmTriggered, StateChanged, etc.)
 * - payload: JSONB for event data
 * - created_at: TIMESTAMPTZ for event timestamp
 * - identity_id: UUID for EventLog identity (CRDT)
 *
 * The table is partitioned by LIST on entity_type for query optimization.
 */
export const createEventJournalTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Create main partitioned table
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal (
      sequence_num    BIGSERIAL,
      entity_type     VARCHAR(64) NOT NULL,
      primary_key     VARCHAR(255) NOT NULL,
      event_tag       VARCHAR(128) NOT NULL,
      payload         JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      identity_id     UUID NOT NULL,

      PRIMARY KEY (entity_type, sequence_num)
    ) PARTITION BY LIST (entity_type)
  `)
})

/**
 * Creates partitions for each entity type.
 *
 * Partitions:
 * - iiot.event_journal_alarm: Alarm lifecycle events
 * - iiot.event_journal_work_order: Work order lifecycle events
 * - iiot.event_journal_equipment: Equipment state events
 * - iiot.event_journal_task: Task instance events
 * - iiot.event_journal_approval: Approval request events
 */
export const createEventJournalPartitions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Alarm partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_alarm
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('alarm')
  `)

  // Work Order partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_work_order
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('work_order')
  `)

  // Equipment partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_equipment
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('equipment')
  `)

  // Task partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_task
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('task')
  `)

  // Approval partition
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_journal_approval
    PARTITION OF iiot.event_journal
    FOR VALUES IN ('approval')
  `)
})

// =============================================================================
// Event Remotes Table DDL
// =============================================================================

/**
 * Creates the event_remotes table for remote sync tracking.
 *
 * This table follows the @effect/sql/SqlEventJournal pattern for CRDT-compatible
 * distributed event synchronization.
 *
 * Columns:
 * - remote_id: UUID identifying the remote EventLog instance
 * - entry_id: UUID referencing the event entry
 * - sequence: INT for ordering within remote
 *
 * Extended with:
 * - last_sync_seq: BIGINT tracking last synchronized sequence number
 * - entity_type: VARCHAR(64) for efficient per-type sync queries
 * - synced_at: TIMESTAMPTZ for sync timestamp
 */
export const createEventRemotesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Primary remotes table (SqlEventJournal compatible)
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_remotes (
      remote_id       UUID NOT NULL,
      entry_id        UUID NOT NULL,
      sequence        INT NOT NULL,
      PRIMARY KEY (remote_id, entry_id)
    )
  `)

  // Extended remotes tracking table for IIoT-specific sync
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS iiot.event_remotes_sync (
      remote_id       UUID PRIMARY KEY,
      last_sync_seq   BIGINT NOT NULL DEFAULT 0,
      entity_type     VARCHAR(64) NOT NULL,
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
})

// =============================================================================
// Indexes DDL
// =============================================================================

/**
 * Creates indexes for efficient event queries.
 *
 * Indexes:
 * - idx_event_journal_temporal: (primary_key, created_at DESC) for entity history queries
 * - idx_event_journal_tag: (event_tag, created_at DESC) for event type queries
 * - idx_event_journal_payload_gin: GIN on payload for JSONB path queries
 * - idx_event_journal_identity: (identity_id) for CRDT merge operations
 * - idx_event_remotes_type: (entity_type, synced_at DESC) for sync queries
 */
export const createEventJournalIndexes = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Temporal query index: "What happened to entity X?"
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_journal_temporal
    ON iiot.event_journal (primary_key, created_at DESC)
  `

  // Event tag index: "All AlarmTriggered events"
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_journal_tag
    ON iiot.event_journal (event_tag, created_at DESC)
  `

  // JSONB GIN index for payload queries
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_event_journal_payload_gin
    ON iiot.event_journal USING GIN (payload jsonb_path_ops)
  `)

  // Identity index for CRDT merge lookups
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_journal_identity
    ON iiot.event_journal (identity_id)
  `

  // Remotes sync index
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_remotes_type
    ON iiot.event_remotes_sync (entity_type, synced_at DESC)
  `

  // Remotes sequence index for SqlEventJournal compatibility
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_event_remotes_sequence
    ON iiot.event_remotes (remote_id, sequence)
  `
})

// =============================================================================
// Combined Setup
// =============================================================================

/**
 * Creates all event journal tables and indexes.
 *
 * Order:
 * 1. Main partitioned table
 * 2. Entity type partitions
 * 3. Remotes tables
 * 4. Indexes
 *
 * Requires: SqlClient.SqlClient (PostgreSQL with iiot schema)
 */
export const createEventJournalSchema = Effect.gen(function* () {
  yield* createEventJournalTable
  yield* createEventJournalPartitions
  yield* createEventRemotesTable
  yield* createEventJournalIndexes
})

// =============================================================================
// DDL Drop Functions (for testing/migration)
// =============================================================================

/**
 * Drops all event journal tables.
 *
 * WARNING: This will delete all event data. Use only in test/dev environments.
 */
export const dropEventJournalSchema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Drop remotes tables
  yield* sql`DROP TABLE IF EXISTS iiot.event_remotes_sync CASCADE`
  yield* sql`DROP TABLE IF EXISTS iiot.event_remotes CASCADE`

  // Drop partitions (CASCADE from parent)
  yield* sql`DROP TABLE IF EXISTS iiot.event_journal CASCADE`
})
